import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const events = [];
page.on("console", (message) => events.push(`console:${message.type()}: ${message.text()}`));
page.on("pageerror", (error) => events.push(`pageerror: ${error.message}\n${error.stack ?? ""}`));
page.on("requestfailed", (request) => events.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
const response = await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const snapshot = await page.evaluate(() => ({
  title: document.title,
  text: document.body.innerText.slice(0, 800),
  screenOpacity: getComputedStyle(document.querySelector(".screen")).opacity,
  cardOpacity: getComputedStyle(document.querySelector(".profile-card")).opacity,
  buttons: document.querySelectorAll("button").length,
}));
await page.screenshot({ path: "tmp/lovask-home.png", fullPage: true });
await page.getByRole("button", { name: "Mesajlar" }).click();
await page.waitForTimeout(500);
const messagesVisible = await page.getByRole("heading", { name: "Mesajlar" }).isVisible();
await page.getByRole("button", { name: "Defne" }).first().click();
await page.getByRole("textbox", { name: "Mesaj" }).fill("Kahve içelim mi?");
await page.getByRole("button", { name: "Gönder" }).click();
await page.waitForTimeout(500);
const chatVisible = await page.getByText("Kahve içelim mi?").isVisible();
await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Beğen", exact: true }).click();
await page.waitForTimeout(300);
const matchVisible = await page.getByRole("heading", { name: "Eşleştiniz!" }).isVisible();
await page.screenshot({ path: "tmp/lovask-match.png", fullPage: true });

await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
const appleHidden = await page.getByText("Apple ile devam et").count() === 0;
await page.getByRole("tab", { name: "Hesap oluştur" }).click();
await page.getByLabel("E-posta").fill("demo@lovask.com.tr");
await page.locator('input[autocomplete="new-password"]').fill("Guclu-demo-2026");
await page.getByRole("button", { name: "Şifreyi göster" }).click();
const registerReady = await page.getByRole("button", { name: /Hesabımı oluştur/ }).isEnabled();
await page.screenshot({ path: "tmp/lovask-login.png", fullPage: true });
await page.getByRole("tab", { name: "Giriş yap" }).click();
await page.getByRole("link", { name: "Şifremi unuttum" }).click();
await page.waitForLoadState("networkidle");
const resetVisible = await page.getByRole("heading", { name: /Yeni bir anahtar/ }).isVisible();

await page.goto("http://127.0.0.1:3000/admin/lovask-control", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Yeni bot/ }).click();
const botModalVisible = await page.getByRole("heading", { name: /Yeni bir karakter/ }).isVisible();

console.log(JSON.stringify({
  status: response?.status(),
  securityHeaders: {
    noSniff: response?.headers()["x-content-type-options"],
    frame: response?.headers()["x-frame-options"],
  },
  snapshot,
  interactions: { messagesVisible, chatVisible, matchVisible, appleHidden, registerReady, resetVisible, botModalVisible },
  events,
}, null, 2));
await browser.close();
