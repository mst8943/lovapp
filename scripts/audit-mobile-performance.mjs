import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const targetLabel = ["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname) ? "local" : "live";
const runs = Number(process.argv[3] ?? 5);
const outputDir = "artifacts/test-audit";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0;
}

const samples = [];
for (let index = 0; index < runs; index += 1) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__auditVitals = { cls: 0, lcp: 0, maxEventDuration: 0, longTasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__auditVitals.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__auditVitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    if (PerformanceObserver.supportedEntryTypes.includes("event")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__auditVitals.maxEventDuration = Math.max(window.__auditVitals.maxEventDuration, entry.duration);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    }
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__auditVitals.longTasks.push(entry.duration);
      }).observe({ type: "longtask", buffered: true });
    }
  });
  const session = await context.newCDPSession(page);
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const startedAt = Date.now();
  const response = await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle", timeout: 60_000 });
  const networkIdleMs = Date.now() - startedAt;
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    window.__auditFrames = [];
    let previous = performance.now();
    const sample = (now) => {
      window.__auditFrames.push(now - previous);
      previous = now;
      if (window.__auditFrames.length < 180) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const interactionStarted = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: /^Beğen(?: — .+)?$/ }).click();
  await page.getByRole("heading", { name: "Eşleştiniz!" }).waitFor();
  const interactionMs = await page.evaluate((started) => performance.now() - started, interactionStarted);
  await page.waitForTimeout(900);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const scripts = performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "script");
    const frames = window.__auditFrames ?? [];
    return {
      ttfb: navigation?.responseStart ?? 0,
      domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
      load: navigation?.loadEventEnd ?? 0,
      jsTransferBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      requestCount: performance.getEntriesByType("resource").length,
      lcp: window.__auditVitals.lcp,
      cls: window.__auditVitals.cls,
      inp: window.__auditVitals.maxEventDuration,
      maxLongTask: Math.max(0, ...window.__auditVitals.longTasks),
      frameP95: frames.length ? frames.slice().sort((a, b) => a - b)[Math.ceil(frames.length * 0.95) - 1] : 0,
      maxFrame: Math.max(0, ...frames),
    };
  });
  samples.push({ run: index + 1, status: response?.status(), networkIdleMs, interactionMs, ...metrics });
  if (index === 0) await page.screenshot({ path: `${outputDir}/mobile-performance-${targetLabel}.png`, fullPage: true });
  await context.close();
}

const overflows = [];
for (const width of [320, 360, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 760 }, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/demo?tab=messages`, { waitUntil: "networkidle", timeout: 60_000 });
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    body: document.body.scrollWidth,
    html: document.documentElement.scrollWidth,
    shell: document.querySelector(".app-shell")?.scrollWidth ?? 0,
  }));
  overflows.push({ width, ...layout, pass: Math.max(layout.body, layout.html, layout.shell) <= width });
  await page.close();
}

await browser.close();
const summary = {
  lcpP95: percentile(samples.map((sample) => sample.lcp), 0.95),
  clsP95: percentile(samples.map((sample) => sample.cls), 0.95),
  inpP95: percentile(samples.map((sample) => sample.inp), 0.95),
  jsTransferP95: percentile(samples.map((sample) => sample.jsTransferBytes), 0.95),
  frameP95: percentile(samples.map((sample) => sample.frameP95), 0.95),
  maxFrame: Math.max(...samples.map((sample) => sample.maxFrame)),
  interactionP95: percentile(samples.map((sample) => sample.interactionMs), 0.95),
};
const thresholds = {
  lcp: summary.lcpP95 <= 2500,
  cls: summary.clsP95 <= 0.1,
  inp: summary.inpP95 <= 200,
  jsTransfer: summary.jsTransferP95 <= 215_500 * 1.1,
  frameP95: summary.frameP95 <= 20,
  maxFrame: summary.maxFrame <= 120,
  layout: overflows.every((result) => result.pass),
};
const pass = Object.values(thresholds).every(Boolean);
console.log(JSON.stringify({ baseUrl, runs, pass, thresholds, summary, samples, overflows }, null, 2));
if (!pass) process.exitCode = 1;
