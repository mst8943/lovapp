import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });

await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
const initialLikeBadge = await page.getByRole("button", { name: /Beğeniler · 3 yeni beğeni, 1 süper beğeni/ }).isVisible();
const initialMessageBadge = await page.getByRole("button", { name: /Mesajlar · 1 okunmamış mesaj/ }).isVisible();

await page.getByRole("button", { name: /Beğeniler · 3 yeni beğeni/ }).click();
const likeBadgeClosed = await page.getByRole("button", { name: "Beğeniler", exact: true }).isVisible();

await page.getByRole("button", { name: /Mesajlar · 1 okunmamış mesaj/ }).click();
await page.locator(".conversation").first().click();
await page.getByRole("button", { name: "Mesajlara dön" }).click();
const messageBadgeClosed = await page.getByRole("button", { name: "Mesajlar", exact: true }).isVisible();

const result = { initialLikeBadge, likeBadgeClosed, initialMessageBadge, messageBadgeClosed, errors };
console.log(JSON.stringify(result, null, 2));
if (!initialLikeBadge || !likeBadgeClosed || !initialMessageBadge || !messageBadgeClosed || errors.length) process.exitCode = 1;
await browser.close();
