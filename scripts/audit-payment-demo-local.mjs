import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
try {
  const page = await browser.newPage({ serviceWorkers: "block" });
  const mutations = [];
  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") mutations.push(route.request().url());
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto(`${baseUrl}/demo?tab=messages`);
  await page.getByRole("button", { name: "Sohbeti sil", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sohbeti sil", exact: true }).click();
  await page.locator(".conversation").waitFor({ state: "detached" });
  assert.deepEqual(mutations, [], "Demo must not mutate real API data");
  await page.route("**/api/noir", async (route) => route.fulfill({ json: {
    plans: [{ slug: "noir-weekly", name: "Haftalık", duration_days: 7, price_amount: 199, currency: "TRY" }],
    orders: [], paymentMethods: [{ method: "papara", enabled: true, papara_number: "123456789" }],
  } }));
  await page.goto(`${baseUrl}/noir`);
  await page.locator(".payment-picker summary").click();
  assert.ok(await page.getByRole("button", { name: "Papara ile öde" }).isVisible());
  await page.locator(".payment-account-details summary").click();
  assert.ok(await page.getByText("123456789", { exact: true }).isVisible());
  await page.route("**/api/noir", async (route) => route.fulfill({ status: 503, json: { error: "Test" } }));
  await page.reload();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement)));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  console.log("PASS: demo isolation, Papara parity, payment dialog keyboard flow");
} finally {
  await browser.close();
}
