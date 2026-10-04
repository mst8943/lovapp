import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = process.cwd();
const runId = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const output = resolve(root, "artifacts", "qa", runId);
await mkdir(output, { recursive: true });
const live = process.argv.includes("--live");
const devicesOnly = process.argv.includes("--devices-only");
const envFile = live ? parseEnv(await readFile(resolve(root, ".env.test.local"), "utf8")) : {};
const production = live ? parseEnv(await readFile(resolve(root, ".env.production.local"), "utf8")) : {};
const base = live ? (process.env.LOVASK_BASE_URL ?? envFile.LOVASK_BASE_URL ?? "https://lovask.com.tr") : "http://127.0.0.1:3000";
const adb = resolve(process.env.LOCALAPPDATA ?? "C:/Users/USER/AppData/Local", "Android/sdk/platform-tools/adb.exe");
const results = [];
const mobileVersion = /^version:\s*(.+)$/m.exec(await readFile(resolve(root, "apps/mobile/pubspec.yaml"), "utf8"))?.[1] ?? "unknown";
const run = { title: "Lovask tam test raporu", date: new Date().toISOString(), environment: base, version: `Android ${mobileVersion}; web ${JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version}`, isDemo: false, id: runId };
function executable(name, args) {
  if (name === "npm") return [process.execPath, [process.env.npm_execpath ?? "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", ...args]];
  if (name === "flutter" && process.platform === "win32") return ["cmd.exe", ["/d", "/s", "/c", "C:/flutter/bin/flutter.bat", ...args]];
  return [name, args];
}

async function exec(id, title, surface, bin, args, { cwd = root, env = process.env, timeoutMs = 180_000 } = {}) {
  const started = Date.now();
  const log = [];
  let status = "GEÇTİ";
  let error = "";
  try {
    const code = await new Promise((done, fail) => {
      const [file, parameters] = executable(bin, args);
      const child = spawn(file, parameters, { cwd, env: { ...env, LOVASK_BASE_URL: base }, windowsHide: true, shell: false });
      const timer = setTimeout(() => child.kill(), timeoutMs);
      for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => log.push(String(chunk)));
      child.on("error", (cause) => { clearTimeout(timer); fail(cause); });
      child.on("close", (value) => { clearTimeout(timer); done(value); });
    });
    if (code !== 0) { status = "BAŞARISIZ"; error = `Çıkış kodu: ${code}`; }
  } catch (cause) {
    status = "ENGELLİ";
    error = String(cause);
  }
  const logs = log.join("").slice(-20_000).replaceAll(/(LOVASK_[A-Z_]*(?:PASSWORD|SECRET|KEY)\s*=\s*)[^\s]+/g, "$1[REDACTED]");
  const result = { id, title, surface, module: title, severity: status === "GEÇTİ" ? "Orta" : "Yüksek", status, durationMs: Date.now() - started, error, steps: [`${bin} ${args.join(" ")}`], logs };
  results.push(result);
  await writeFile(resolve(output, `${id}.log`), logs);
  process.stdout.write(`${status} ${id} ${title}\n`);
  return result;
}

function blocked(id, title, reason, surface = "Mobil") {
  results.push({ id, title, surface, module: title, severity: "Yüksek", status: "ENGELLİ", durationMs: 0, error: reason, steps: [], logs: "" });
  process.stdout.write(`ENGELLİ ${id} ${title}: ${reason}\n`);
}

