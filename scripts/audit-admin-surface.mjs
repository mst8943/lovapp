import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const env = Object.fromEntries((await readFile(".env.test.local", "utf8")).split(/\r?\n/).filter((line) => line.includes("=")).map((line) => {
  const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).trim()];
}));
const base = process.env.LOVASK_BASE_URL ?? "http://127.0.0.1:3000";
const pages = ["/admin/lovask-control", "/admin/lovask-control/applications", "/admin/lovask-control/users", "/admin/lovask-control/bots", "/admin/lovask-control/conversations", "/admin/lovask-control/payments", "/admin/lovask-control/reports", "/admin/lovask-control/support", "/admin/lovask-control/blog", "/admin/lovask-control/growth", "/admin/lovask-control/settings", "/admin/lovask-control/health", "/admin/lovask-control/photos"];
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.getByLabel("E-posta").fill(env.LOVASK_OWNER_EMAIL);
await page.locator('input[autocomplete="current-password"]').fill(env.LOVASK_OWNER_PASSWORD);
await page.locator("form").getByRole("button", { name: "Giriş yap" }).click();
await page.waitForURL((url) => url.pathname !== "/login");
const statuses = {};
for (const path of pages) statuses[path] = (await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60_000 }))?.status() ?? 0;
const growthResponse = await page.request.get(`${base}/api/admin/growth`);
const growth = await growthResponse.json().catch(() => ({}));
const invalidWebhook = await page.request.post(`${base}/api/shopier/webhook`, { data: {} });
const invalidAdminPayload = await page.request.post(`${base}/api/admin/health`, { data: { broken: true } });
const result = { pages: statuses, allPages200: Object.values(statuses).every((status) => status === 200), growthApi: growthResponse.status(), growthDataReady: Boolean(growth.totals && Array.isArray(growth.productFunnel)), invalidWebhook: invalidWebhook.status(), invalidAdminPayload: invalidAdminPayload.status(), errors };
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!result.allPages200 || !result.growthDataReady || result.invalidWebhook < 400 || result.invalidAdminPayload < 400 || errors.length) process.exitCode = 1;
