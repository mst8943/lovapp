import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const base = process.env.LOVASK_CAPTURE_URL ?? 'https://lovask.com.tr';
const output = 'apps/mobile/build/parity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${output}/web-login.png` });
  if (process.env.LOVASK_TEST_EMAIL && process.env.LOVASK_TEST_PASSWORD) {
    const login = await context.request.post(`${base}/api/auth/password`, {
      headers: { Origin: process.env.LOVASK_AUTH_ORIGIN ?? base },
      data: { mode: 'login', email: process.env.LOVASK_TEST_EMAIL, password: process.env.LOVASK_TEST_PASSWORD },
    });
    if (!login.ok()) throw new Error(`Login failed: ${login.status()}`);
    for (const tab of ['swipe', 'discover', 'likes', 'messages', 'profile']) {
      await page.goto(`${base}/?tab=${tab}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${output}/web-${tab}.png` });
      console.log(`Captured ${tab}: horizontal overflow=${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`);
    }
    await page.goto(`${base}/noir`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${output}/web-noir.png` });
  }
} finally { await browser.close(); }
