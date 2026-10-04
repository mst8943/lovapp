import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const label = process.argv[3] ?? "current";
const includeAuthenticatedOnboarding = process.argv.includes("--auth");
const outputDir = `artifacts/ui-ux/${label}`;
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block" });
const page = await context.newPage();
const events = [];
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass, detail });
page.on("pageerror", (error) => events.push(`pageerror:${error.message}`));
page.on("requestfailed", (request) => { if (!request.url().includes("_rsc=")) events.push(`requestfailed:${request.url()}:${request.failure()?.errorText}`); });
const shot = (name) => page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true });
const settle = () => page.waitForTimeout(500);

await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
const discoveryControls = await page.evaluate(() => ({
  nav: [...document.querySelectorAll(".bottom-nav .nav-button span")].map((item) => item.textContent?.trim()),
  actions: [...document.querySelectorAll(".swipe-actions .action-button")].map((item) => ({ label: item.getAttribute("aria-label")?.split(" · ")[0], width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })),
}));
check("navigation.primaryDestinations", JSON.stringify(discoveryControls.nav) === JSON.stringify(["Keşfet", "Beğeniler", "Mesajlar", "Profil"]), discoveryControls.nav);
check("discovery.actionOrder", JSON.stringify(discoveryControls.actions.map((item) => item.label)) === JSON.stringify(["Son kararı geri al", "Geç", "Süper beğeni", "Beğen"]), discoveryControls.actions);
check("discovery.hitAreas", discoveryControls.actions.every((item) => item.width >= 44 && item.height >= 44), discoveryControls.actions);
await shot("discovery-390");
await page.getByRole("button", { name: "Profilleri listele" }).click();
await page.getByRole("heading", { name: "Keşfet" }).waitFor();
await settle();
await shot("discovery-grid-390");
await page.getByRole("button", { name: "Kart görünümüne dön" }).click();
await page.locator(".profile-card").waitFor();
await page.locator(".profile-card").click();
await page.getByRole("button", { name: "Profili kapat" }).waitFor();
await settle();
await shot("profile-detail-390");
await page.getByRole("button", { name: "Profili kapat" }).click();
await settle();
await page.locator(".action-button.like").click();
await page.getByRole("heading", { name: "Eşleştiniz!" }).waitFor();
check("match.dismissibleDialog", await page.getByRole("dialog").isVisible() && await page.getByRole("button", { name: "Eşleşme ekranını kapat" }).isVisible());
await settle();
await shot("match-modal-390");
await page.getByRole("button", { name: /devam et/i }).click();
await settle();
await page.getByRole("button", { name: "Beğeniler" }).click();
await settle();
await shot("likes-390");
await page.getByRole("button", { name: "Mesajlar" }).click();
await settle();
await shot("matches-messages-390");
const conversation = page.locator("button.conversation").first();
if (await conversation.count()) {
  await conversation.click();
  await page.getByRole("textbox", { name: "Mesaj" }).waitFor();
  await settle();
  await shot("chat-390");
  await page.getByRole("button", { name: "Mesajlara dön" }).click();
}
await page.getByRole("button", { name: "Profil", exact: true }).click();
await page.getByText("Profili düzenle", { exact: true }).waitFor();
await shot("profile-settings-390");
await page.goto(`${baseUrl}/noir`, { waitUntil: "networkidle" });
await settle();
await shot("premium-390");

await page.setViewportSize({ width: 360, height: 800 });
await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
await shot("discovery-360");
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
await shot("discovery-768");
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
await shot("discovery-1440");

try { process.loadEnvFile(".env.production.local"); } catch {}
try { process.loadEnvFile(".env.test.local"); } catch {}
if (includeAuthenticatedOnboarding && process.env.LOVASK_QA_A_PASSWORD) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("E-posta").fill("qa-erkek-test@lovask.com.tr");
  await page.locator('input[autocomplete="current-password"]').fill(process.env.LOVASK_QA_A_PASSWORD);
  await page.locator("form").getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 });
  await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle" });
  await shot("onboarding-390");
}

await browser.close();
console.log(JSON.stringify({ outputDir, pass: events.length === 0 && checks.every((item) => item.pass), checks, events }));
if (events.length || checks.some((item) => !item.pass)) process.exitCode = 1;
