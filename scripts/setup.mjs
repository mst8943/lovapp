// npm run setup: creates .env.local from .env.example and fills the secrets that can be generated.
// Existing non-empty values are never overwritten.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const target = process.argv[2] ?? ".env.local";
if (!existsSync(".env.example")) {
  console.error(".env.example bulunamadi; komutu proje kokunde calistirin.");
  process.exit(1);
}

const created = !existsSync(target);
let text = created ? readFileSync(".env.example", "utf8") : readFileSync(target, "utf8");
const hex = (bytes) => randomBytes(bytes).toString("hex");

const generated = {
  CRON_SECRET: () => hex(32),
  RATE_LIMIT_HMAC_SECRET: () => hex(32),
  MEMBERSHIP_ACCESS_HMAC_SECRET: () => hex(32),
  VERIFICATION_SETTINGS_KEY: () => hex(32),
};

try {
  const { default: webpush } = await import(createRequire(import.meta.url).resolve("web-push")).catch(() => ({ default: null }));
  if (webpush) {
    const keys = webpush.generateVAPIDKeys();
    generated.NEXT_PUBLIC_VAPID_PUBLIC_KEY = () => keys.publicKey;
    generated.VAPID_PRIVATE_KEY = () => keys.privateKey;
  }
} catch {
  // Web push keys stay empty; the doctor reports them as optional.
}

const filled = [];
for (const [key, make] of Object.entries(generated)) {
  const line = new RegExp(`^${key}=(.*)$`, "m");
  const match = text.match(line);
  if (match && match[1].trim()) continue;
  const value = make();
  text = match ? text.replace(line, `${key}=${value}`) : `${text.replace(/\n*$/, "\n")}${key}=${value}\n`;
  filled.push(key);
}

writeFileSync(target, text, { mode: 0o600 });
console.log(`${created ? "Olusturuldu" : "Guncellendi"}: ${target}`);
console.log(filled.length ? `Otomatik uretilen anahtarlar: ${filled.join(", ")}` : "Uretilecek yeni anahtar yoktu.");
console.log("\nSimdi sunlari elle doldurun: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,");
console.log("SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL, ADMIN_EMAILS ve en az bir AI anahtari.");
console.log("Sonra: npm run doctor");
