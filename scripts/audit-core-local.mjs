import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const targetLabel = ["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname) ? "local" : "live";
const outputDir = "artifacts/test-audit";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const results = {};
const browserEvents = [];

async function withPage(name, run) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => browserEvents.push(`${name}:pageerror:${error.message}`));
  page.on("requestfailed", (request) => {
    if (!request.url().includes("_rsc=")) {
      browserEvents.push(`${name}:requestfailed:${request.url()}:${request.failure()?.errorText}`);
    }
  });
  try {
    results[name] = await run(page);
  } catch (error) {
    results[name] = { pass: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await context.close();
  }
}

await withPage("publicAndHeaders", async (page) => {
  const paths = ["/", "/demo", "/login", "/blog", "/download", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];
  const statuses = {};
  for (const path of paths) {
    const response = await page.request.get(`${baseUrl}${path}`);
    statuses[path] = response.status();
  }
  const home = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
  const headers = home?.headers() ?? {};
  const effectivePermissions = await page.evaluate(() => {
    const policy = document.permissionsPolicy ?? document.featurePolicy;
    return policy ? {
      camera: policy.allowsFeature("camera"),
      microphone: policy.allowsFeature("microphone"),
      geolocation: policy.allowsFeature("geolocation"),
    } : null;
  });
  return {
    pass: Object.values(statuses).every((status) => status === 200)
      && headers["x-content-type-options"] === "nosniff"
      && headers["x-frame-options"] === "DENY",
    statuses,
    headers: {
      contentTypeOptions: headers["x-content-type-options"],
      frameOptions: headers["x-frame-options"],
      referrerPolicy: headers["referrer-policy"],
      permissionsPolicy: headers["permissions-policy"],
      contentSecurityPolicy: headers["content-security-policy"],
    },
    effectivePermissions,
  };
});

await withPage("discovery", async (page) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 480, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle", timeout: 60_000 });
    // Trial clicks check real hit targets without changing the demo deck.
    for (const button of [".rewind", ".reject", ".like", ".star"]) {
      await page.locator(`.swipe-actions ${button}`).click({ trial: true, timeout: 5_000 });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle", timeout: 60_000 });
  const like = page.getByRole("button", { name: /^Beğen(?: — .+)?$/ });
  await like.click();
  const matchHeading = page.getByRole("heading", { name: "Eşleştiniz!" });
  await matchHeading.waitFor({ state: "visible", timeout: 5_000 });
  const matched = await matchHeading.isVisible();
  await page.screenshot({ path: `${outputDir}/${targetLabel}-discovery-match.png`, fullPage: true });
  return { pass: matched, matched };
});

await withPage("messaging", async (page) => {
  await page.goto(`${baseUrl}/demo?tab=messages`, { waitUntil: "networkidle", timeout: 60_000 });
  const heading = await page.getByRole("heading", { name: "Mesajlar" }).isVisible();
  await page.locator(".conversation").first().click();
  const message = `Yerel smoke ${Date.now()}`;
  await page.getByRole("textbox", { name: "Mesaj" }).fill(message);
  await page.getByRole("button", { name: "Gönder" }).click();
  const outgoing = await page.getByText(message).isVisible();
  await page.screenshot({ path: `${outputDir}/${targetLabel}-demo-message.png`, fullPage: true });
  return { pass: heading && outgoing, heading, outgoing };
});

await withPage("onboardingDemo", async (page) => {
  const response = await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle", timeout: 60_000 });
  const identity = await page.getByRole("heading", { name: /Sana nasıl/ }).isVisible();
  const next = page.getByRole("button", { name: /Devam et/ });
  const nextVisible = await next.isVisible();
  const redirectedToLogin = new URL(page.url()).pathname === "/login";
  await page.screenshot({ path: `${outputDir}/${targetLabel}-onboarding.png`, fullPage: true });
  return {
    pass: (response?.status() === 200 && identity && nextVisible) || redirectedToLogin,
    status: response?.status(),
    identity,
    nextVisible,
    redirectedToLogin,
    finalUrl: page.url(),
  };
});

await withPage("authorizationGuards", async (page) => {
  const checks = {};
  for (const [name, path] of Object.entries({
    adminHealth: "/api/admin/health",
    adminBots: "/api/admin/bots",
    botWorker: "/api/internal/bot-worker",
    notifications: "/api/notifications",
  })) {
    const response = await page.request.get(`${baseUrl}${path}`);
    checks[name] = response.status();
  }
  return {
    pass: [401, 503].includes(checks.adminHealth)
      && checks.adminBots === 401
      && checks.botWorker === 401
      && checks.notifications === 401,
    checks,
    note: checks.adminHealth === 503 ? "Owner health authorization is not testable without a local service-role configuration." : undefined,
  };
});

await browser.close();
const pass = Object.values(results).every((result) => result.pass) && browserEvents.length === 0;
console.log(JSON.stringify({ baseUrl, pass, results, browserEvents }, null, 2));
if (!pass) process.exitCode = 1;
