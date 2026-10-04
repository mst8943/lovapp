// Run against a local Next dev server. API writes are intercepted, including deletion.
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local dev server required');
const directory = new URL('../app/ui-profile-audit/', import.meta.url);
const file = new URL('page.tsx', directory);
await mkdir(directory, { recursive: true });
await writeFile(file, `import { LovaskProfileView } from '@/components/lovask-profile-view';
import '@/components/lovask-app.css';
import '@/components/lovask-app-light.css';
export default function Page() { return <main className="app-stage"><div className="app-shell"><LovaskProfileView liveMode viewer={{name:'Deniz Uzunisimli Kullanıcı',age:27,city:'İstanbul',image:'/profiles/lara.webp',xp:1840,level:5,matchCount:12,likeCount:47,unreadLikeCount:0,unreadSuperLikeCount:0,badges:['Kahve sever'],prompt:'Birlikte',answer:'Sahil yürüyüşü',isAdmin:false,isNoir:true}} /></div></main>; }
`, { flag: 'wx' });
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'ready', { value: Promise.resolve({ pushManager: { getSubscription: async () => ({ endpoint: 'mock-endpoint' }) } }) });
  });
  let fail = true;
  let tickets = [];
  let blocked = [{ blocked_id: 'blocked-user', profiles: { display_name: 'Engellenen kişi' } }];
  const calls = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const data = request.postDataJSON();
    calls.push({ path, method, data });
    let body = {};
    let status = 200;
    if (method !== 'GET' && fail) { status = 503; body = { error: 'Test bağlantı hatası' }; }
    else if (path === '/api/profile/support') {
      if (method === 'POST') tickets = [{ id: 'ticket-1', ...data, status: 'open', created_at: new Date().toISOString(), last_message_at: new Date().toISOString(), support_ticket_messages: [{ body: data.message, sender_admin_id: null, created_at: new Date().toISOString() }] }];
      if (method === 'PATCH') tickets[0].support_ticket_messages.push({ body: data.message, sender_admin_id: null, created_at: new Date().toISOString() });
      body = { tickets };
    } else if (path === '/api/push/preferences') body = { preferences: { quiet_hours_enabled: true, quiet_start: '23:00', quiet_end: '09:00' } };
    else if (path === '/api/safety') { if (method === 'POST') blocked = []; body = { blocked }; }
    else if (path === '/api/profile/visitors') body = { premium: true, count: 0, visitors: [] };
    else if (path === '/api/profile/referrals') body = { code: 'TEST', shareUrl: base, activations: 0, earnedDays: 0 };
    await route.fulfill({ status, json: body });
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await page.goto(base + '/ui-profile-audit', { waitUntil: 'networkidle' });
    if (response.ok()) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const visibility = page.getByRole('switch', { name: 'Keşfet görünürlüğü' });
  await visibility.click();
  await page.getByText('Test bağlantı hatası', { exact: true }).waitFor();
  assert.equal(await visibility.getAttribute('aria-checked'), 'true');
  fail = false;
  await visibility.click();
  await page.getByText('Profilin keşfetten gizlendi. Mevcut sohbetlerin devam eder.', { exact: true }).waitFor();
  assert.equal(await visibility.getAttribute('aria-checked'), 'false');

  await page.getByRole('button', { name: 'Sessiz saatleri ayarla' }).click();
  await page.locator('input[type=time]').first().fill('22:30');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await page.getByText('Sessiz saatler kaydedildi.', { exact: true }).waitFor();
  assert.equal(calls.find(c => c.path === '/api/push/preferences' && c.method === 'PATCH').data.quietStart, '22:30');

  await page.getByRole('button', { name: /Yardım ve destek/ }).click();
  await page.getByRole('button', { name: 'Yeni talep' }).click();
  await page.locator('[name=subject]').fill('Test destek talebi');
  await page.locator('[name=message]').fill('Yazılan metin hata olunca korunmalı.');
  fail = true;
  await page.getByRole('button', { name: 'Talep gönder' }).click();
  await page.locator('.hub-support-notice').filter({ hasText: 'Test bağlantı hatası' }).waitFor();
  assert.equal(await page.locator('[name=message]').inputValue(), 'Yazılan metin hata olunca korunmalı.');
  fail = false;
  await page.getByRole('button', { name: 'Talep gönder' }).click();
  await page.getByRole('button', { name: /Test destek talebi/ }).click();
  const reply = page.getByRole('textbox', { name: 'Destek talebine yanıt' });
  await reply.fill('Bu yanıt kaybolmamalı.');
  fail = true;
  await page.getByRole('button', { name: 'Yanıtı gönder' }).click();
  await page.locator('.hub-support-notice').filter({ hasText: 'Test bağlantı hatası' }).waitFor();
  assert.equal(await reply.inputValue(), 'Bu yanıt kaybolmamalı.');
  fail = false;
  await page.getByRole('button', { name: 'Yanıtı gönder' }).click();
  await page.locator('.hub-thread-bubble p').filter({ hasText: 'Bu yanıt kaybolmamalı.' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Destek talebine yanıt' }).inputValue(), '');

  await page.getByRole('button', { name: /Engellenen profiller/ }).click();
  fail = true;
  await page.getByRole('button', { name: 'Engeli kaldır', exact: true }).click();
  await page.getByText('Engel kaldırılamadı. Tekrar dene.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Engellenen kişi', { exact: true }).count(), 1);
  fail = false;
  await page.getByRole('button', { name: 'Engeli kaldır', exact: true }).click();
  await page.getByText('Engellenen kişi', { exact: true }).waitFor({ state: 'detached' });

  await page.getByRole('button', { name: /Hesabımı sil/ }).click();
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByRole('button', { name: 'Hesabımı sil' }).isDisabled(), true);
  await dialog.locator('input').fill('HESABIMI SİL');
  fail = true;
  await dialog.getByRole('button', { name: 'Hesabımı sil' }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(calls.find(c => c.method === 'DELETE').data.confirmation, 'HESABIMI SİL');
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), false);

  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const issues = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
  assert.deepEqual(issues, []);
  assert.deepEqual(errors, []);
  console.log('Profile UI passed: visibility, quiet hours, support create/reply, unblock, deletion confirmation, WCAG A/AA. All API requests mocked.');
} finally {
  await browser?.close();
  await unlink(file);
  await rmdir(directory);
}
