import base64
import json
import os
import re
import sys
import zipfile

OUTPUT = "lovask-customer-handoff.zip"

EXCLUDE_DIRS = {".next", "node_modules", ".git", ".agents", ".codex", ".vercel", ".vercel.new", "backups", "tmp", ".temp", "instagram", "hatalar", "build", ".dart_tool", ".gradle", ".idea", "__pycache__"}
EXCLUDE_FILES = {"zip_project.py", "lovask-sunucu.zip", "lovask-sunucu-yeni.zip", OUTPUT, "tsconfig.tsbuildinfo", "Ekran görüntüsü 2026-08-11 051731.png", "Lovask_15_Gunluk_Instagram_Takvimi.xlsx", "Lovask_30_Gunluk_Instagram_Takvimi (1).xlsx", "TEST_AUDIT_2026-08-16.md", "AI_HANDOFF.md", "SNAPSHOT_CONTENTS.md", "LOVASK-ERKENFINANS-KIMLIK-VE-PROJE-ENVANTERI.md"}

# Owner-only material: live server details, the owner's own Firebase project, outreach lists with third-party contacts.
OWNER_ONLY_FILES = {"PROJECT_HANDOFF.md", "mimari_kalanlar.md", "google-services.json", "reklam.mp4"}
OWNER_ONLY_PATHS = ("scripts/deploy/", "apps/mobile/android/app/google-services.json", "docs/marketing/", "docs/organic-", "docs/instagram-", "docs/DISCOVERY_FIX_HANDOFF", "docs/sync-handoff", "docs/cleanup-candidates")

TEXT_SUFFIXES = (".md", ".txt", ".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".sql", ".yml", ".yaml", ".sh", ".ps1", ".py", ".dart", ".kts", ".gradle", ".xml", ".html", ".example", ".properties", "Caddyfile", "Dockerfile")

BLOCK_PATTERNS = {
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "Google client secret": re.compile(r"GOCSPX-[A-Za-z0-9_-]{10,}"),
    "GitHub token": re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    "API secret key": re.compile(r"\bsk-[A-Za-z0-9_-]{32,}"),
    "server login (user@ip)": re.compile(r"\broot@\d{1,3}(?:\.\d{1,3}){3}\b"),
}
JWT = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]{10,}")
SECRET_KEY_NAME = re.compile(r"SECRET|KEY|TOKEN|PASSWORD|SERVICE_ACCOUNT", re.I)


def read_env_values():
    values = {}
    for name in (".env.production.local", ".env.local", ".env"):
        if not os.path.isfile(name):
            continue
        with open(name, encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                match = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
                if match:
                    values.setdefault(match.group(1), match.group(2).strip("\"'"))
    return values


def owner_context():
    env = read_env_values()
    secrets = {v for k, v in env.items() if SECRET_KEY_NAME.search(k) and not k.startswith("NEXT_PUBLIC_") and len(v) >= 16}
    host = ""
    match = re.match(r"https?://([^/]+)", env.get("NEXT_PUBLIC_SUPABASE_URL", ""))
    if match:
        host = match.group(1).split(".")[0]
    return secrets, host


def scan_file(rel, path, secrets, owner_ref, blocks, warns):
    if rel == "zip_project.py":
        return
    if not rel.endswith(TEXT_SUFFIXES) and os.path.basename(rel) not in ("Caddyfile", "Dockerfile"):
        return
    try:
        if os.path.getsize(path) > 3_000_000:
            return
        with open(path, encoding="utf-8", errors="ignore") as handle:
            text = handle.read()
    except OSError:
        return
    for label, pattern in BLOCK_PATTERNS.items():
        if pattern.search(text):
            blocks.append((rel, label))
    for value in secrets:
        if value in text:
            blocks.append((rel, "owner's real .env secret value"))
            break
    for match in JWT.finditer(text):
        try:
            payload = json.loads(base64.urlsafe_b64decode(match.group(1) + "=" * (-len(match.group(1)) % 4)))
        except Exception:
            continue
        if payload.get("role") == "service_role":
            blocks.append((rel, "Supabase service_role key"))
    if re.search(r"lovask\.com\.tr", text, re.I):
        warns.setdefault("original domain lovask.com.tr", []).append(rel)
    if owner_ref and owner_ref in text:
        warns.setdefault("owner's Supabase project reference", []).append(rel)


def create_zip():
    audit_only = "--audit" in sys.argv
    secrets, owner_ref = owner_context()
    blocks, warns, included = [], {}, []

    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith("recovery")]
        if os.path.normpath(root) == "artifacts":
            dirs[:] = [d for d in dirs if d == "android-twa"]
            files = []

        for file in files:
            if (file in EXCLUDE_FILES and file != "zip_project.py") or file in {"fix_bots.py", "env.json", "local.properties", ".flutter-plugins-dependencies"} or (file.startswith(".env") and file != ".env.example") or file.endswith((".log", ".zip", ".tar", ".tgz", ".gz", ".idsig", ".jks", ".keystore", ".iml", ".pid", ".apk.new")):
                continue
            file_path = os.path.join(root, file)
            rel = os.path.relpath(file_path, ".").replace(os.sep, "/")
            if file in OWNER_ONLY_FILES or rel.startswith(OWNER_ONLY_PATHS):
                continue
            scan_file(rel, file_path, secrets, owner_ref, blocks, warns)
            included.append((file_path, os.path.relpath(file_path, ".")))

    if blocks:
        print("DURDURULDU: pakette gizli bilgi bulundu, zip olusturulmadi:")
        for rel, label in sorted(set(blocks)):
            print(f"  - {rel}: {label}")
        sys.exit(1)

    if not audit_only:
        zipf = zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED)
        for file_path, arcname in included:
            zipf.write(file_path, arcname)
        zipf.close()
        print(f"Successfully created {OUTPUT} ({len(included)} dosya)")
    else:
        print(f"Denetim temiz: {len(included)} dosya, gizli bilgi bulunmadi (zip olusturulmadi).")

    for label, paths in warns.items():
        print(f"\nUYARI - {label}: {len(paths)} dosya. Alici kendi degerlerini yazmali (docs/KURULUM.md 'Markalama' bolumu).")
        for rel in sorted(paths)[:8]:
            print(f"  - {rel}")
        if len(paths) > 8:
            print(f"  ... ve {len(paths) - 8} dosya daha")


create_zip()
