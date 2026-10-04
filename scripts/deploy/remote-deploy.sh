#!/usr/bin/env bash
# Runs on the live server. Usage: bash remote-deploy.sh /tmp/lovask-release.tgz <label>
# Builds in a separate stage directory first; live files change only after a
# passing build, and a failed health check restores the previous release.
set -euo pipefail

ARCHIVE="$1"
LABEL="${2:-release-$(date +%Y%m%d-%H%M)}"
# Overrides exist only for rehearsing the script away from the live server.
APP="${LOVASK_APP:-/var/www/lovask}"
STAGE="${LOVASK_STAGE_ROOT:-/var/www}/lovask-stage-$LABEL"
BACKUP="$APP/.deploy-backups/pre-$LABEL"
PORT="${LOVASK_PORT:-}"
PUBLIC_URL="${LOVASK_PUBLIC_URL:-https://lovask.com.tr}"
export PATH="/root/.hermes/node/bin:$PATH"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nHATA: %s\n' "$*" >&2; exit 1; }

log "On kontroller"
[ -f "$ARCHIVE" ] || fail "Arsiv yok: $ARCHIVE"
[ -f "$APP/package.json" ] || fail "$APP/package.json bulunamadi"
[ -d "$APP/node_modules" ] || fail "$APP/node_modules bulunamadi"
command -v npm >/dev/null || fail "npm bulunamadi (PATH: $PATH)"
if [ -n "${LOVASK_RESTART_CMD:-}" ]; then
  restart() { bash -c "$LOVASK_RESTART_CMD"; }
  SERVICE="override"
elif systemctl cat lovask.service >/dev/null 2>&1; then
  restart() { systemctl restart lovask.service; }
  SERVICE="lovask.service"
elif command -v pm2 >/dev/null && pm2 describe lovask >/dev/null 2>&1; then
  restart() { pm2 restart lovask --update-env; }
  SERVICE="pm2:lovask"
else
  fail "lovask.service veya pm2 'lovask' sureci bulunamadi"
fi
# The handoff's port 3005 proved stale; read the port the running service listens on.
detect_port() {
  local pids="" cg
  if [ "$SERVICE" = "lovask.service" ]; then
    cg=$(systemctl show -p ControlGroup --value lovask.service 2>/dev/null || true)
    [ -n "$cg" ] && [ -r "/sys/fs/cgroup$cg/cgroup.procs" ] && pids=$(cat "/sys/fs/cgroup$cg/cgroup.procs")
    [ -z "$pids" ] && [ -r "/sys/fs/cgroup/systemd$cg/cgroup.procs" ] && pids=$(cat "/sys/fs/cgroup/systemd$cg/cgroup.procs")
  elif [ "$SERVICE" = "pm2:lovask" ]; then
    pids=$(pm2 pid lovask 2>/dev/null || true)
    for p in $pids; do pids="$pids $(pgrep -P "$p" 2>/dev/null || true)"; done
  fi
  for p in $pids; do listen_ports "$p"; done | grep -E '^[0-9]+$' | head -1
}
# Listening TCP ports of a pid via /proc, so neither ss nor netstat is required.
listen_ports() {
  local inodes
  inodes=$(ls -l "/proc/$1/fd" 2>/dev/null | sed -n 's/.*socket:\[\([0-9]*\)\].*/\1/p' | sort -u)
  [ -n "$inodes" ] || return 0
  cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | awk -v list=" $(echo $inodes) " '
    $4 == "0A" && index(list, " " $10 " ") { split($2, a, ":"); print a[2] }' |
    while read -r hex; do printf '%d\n' "0x$hex"; done
}
# Must never fail: it runs inside rollback under set -e.
diagnose() {
  echo "--- servis durumu ---"
  if [ "$SERVICE" = "lovask.service" ]; then
    systemctl status lovask.service --no-pager -n 0 2>&1 | head -12 || true
    journalctl -u lovask.service -n 30 --no-pager 2>&1 || true
  elif [ "$SERVICE" = "pm2:lovask" ]; then
    pm2 logs lovask --lines 30 --nostream 2>&1 || true
  fi
  echo "--- dinlenen portlar ---"
  ss -ltnp 2>/dev/null | grep -E 'node|next' || true
}
[ -z "$PORT" ] && PORT=$(detect_port || true)
[ -z "$PORT" ] && PORT=3005
echo "Servis: $SERVICE - Port: $PORT - Node: $(node -v)"
[ -e "$BACKUP" ] && fail "Yedek klasoru zaten var: $BACKUP (farkli etiket kullan)"

