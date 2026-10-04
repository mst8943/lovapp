import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const events = [];
page.on("pageerror", (error) => events.push(`pageerror:${error.message}`));
page.on("console", (message) => { if (message.type() === "error") events.push(`console:${message.text()}`); });

await page.goto(`${baseUrl}/demo?tab=messages`, { waitUntil: "networkidle" });
await page.locator(".conversation").first().click();
await page.getByRole("textbox", { name: "Mesaj" }).fill("Bu akşam hangi kahveyi seçerdin?");
await page.getByRole("button", { name: "Gönder" }).click();
const outgoingVisible = await page.getByText("Bu akşam hangi kahveyi seçerdin?").isVisible();
await page.waitForTimeout(300);
const botReplyVisible = await page.locator(".bubble.them").last().isVisible();

const adminResponse = await page.request.get(`${baseUrl}/api/admin/bots`);
const adminGuarded = [401, 503].includes(adminResponse.status());

const result = { outgoingVisible, botReplyVisible, adminGuarded, adminStatus: adminResponse.status(), events };
console.log(JSON.stringify(result, null, 2));
if (!outgoingVisible || !botReplyVisible || !adminGuarded || events.length) process.exitCode = 1;
await browser.close();
