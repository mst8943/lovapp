import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.LOVASK_BASE_URL ?? 'https://lovask.com.tr';
const audit = JSON.parse(await readFile('tmp/lovask-match-push-audit.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  ignoreDefaultArgs: ['--disable-background-networking'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.grantPermissions(['notifications'], { origin: base });
const page = await context.newPage();
const result = { checks: {}, errors: [] };
page.on('pageerror', error => result.errors.push(error.message));
const pushResponses = [];
page.on('response', async response => {
  if (response.url().includes('/api/push/')) pushResponses.push({ url: response.url(), status: response.status(), body: await response.json().catch(() => null) });
});
try {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-posta', { exact: true }).fill(audit.email);
  await page.locator('input[autocomplete="current-password"]').fill(audit.password);
  await page.locator('form').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/');
  const like = await context.request.post(`${base}/api/discovery`, { data: { targetProfileId: audit.botId, direction: 'right' } });
  const likeBody = await like.json();
  result.checks.reciprocalBotMatch = (like.status() === 200 && likeBody.matched === true && Boolean(likeBody.matchId)) || like.status() === 409;
  const conversations = await context.request.get(`${base}/api/conversations`);
  const conversationBody = await conversations.json();
  result.checks.matchListed = conversations.status() === 200 && conversationBody.conversations?.some(item => item.profile.id === audit.botId && item.matched === true);
  const auditMessage = `[AUDIT] ${crypto.randomUUID()}`;
  const clientId = crypto.randomUUID();
  const sent = await context.request.post(`${base}/api/chat`, { data: { profileId: audit.botId, message: auditMessage, clientId } });
  const sentBody = await sent.json();
  result.checks.chatSend = [201, 202].includes(sent.status()) && Boolean(sentBody.userMessageId);
  const history = await context.request.get(`${base}/api/chat?profileId=${audit.botId}`);
  const historyBody = await history.json();
  result.checks.chatHistory = history.status() === 200 && historyBody.messages?.some(item => item.text === auditMessage && item.from === 'me');
  await page.goto(`${base}/?tab=profile`, { waitUntil: 'networkidle' });
  result.checks.matchCount = await page.getByText('1', { exact: true }).first().isVisible();
  const notification = page.getByRole('switch', { name: 'Mesaj bildirimleri' });
  await notification.waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const original = PushManager.prototype.subscribe;
    PushManager.prototype.subscribe = async function(...args) {
      try { return await original.apply(this, args); }
      catch (error) { window.__lovaskPushError = { name: error?.name, message: error?.message }; throw error; }
    };
  });
  if (await notification.getAttribute('aria-checked') !== 'true') await notification.click();
  await page.waitForTimeout(5000);
  result.checks.pushSubscribed = await notification.getAttribute('aria-checked') === 'true';
  result.push = { responses: pushResponses, notice: await page.locator('.profile-feedback').allTextContents(), permission: await page.evaluate(() => Notification.permission), serviceWorker: await page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())), subscribeError: await page.evaluate(() => window.__lovaskPushError ?? null) };
  await page.screenshot({ path: 'artifacts/test-audit/match-push.png', fullPage: true });
} catch (error) {
  result.errors.push(error.stack ?? String(error));
}
await mkdir('artifacts/test-audit', { recursive: true });
await writeFile('artifacts/test-audit/match-push.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (result.errors.length || Object.values(result.checks).some(value => value !== true)) process.exitCode = 1;
