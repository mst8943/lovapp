// npm run rebrand -- --domain alanadiniz.com [--supabase-url https://xxx.supabase.co --supabase-anon-key ...] [--dry-run]
// Runs on the buyer's own copy: swaps the original domain and the mobile app's built-in Supabase defaults.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const domain = option("domain")?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const supabaseUrl = option("supabase-url")?.replace(/\/$/, "");
const anonKey = option("supabase-anon-key");
const dryRun = flag("dry-run");

if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
  console.error("Kullanim: npm run rebrand -- --domain alanadiniz.com [--supabase-url https://xxx.supabase.co --supabase-anon-key ANON] [--dry-run]");
  process.exit(1);
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "build", ".dart_tool", ".gradle", "artifacts", "tmp"]);
const TEXT = /\.(md|txt|ts|tsx|js|mjs|json|css|yml|yaml|sh|ps1|py|dart|html|example)$|^(Caddyfile|Dockerfile)$/;
const ORIGINAL_DOMAIN = /lovask\.com\.tr/gi;
const SUPABASE_URL_DEFAULT = /https:\/\/[a-z0-9]{20}\.supabase\.co/g;
const ANON_DEFAULT = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;

const changes = new Map();
const note = (file, what) => changes.set(file, [...(changes.get(file) ?? []), what]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) yield* walk(full);
    else if (TEXT.test(entry) && info.size < 3_000_000 && entry !== "package-lock.json" && entry !== "pubspec.lock") yield full;
  }
}

for (const file of walk(".")) {
  const rel = file.split(path.sep).join("/");
  const original = readFileSync(file, "utf8");
  let text = original;

  if (ORIGINAL_DOMAIN.test(text)) {
    text = text.replace(ORIGINAL_DOMAIN, domain);
    note(rel, "alan adi");
  }
  if (/^apps\/mobile\/lib\/.*\.dart$/.test(rel)) {
    if (SUPABASE_URL_DEFAULT.test(text)) {
      text = text.replace(SUPABASE_URL_DEFAULT, supabaseUrl ?? "");
      note(rel, supabaseUrl ? "Supabase adresi" : "Supabase adresi temizlendi");
    }
    if (ANON_DEFAULT.test(text)) {
      text = text.replace(ANON_DEFAULT, anonKey ?? "");
      note(rel, anonKey ? "anon anahtari" : "anon anahtari temizlendi");
    }
  }
  if (text !== original && !dryRun) writeFileSync(file, text);
}

console.log(`${dryRun ? "[deneme] " : ""}${changes.size} dosya ${dryRun ? "degisecek" : "guncellendi"}:`);
for (const [file, what] of changes) console.log(`  ${file}  (${[...new Set(what)].join(", ")})`);
if (!supabaseUrl || !anonKey) {
  console.log("\nNot: Mobil uygulamanin gomulu Supabase varsayilanlari bosaltildi. APK derlerken");
  console.log("--dart-define=SUPABASE_URL=... ve --dart-define=SUPABASE_ANON_KEY=... verin (apps/mobile/build-release.ps1 bunu .env dosyasindan yapar).");
}
console.log("\nSonraki adimlar: google-services.json'u kendi Firebase projenizle degistirin, Ayarlar sayfasindan marka adi ve logoyu girin, npm run doctor.");
