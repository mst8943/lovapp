import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const paths = ["/", "/demo", "/login", "/blog", "/download", "/noir"];
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
  serviceWorkers: "block",
});
const results = [];

for (const path of paths) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const axe = await page.evaluate(async () => {
    const report = await window.axe.run(document, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: true } },
    });
    return report.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.slice(0, 8).map((node) => ({ target: node.target, summary: node.failureSummary })),
      nodeCount: violation.nodes.length,
    }));
  });
  await page.keyboard.press("Tab");
  const keyboard = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    label: document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim().slice(0, 80) ?? null,
    focusedBody: document.activeElement === document.body,
  }));
  const motion = await page.evaluate(() => ({
    reducedMotionMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    runningAnimations: document.getAnimations().filter((animation) => animation.playState === "running" && Number(animation.effect?.getTiming().duration ?? 0) > 100).length,
  }));
  results.push({ path, status: response?.status(), violations: axe, keyboard, motion, errors });
  await page.close();
}

if (new URL(baseUrl).hostname === "lovask.com.tr" && existsSync(".env.test.local")) {
  const qa = parseEnv(readFileSync(".env.test.local", "utf8"));
  if (qa.LOVASK_QA_B_EMAIL && qa.LOVASK_QA_B_PASSWORD) {
    const login = await context.request.post(`${baseUrl}/api/auth/password`, {
      headers: { Origin: baseUrl },
      data: { mode: "login", email: qa.LOVASK_QA_B_EMAIL, password: qa.LOVASK_QA_B_PASSWORD },
    });
    if (!login.ok()) {
      results.push({ path: "/?tab=profile", status: login.status(), violations: [], keyboard: { focusedBody: false }, motion: { reducedMotionMatches: true }, errors: ["QA login failed"] });
    } else {
      const page = await context.newPage();
      const response = await page.goto(`${baseUrl}/?tab=profile`, { waitUntil: "networkidle", timeout: 60_000 });
      await page.locator(".profile-v2").waitFor({ timeout: 15_000 });
      await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      const violations = await page.evaluate(async () => {
        const report = await window.axe.run(document.querySelector(".profile-v2"), { runOnly: ["color-contrast"] });
        return report.violations.map((item) => ({ id: item.id, impact: item.impact, nodeCount: item.nodes.length, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
      });
      results.push({ path: "/?tab=profile", status: response?.status(), violations, keyboard: { focusedBody: false }, motion: { reducedMotionMatches: true }, errors: [] });
      await page.close();
    }
  }
}

await context.close();
await browser.close();
const seriousOrCritical = results.flatMap((result) => result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).length;
const pass = seriousOrCritical === 0 && results.every((result) => !result.keyboard.focusedBody && result.motion.reducedMotionMatches && result.errors.length === 0);
console.log(JSON.stringify({ baseUrl, pass, seriousOrCritical, results }, null, 2));
if (!pass) process.exitCode = 1;
