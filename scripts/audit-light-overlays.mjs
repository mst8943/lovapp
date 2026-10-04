import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const scan = async (name) => {
  await page.waitForTimeout(500);
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })));
  assert.deepEqual(violations, [], `${name}: ${JSON.stringify(violations)}`);
};

await page.goto(`${base}/demo?tab=discover`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Keşfet filtreleri" }).click();
const minimum = page.getByRole("slider", { name: "En düşük yaş" });
const maximum = page.getByRole("slider", { name: "En yüksek yaş" });
await minimum.fill("90");
assert.equal(await maximum.inputValue(), "90");
await maximum.fill("25");
assert.equal(await minimum.inputValue(), "25");
await scan("discovery filters");
await page.screenshot({ path: "tmp/light-filter-sheet.png" });

await page.setViewportSize({ width: 1024, height: 900 });
await page.goto(`${base}/demo`, { waitUntil: "networkidle" });
await page.locator(".quest-card").click();
await page.locator(".task-list").waitFor();
await scan("quest sheet");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/demo`, { waitUntil: "networkidle" });
await page.locator(".action-button.star").click();
const continueButton = page.getByRole("button", { name: "Kaydırmaya devam et" });
if (await continueButton.isVisible()) await continueButton.click();
const visibleContinue = page.locator(".match-overlay .ghost-button");
if (await visibleContinue.isVisible()) await visibleContinue.click();
await page.locator(".action-button.star").click();
await page.locator(".allowance-sheet").waitFor();
await scan("allowance sheet");

await page.goto(`${base}/demo?tab=discover`, { waitUntil: "networkidle" });
await page.locator(".profile-grid > button").first().click();
await scan("profile detail");
await page.locator(".profile-detail .safety-trigger").click();
await scan("safety popover");
await page.getByRole("button", { name: "Şikâyet et" }).click();
await scan("safety report dialog");

assert.deepEqual(errors, []);
console.log("Light overlays passed: filter interaction, contrast and six modal/popover states.");
await browser.close();
