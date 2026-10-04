import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const events = [];
page.on("pageerror", (error) => events.push(`pageerror:${error.message}`));
page.on("requestfailed", (request) => {
  if (request.failure()?.errorText !== "net::ERR_ABORTED") events.push(`requestfailed:${request.url()} ${request.failure()?.errorText}`);
});

await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle" });
const current = new URL(page.url());
const redirectedToLogin = current.pathname === "/login";
const preservedNext = current.searchParams.get("next") === "/onboarding";
const result = { redirectedToLogin, preservedNext, events };
console.log(JSON.stringify(result, null, 2));
if (!redirectedToLogin || !preservedNext || events.length) process.exitCode = 1;
await browser.close();
