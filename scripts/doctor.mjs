// npm run doctor: read-only installation check. Prints what is ready, what is missing and what to do.
// Usage: node scripts/doctor.mjs [env-file] [--offline]
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const envFile = args.find((a) => !a.startsWith("--")) ?? [".env.production.local", ".env.local"].find(existsSync);

const fileEnv = {};
if (envFile && existsSync(envFile)) {
  for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fileEnv[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const placeholder = /your-domain\.com|example\.com|YOUR_|GENERATE_|PROJE-REF/i;
const env = (key) => {
  const value = (process.env[key] ?? fileEnv[key] ?? "").trim();
  return placeholder.test(value) ? "" : value;
};

const rows = [];
const add = (level, title, hint = "") => rows.push({ level, title, hint });
const ok = (title) => add("ok", title);
const bad = (title, hint) => add("bad", title, hint);
const warn = (title, hint) => add("warn", title, hint);

const [major] = process.versions.node.split(".").map(Number);
if (major >= 22) ok(`Node.js ${process.versions.node}`);
else bad(`Node.js ${process.versions.node}`, "Node.js 22 veya daha yenisi gerekir.");

if (!envFile) bad("Ortam dosyasi bulunamadi", "Once `npm run setup` calistirin.");
else ok(`Ortam dosyasi: ${envFile}`);

for (const [key, hint] of [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase > Project Settings > API > Project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase > Project Settings > API > anon public key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase > Project Settings > API > service_role (gizli tutun)"],
  ["NEXT_PUBLIC_APP_URL", "Sitenizin adresi, ornek https://alanadiniz.com"],
  ["ADMIN_EMAILS", "Yonetici e-postasi (virgulle ayirabilirsiniz)"],
]) {
  if (env(key)) ok(key);
  else bad(`${key} bos`, hint);
}

for (const key of ["CRON_SECRET", "RATE_LIMIT_HMAC_SECRET"]) {
  const value = env(key);
  if (!value) bad(`${key} bos`, "`npm run setup` otomatik uretir.");
  else if (value.length < 24) warn(`${key} kisa`, "En az 24 karakterlik rastgele bir deger kullanin.");
  else ok(key);
}

const appUrl = env("NEXT_PUBLIC_APP_URL");
if (appUrl) {
  if (/lovask\.com\.tr/i.test(appUrl)) warn("NEXT_PUBLIC_APP_URL hala orijinal Lovask adresi", "Kendi alan adinizi yazin; aksi halde giris yonlendirmeleri yanlis siteye gider.");
  else if (!/^https:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl)) warn("NEXT_PUBLIC_APP_URL https ile baslamiyor", "Uretimde https zorunludur.");
}
if (env("NEXT_PUBLIC_SUPABASE_ANON_KEY") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY") === env("SUPABASE_SERVICE_ROLE_KEY")) {
  bad("anon ve service_role anahtarlari ayni", "service_role anahtari anon anahtari degildir; Supabase API ayarlarindan dogrusunu alin.");
}

const aiKeys = ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "GEMINI_API_KEY"].filter((k) => env(k));
if (aiKeys.length) ok(`Yapay zeka saglayicisi: ${aiKeys.map((k) => k.replace("_API_KEY", "").toLowerCase()).join(", ")}`);
else warn("Yapay zeka anahtari yok", "Bot sohbetleri ve Wingman calismaz; en az bir AI anahtari ekleyin.");

const optional = [
  ["Browser push (VAPID)", ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]],
  ["Android push (Firebase)", [["FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_SERVICE_ACCOUNT_FILE"]]],
  ["E-posta (Resend)", ["RESEND_API_KEY"]],
  ["Odeme (Shopier)", ["SHOPIER_WEBHOOK_TOKEN"]],
  ["Bot koruma (Turnstile)", ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]],
  ["Dogrulama ayarlari sifreleme", ["VERIFICATION_SETTINGS_KEY"]],
];
for (const [label, keys] of optional) {
  const ready = keys.every((k) => (Array.isArray(k) ? k.some(env) : env(k)));
  if (ready) ok(`${label} hazir`);
  else warn(`${label} kapali`, "Istege bagli; ihtiyac halinde .env dosyasindan acilir.");
}

const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
if (!offline && base && anon) {
  const get = (path, key) => fetch(`${base}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
  try {
    const settings = await get("/auth/v1/settings", anon);
    if (!settings.ok) bad(`Supabase Auth yanit vermedi (${settings.status})`, "URL veya anon anahtarini kontrol edin.");
    else {
      ok("Supabase Auth erisilebilir");
      const body = await settings.json().catch(() => ({}));
      if (env("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED") === "true") {
        if (body.external?.google) ok("Google girisi Supabase'de acik");
        else warn("Google girisi Supabase'de kapali", "Authentication > Providers > Google'i acin veya NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false yapin.");
      }
    }
  } catch (error) {
    bad("Supabase'e baglanilamadi", String(error.cause?.code ?? error.message));
  }
  if (service) {
    try {
      const profiles = await get("/rest/v1/profiles?select=id&limit=1", service);
      if (profiles.ok) ok("Veritabani semasi kurulu (profiles tablosu var)");
      else bad(`Veritabani semasi eksik (${profiles.status})`, "supabase/INSTALL.sql dosyasini SQL Editor'da calistirin.");
      const admins = await get("/rest/v1/admin_users?select=user_id&limit=1", service);
      if (admins.ok) {
        const rowsOut = await admins.json().catch(() => []);
        if (rowsOut.length) ok("Owner yetkisi verilmis");
        else warn("Henuz owner yok", "Kayit olup README'deki admin_users SQL'ini calistirin.");
      }
    } catch (error) {
      warn("Veritabani kontrolu yapilamadi", String(error.message));
    }
  }
}

const mark = { ok: "[ OK ]", warn: "[UYARI]", bad: "[EKSIK]" };
console.log(`\nLovask kurulum denetimi${envFile ? ` (${envFile})` : ""}\n`);
for (const row of rows) console.log(`${mark[row.level]} ${row.title}${row.hint ? `\n         -> ${row.hint}` : ""}`);
const count = (level) => rows.filter((r) => r.level === level).length;
console.log(`\n${count("ok")} hazir, ${count("warn")} uyari, ${count("bad")} eksik.`);
if (count("bad")) {
  console.log("Eksikleri tamamlayip komutu tekrar calistirin.");
  process.exit(1);
}
console.log("Zorunlu ayarlar tamam. Uyarilar istege bagli ozelliklerdir.");
