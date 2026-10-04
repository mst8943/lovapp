import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const events = [];
page.on("pageerror", (error) => events.push(`pageerror:${error.message}`));
page.on("requestfailed", (request) => {
  if (!request.url().includes("_rsc=")) events.push(`requestfailed:${request.url()} ${request.failure()?.errorText}`);
});

await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Beğen", exact: true }).click();
await page.getByRole("heading", { name: "Eşleştiniz!" }).waitFor();
const firstMatch = await page.getByText(/Sen ve Defne/).isVisible();
await page.getByRole("button", { name: "Kaydırmaya devam et" }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Geç" }).click();
const secondProfile = await page.getByRole("img", { name: /Lara, 26/ }).isVisible();
await page.getByRole("button", { name: "Beğen", exact: true }).click();
await page.getByRole("heading", { name: "Eşleştiniz!" }).waitFor();
const secondMatch = await page.getByText(/Sen ve Lara/).isVisible();
await page.waitForTimeout(350);
await page.screenshot({ path: "tmp/lovask-discovery-match.png", fullPage: true });

console.log(JSON.stringify({ firstMatch, secondProfile, secondMatch, events }, null, 2));
await browser.close();
