#!/usr/bin/env bash
set -euo pipefail
: "${LOVASK_BACKUP_DATABASE_URL:?Backup database URL required}"
: "${LOVASK_RESTORE_CHECK_DATABASE_URL:?Disposable restore-check database URL required}"
: "${LOVASK_BACKUP_DIR:?Backup directory required}"
if [[ "$LOVASK_BACKUP_DATABASE_URL" == "$LOVASK_RESTORE_CHECK_DATABASE_URL" || "${LOVASK_RESTORE_CHECK_DATABASE_URL%%\?*}" != */lovask_restore_check ]]; then
  echo 'Restore target must be a distinct lovask_restore_check database.' >&2
  exit 2
fi
umask 077
mkdir -p "$LOVASK_BACKUP_DIR"
archive="$LOVASK_BACKUP_DIR/lovask-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --dbname="$LOVASK_BACKUP_DATABASE_URL" --file="$archive.partial"
mv -- "$archive.partial" "$archive"
pg_restore --list "$archive" >/dev/null
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$LOVASK_RESTORE_CHECK_DATABASE_URL" "$archive"
echo "Backup and disposable restore passed: $archive"
# ponytail: no retention policy; add one after offsite backup and capacity monitoring exist.