try {
  if (!devicesOnly) {
  await exec("WEB-VERIFY", "Web lint, tür ve üretim derlemesi", "Web", "npm", ["run", "verify"], { timeoutMs: 600_000 });
  await exec("MOB-ANALYZE", "Flutter analizi", "Mobil", "flutter", ["analyze", "--no-pub"], { cwd: resolve(root, "apps/mobile"), timeoutMs: 240_000 });
  await exec("MOB-WIDGET", "Flutter widget ve ekran testleri", "Mobil", "flutter", ["test", "--no-pub", "--reporter", "expanded", "--dart-define=SUPABASE_URL=", "--dart-define=SUPABASE_ANON_KEY="], { cwd: resolve(root, "apps/mobile"), timeoutMs: 300_000 });
  for (const [id, file] of [["API-PROFILE", "test-profile-contracts.mjs"], ["API-SESSION", "test-registration-session.mjs"], ["API-REOPEN", "test-conversation-reopen.mjs"]]) {
    await exec(id, file, "API", "node", [`scripts/${file}`]);
  }
  await exec("API-FCM", "FCM v1 imza ve gönderim sözleşmesi", "API", "node", ["scripts/test-fcm.mjs"]);
  await exec("API-PAYMENT", "Ödeme tutarı eşleşmesi", "API", "node", ["--experimental-strip-types", "scripts/test-payment-total.mjs"]);
  await exec("OPS-HEALTH", "Sağlık ve başarısız ödeme alarmı", "Admin", "node", ["scripts/test-ops-health.mjs"]);
  if (live) {
  await exec("LIVE-PUBLIC", "Canlı genel web ve APK başlıkları", "Web", "node", ["scripts/audit-public.mjs", base], { timeoutMs: 180_000 });
  await exec("LIVE-CORE", "Dar ekran, demo ve yetki korumaları", "Web", "node", ["scripts/audit-core-local.mjs", base], { timeoutMs: 180_000 });
  await exec("LIVE-NOIR", "Noir paket kataloğu", "Web", "node", ["scripts/audit-noir-catalog.mjs", base]);
  await exec("LIVE-A11Y", "Genel sayfa erişilebilirliği", "Web", "node", ["scripts/audit-accessibility.mjs", base], { timeoutMs: 240_000 });
  await exec("LIVE-ADMIN", "Admin sayfaları ve webhook reddi", "Admin", "node", ["scripts/audit-admin-surface.mjs"], { timeoutMs: 300_000 });
  await exec("LIVE-SYNC", "Ayrı web, API ve admin oturumları", "API", "node", ["scripts/test-e2e-sync.mjs"], { timeoutMs: 240_000 });
  await exec("LIVE-CROSS", "QA web mesajı, mobil API ve admin kaydı", "API", "node", ["scripts/test-qa-cross-client.mjs"], { timeoutMs: 240_000 });
  await exec("BOT-AUDIT", "Bot persona ve kuyruk durumunu salt okunur denetle", "Admin", "node", ["scripts/audit-bot-behavior.mjs"], { timeoutMs: 120_000 });
  if (envFile.LOVASK_STANDARD_EMAIL && envFile.LOVASK_STANDARD_PASSWORD && production.NEXT_PUBLIC_SUPABASE_URL && production.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    await exec("MOB-API", "Flutter istemcisi canlı oturum testi", "Mobil", "flutter", ["test", "--no-pub", "test/live_api_test.dart", `--dart-define=SUPABASE_URL=${production.NEXT_PUBLIC_SUPABASE_URL}`, `--dart-define=SUPABASE_ANON_KEY=${production.NEXT_PUBLIC_SUPABASE_ANON_KEY}`], {
      cwd: resolve(root, "apps/mobile"),
      env: { ...process.env, LOVASK_TEST_EMAIL: envFile.LOVASK_STANDARD_EMAIL, LOVASK_TEST_PASSWORD: envFile.LOVASK_STANDARD_PASSWORD },
      timeoutMs: 180_000,
    });
  } else blocked("MOB-API", "Flutter istemcisi canlı oturum testi", "Test hesabı veya public bağlantı eksik.");
  }
  }
  if (live || devicesOnly) {
  const devices = await exec("DEVICE-LIST", "Bağlı Android cihazlarını belirle", "Mobil", adb, ["devices", "-l"], { timeoutMs: 15_000 });
  const androidIds = devices.logs.split(/\r?\n/).filter((line) => /\bdevice\b/.test(line) && /^(?:emulator-|[A-Z0-9]{8,})/i.test(line)).map((line) => line.split(/\s+/)[0]);
  if (androidIds.length >= 2) await exec("DEVICE-E2E", "İki Android APK giriş ve gezinme", "Mobil", "node", ["scripts/test-mobile-apk.mjs", ...androidIds.slice(0, 2)], { timeoutMs: 360_000 });
  else if (androidIds.length === 1) {
    await exec("DEVICE-A", "Android APK QA A girişi ve gezinme", "Mobil", "node", ["scripts/test-mobile-apk.mjs", "--account-a", androidIds[0]], { timeoutMs: 180_000 });
    await exec("DEVICE-B", "Android APK QA B girişi ve gezinme", "Mobil", "node", ["scripts/test-mobile-apk.mjs", "--account-b", androidIds[0]], { timeoutMs: 180_000 });
    blocked("DEVICE-E2E", "İki Android APK eşzamanlı etkileşim", "İkinci emülatör ADB bağlantısını kaybediyor; oturumlar tek cihazda sırayla denendi.");
  } else blocked("DEVICE-E2E", "Android APK giriş ve gezinme", "Bağlı Android cihazı bulunamadı.");
  }
  if (!devicesOnly) {
    blocked("PUSH-DELIVERY", "Gerçek Android push teslimi", "İki cihazda ön plan/arka plan teslimi ve bildirimden açılış senaryosu henüz koşturulmadı.");
    blocked("PAYMENT-CHARGE", "Noir gerçek ödeme ve webhook mutabakatı", "Ödeme sağlayıcısında ayrılmış test işlemi ve geri alma akışı yok.", "Web");
    blocked("MOBILE-MESSAGE-SYNC", "İki cihaz ve web arasında canlı mesaj", "QA cihazları arasında eşleşme ve iki yönlü mesaj senaryosu henüz güvenli temizlikle otomatikleştirilmedi.");
    blocked("BOT-WORKER", "Gerçek bot cevabı ve gecikmesi", "İşçi tetiklemesi canlı kullanıcı mesajı üretebilir; ayrılmış bot senaryosu kurulmadı.", "Admin");
  }
} finally {
  const report = { run, results };
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2));
  const template = await readFile(resolve(root, "docs/qa/report-template.html"), "utf8");
  const payload = JSON.stringify(report).replaceAll("<", "\\u003c");
  const html = template.replace("</body>", `<script>document.addEventListener("DOMContentLoaded", () => window.renderReport(${payload}))</script></body>`);
  await writeFile(resolve(output, "report.html"), html);
  await writeFile(resolve(root, "artifacts/qa/latest.html"), html);
  process.stdout.write(`Rapor: ${resolve(output, "report.html")}\n`);
  if (results.some((item) => item.status === "BAŞARISIZ" || item.status === "ENGELLİ")) process.exitCode = 1;
}