FILES=$(tar -tzf "$ARCHIVE" | grep -v '/$')
echo "$FILES" | sed 's/^/  - /'

log "Asama klasoru hazirlaniyor: $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -C "$APP" --exclude=./node_modules --exclude=./.next --exclude=./.deploy-backups --exclude='./.next-*' -cf - . | tar -C "$STAGE" -xf -
# Turbopack rejects a node_modules symlink outside the project root; hardlinks are fast and cheap.
cp -al "$APP/node_modules" "$STAGE/node_modules"
tar -C "$STAGE" -xzf "$ARCHIVE"

log "Asama derlemesi"
(cd "$STAGE" && npm run build) || fail "Asama derlemesi basarisiz; canliya dokunulmadi. Klasor: $STAGE"

log "Yedek aliniyor: $BACKUP"
mkdir -p "$BACKUP"
EXISTING=$(cd "$APP" && for f in $FILES; do [ -e "$f" ] && echo "$f"; done || true)
NEWFILES=$(cd "$APP" && for f in $FILES; do [ -e "$f" ] || echo "$f"; done || true)
if [ -n "$EXISTING" ]; then (cd "$APP" && tar -cf "$BACKUP/source.tar" $EXISTING); fi
printf '%s\n' "$NEWFILES" > "$BACKUP/new-files.txt"
cp -a "$APP/.next" "$BACKUP/next"

rollback() {
  diagnose
  log "GERI DONULUYOR"
  rm -rf "$APP/.next-pre-$LABEL" "$STAGE"
  [ -f "$BACKUP/source.tar" ] && tar -C "$APP" -xf "$BACKUP/source.tar"
  while read -r f; do [ -n "$f" ] && rm -f "$APP/$f"; done < "$BACKUP/new-files.txt"
  rm -rf "$APP/.next" && cp -a "$BACKUP/next" "$APP/.next"
  restart
  fail "Saglik kontrolu gecmedi; onceki surum geri yuklendi. Yedek: $BACKUP"
}

log "Yayina aliniyor"
tar -C "$APP" -xzf "$ARCHIVE"
rm -rf "$APP/.next.incoming"
mv "$STAGE/.next" "$APP/.next.incoming"
mv "$APP/.next" "$APP/.next-pre-$LABEL"
mv "$APP/.next.incoming" "$APP/.next"
# Runtime links (e.g. sharp) were built against the stage copy of node_modules.
for link in "$APP/.next/node_modules"/*; do
  [ -L "$link" ] || continue
  target=$(readlink "$link")
  ln -sfn "${target/#$STAGE/$APP}" "$link"
  [ -e "$link" ] || rollback
done
restart

log "Saglik kontrolu"
check() { curl -fs -o /dev/null --max-time 10 "$1"; }
# A manifest under the new BUILD_ID proves the restarted process serves this build, not a stale one.
BUILD_ID=$(cat "$APP/.next/BUILD_ID")
ok=0
# This server needs well over a minute to come back after a restart.
for i in $(seq 1 90); do
  if check "http://127.0.0.1:$PORT/_next/static/$BUILD_ID/_buildManifest.js" && check "http://127.0.0.1:$PORT/" && check "http://127.0.0.1:$PORT/login" && check "http://127.0.0.1:$PORT/api/auth/register"; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || rollback
for path in / /login /download /noir /api/auth/register; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_URL$path")
  echo "  $path -> $code"
  [ "$code" = 200 ] || rollback
done
apk=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 15 "$PUBLIC_URL/api/download/android")
echo "  /api/download/android -> $apk"

rm -rf "$STAGE" "$APP/.next-pre-$LABEL"
log "Tamam. Servis: $SERVICE - Geri donus yedegi: $BACKUP (source.tar, new-files.txt, next)"
