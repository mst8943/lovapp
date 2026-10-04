import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const env = parseEnv(readFileSync(".env.test.local", "utf8"));
const [, expectedName, expectedCode] = /^version:\s*([^+\s]+)\+(\d+)/m.exec(readFileSync("apps/mobile/pubspec.yaml", "utf8")) ?? [];
assert(expectedName && expectedCode, "Flutter version missing");
const adbPath = process.env.LOVASK_ADB ?? `${process.env.LOCALAPPDATA ?? "C:/Users/USER/AppData/Local"}/Android/sdk/platform-tools/adb.exe`;
const singleAccount = ["--account-a", "--account-b"].includes(process.argv[2]);
const devices = singleAccount ? process.argv.slice(3) : process.argv.slice(2);
assert.equal(devices.length, singleAccount ? 1 : 2, "Expected Android device IDs are required");
const accounts = ["QA_A", "QA_B"].map((kind) => ({ email: env[`LOVASK_${kind}_EMAIL`], password: env[`LOVASK_${kind}_PASSWORD`] }));
assert.deepEqual(accounts.map((account) => account.email), ["qa-erkek-test@lovask.com.tr", "qa-kadin-test@lovask.com.tr"]);
assert(accounts.every((account) => account.password), "QA passwords missing");

function adb(device, ...args) {
  return execFileSync(adbPath, ["-s", device, ...args], { encoding: "utf8", timeout: 45_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
}

function nodes(xml) {
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(([tag]) => {
    const attr = (name) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
    return { text: attr("text"), description: attr("content-desc"), className: attr("class"), resourceId: attr("resource-id"), bounds: attr("bounds"), clickable: attr("clickable") === "true" };
  });
}

function screen(device) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      adb(device, "shell", "uiautomator", "dump", "/sdcard/lovask-qa.xml");
      return nodes(adb(device, "shell", "cat", "/sdcard/lovask-qa.xml"));
    } catch (error) {
      if (attempt === 2) throw error;
      adb(device, "shell", "sleep", "1");
    }
  }
}

function tap(device, node) {
  const points = [...node.bounds.matchAll(/\d+/g)].map((item) => Number(item[0]));
  assert.equal(points.length, 4, `Missing tap bounds for ${node.text || node.description}`);
  adb(device, "shell", "input", "tap", String(Math.floor((points[0] + points[2]) / 2)), String(Math.floor((points[1] + points[3]) / 2)));
}

async function waitFor(device, predicate, label, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const items = screen(device);
    const permission = items.find((item) => item.resourceId === "com.android.permissioncontroller:id/permission_allow_button");
    if (permission) {
      tap(device, permission);
      await delay(500);
      continue;
    }
    const found = predicate(items);
    if (found) return found;
    await delay(1200);
  }
  throw new Error(`${device}: ${label} görünmedi`);
}

for (const [position, device] of devices.entries()) {
  const index = singleAccount && process.argv[2] === "--account-b" ? 1 : position;
  const account = accounts[index];
  assert(adb(device, "shell", "pm", "path", "tr.com.lovask.app").includes("base.apk"), `${device}: Lovask APK kurulu değil`);
  const version = adb(device, "shell", "dumpsys", "package", "tr.com.lovask.app");
  assert(version.includes(`versionName=${expectedName}`) && version.includes(`versionCode=${expectedCode}`), `${device}: beklenen APK sürümü ${expectedName}+${expectedCode}`);
  adb(device, "shell", "pm", "clear", "tr.com.lovask.app");
  adb(device, "shell", "am", "start", "-n", "tr.com.lovask.app/tr.com.lovask.lovask_mobile.MainActivity");
  const fields = await waitFor(device, (items) => {
    const inputs = items.filter((item) => item.className === "android.widget.EditText");
    return inputs.length >= 2 ? inputs : null;
  }, "giriş alanları");
  tap(device, fields[1]);
  adb(device, "shell", "input", "text", account.password);
  const emailField = screen(device).find((item) => item.className === "android.widget.EditText");
  assert(emailField, `${device}: email field missing after keyboard opened`);
  tap(device, emailField);
  adb(device, "shell", "input", "text", account.email);
  if (adb(device, "shell", "dumpsys", "input_method").includes("mInputShown=true")) adb(device, "shell", "input", "keyevent", "4");
  const login = screen(device).find((item) => (item.text === "Giriş yap" || item.description === "Giriş yap") && item.clickable);
  assert(login, `${device}: giriş düğmesi bulunamadı`);
  tap(device, login);
  await waitFor(device, (items) => items.find((item) => item.description.includes("Keşfet") && item.clickable), "ana gezinme", 75_000);
  for (const label of ["Mesajlar", "Buluşma", "Profil", "Keşfet"]) {
    const item = screen(device).find((node) => node.description.includes(label) && node.clickable);
    assert(item, `${device}: ${label} sekmesi bulunamadı`);
    tap(device, item);
    await waitFor(device, (items) => items.find((node) => node.description.includes(label) && node.clickable), `${label} ekranı`);
  }
  console.log(`${device}: QA ${index === 0 ? "A" : "B"} girişi ve dört sekme geçti (APK ${expectedName}+${expectedCode}).`);
}
