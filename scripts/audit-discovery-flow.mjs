import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.LOVASK_BASE_URL ?? 'https://lovask.com.tr';
const { accounts } = JSON.parse(await readFile('tmp/lovask-flow-audit.json', 'utf8'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const result = { errors: [], consoleErrors: [], responses: [], checks: {} };
page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
page.on('pageerror', error => result.errors.push(error.message));
page.on('response', async response => {
  if (response.url().includes('/api/discovery')) result.responses.push({ path: new URL(response.url()).pathname, method: response.request().method(), status: response.status(), body: await response.json().catch(() => null) });
});
const card = () => page.locator('.profile-card').last().getAttribute('aria-label');
try {
  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('E-posta', { exact: true }).fill(accounts[0].email);
  await page.locator('input[autocomplete="current-password"]').fill(accounts[0].password);
  await page.locator('form').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/');
  await context.request.patch(base + '/api/discovery/preferences', { data: { minAge: 18, maxAge: 99, verifiedOnly: false, interestedGenders: ['kadın'], sameCityOnly: false } });
  await page.reload({ waitUntil: 'networkidle' });
  if (new URL(base).hostname === 'localhost') await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
  await page.locator('.profile-card').first().waitFor();
  await page.waitForLoadState('networkidle');
  result.checks.login = true;
  const first = await card();
  result.checks.initialCard = first;
  const swipeResponse = page.waitForResponse(r => r.url().endsWith('/api/discovery') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Geç', exact: true }).click();
  const swipe = await swipeResponse;
  await page.waitForTimeout(500);
  const after = await card();
  result.checks.reject = { status: swipe.status(), first, after, pass: swipe.ok() && first !== after };
  const deckAfterReject = await (await context.request.get(base + '/api/discovery')).json();
  result.checks.femaleFilter = { pass: deckAfterReject.profiles?.length > 0 && deckAfterReject.profiles.every(profile => profile.gender === 'kadın') };
  await page.route('**/api/discovery', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test bağlantı hatası' }) });
  });
  const failedSwipe = page.waitForResponse(r => r.url().endsWith('/api/discovery') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Geç', exact: true }).click();
  await failedSwipe;
  await page.waitForTimeout(400);
  result.checks.failedSwipeKeepsCard = { pass: await card() === after };
  await page.unroute('**/api/discovery');
  await page.locator('.bottom-nav').getByRole('button', { name: 'Profil', exact: true }).click();
  await page.locator('.profile-screen').waitFor();
  await page.locator('.bottom-nav').getByRole('button', { name: 'Kaydır', exact: true }).click();
  await page.locator('.profile-card').first().waitFor();
  await page.waitForLoadState('networkidle');
  const returned = await card();
  result.checks.tabReturn = { returned, pass: returned !== first };
  const likeResponse = page.waitForResponse(r => r.url().endsWith('/api/discovery') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Beğen', exact: true }).click();
  const liked = await likeResponse;
  await page.waitForTimeout(500);
  result.checks.likeAdvances = { pass: liked.ok() && await card() !== returned, status: liked.status() };
  await page.reload({ waitUntil: 'networkidle' });
  if (new URL(base).hostname === 'localhost') await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
  await page.locator('.profile-card').first().waitFor();
  const reloadedDeck = await (await context.request.get(base + '/api/discovery')).json();
  result.checks.decisionsSurviveReload = { pass: await card() !== first && await card() !== returned && reloadedDeck.profiles.every(p => `${p.name} profilini aç` !== first && `${p.name} profilini aç` !== returned) };
  const targetId = liked.request().postDataJSON().targetProfileId;
  const duplicate = await context.request.post(base + '/api/discovery', { data: { targetProfileId: targetId, direction: 'right' } });
  const duplicateBody = await duplicate.json();
  result.checks.duplicateDecisionRejected = { pass: duplicate.status() === 409 && duplicateBody.code === 'already_swiped' };
  const beforeRewind = await card();
  const rewindResponse = page.waitForResponse(r => r.url().endsWith('/api/discovery') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Son kararı geri al' }).click();
  const rewindResult = await rewindResponse;
  result.checks.standardRewindGuard = { pass: rewindResult.status() === 403 && await card() === beforeRewind };
  for (const [status, code] of [[429, 'like_limit_reached'], [409, 'onboarding_required'], [410, 'target_unavailable']]) {
    const before = await card();
    let calls = 0;
    await page.route('**/api/discovery', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      calls++;
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: `Test ${code}`, code }) });
    });
    const intercepted = page.waitForResponse(r => r.url().endsWith('/api/discovery') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Beğen', exact: true }).evaluate(button => { button.click(); button.click(); });
    await intercepted;
    await page.waitForTimeout(400);
    result.checks[code] = { pass: calls === 1 && (status === 410 ? await card() !== before : await card() === before) };
    await page.unroute('**/api/discovery');
  }
  await page.getByRole('button', { name: 'Keşfet tercihleri', exact: true }).last().click();
  const sheet = page.getByRole('dialog', { name: 'Karşılaşmalarını daralt.' });
  for (const label of ['Kadın', 'Erkek', 'Non-binary', 'Diğer']) {
    const button = sheet.getByRole('button', { name: label, exact: true });
    const selected = (await button.getAttribute('class'))?.includes('selected');
    if (selected !== (label === 'Erkek')) await button.click();
  }
  const save = page.waitForResponse(r => r.url().endsWith('/api/discovery/preferences') && r.request().method() === 'PATCH');
  await sheet.getByRole('button', { name: 'Filtreleri uygula' }).click();
  await save;
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const maleDeck = await (await context.request.get(base + '/api/discovery')).json();
  const names = maleDeck.profiles?.map(p => `${p.name} profilini aç`) ?? [];
  const current = await page.locator('.profile-card').count() ? await card() : null;
  result.checks.maleFilter = { current, count: names.length, pass: maleDeck.profiles?.every(p => p.gender === 'erkek') && (current ? names.includes(current) : names.length === 0) };
  result.checks.emptyDeckRewindVisible = { pass: await page.getByRole('button', { name: 'Son kararı geri al' }).isVisible() };
  for (const tab of ['Keşfet', 'Kaydır']) {
    await page.locator('.bottom-nav').getByRole('button', { name: tab, exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const shown = tab === 'Kaydır' ? await page.locator('.profile-card').count() : await page.locator('.explore-screen .profile-grid').count();
    result.checks[`${tab}FilterPersisted`] = { pass: names.length > 0 || shown === 0, shown };
  }
  await page.screenshot({ path: 'tmp/audit-discovery-flow.png', fullPage: true });
} catch (error) { result.errors.push(error.stack); await page.screenshot({ path: 'tmp/audit-discovery-flow-failed.png', fullPage: true }); }
finally {
  await mkdir('artifacts/test-audit', { recursive: true });
  await writeFile('artifacts/test-audit/discovery-flow.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ errors: result.errors, consoleErrors: result.consoleErrors, checks: result.checks, failedResponses: result.responses.filter(r => r.status >= 400) }, null, 2));
  if (result.errors.length || Object.values(result.checks).some(check => check && typeof check === 'object' && check.pass !== true)) process.exitCode = 1;
  await browser.close();
}
