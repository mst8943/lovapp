// Uses existing QA accounts; restores their previous plans and removes test content.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

const env = { ...parseEnv(readFileSync('.env.production.local', 'utf8')), ...parseEnv(readFileSync('.env.test.local', 'utf8')) };
const base = process.argv[2] ?? 'http://127.0.0.1:3015';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(kind) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: env[`LOVASK_${kind}_EMAIL`], password: env[`LOVASK_${kind}_PASSWORD`] });
  assert.ifError(error); return data.session;
}
const [member, other, owner] = await Promise.all(['QA_A', 'QA_B', 'OWNER'].map(login));
async function request(session, path, method = 'GET', body) {
  // Match LovaskApi.webSessionCookie: production accepts the native session cookie.
  const cookieName = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  const chunks = [];
  for (let i = 0; i < cookieValue.length; i += 3180) chunks.push(`${cookieName}${cookieValue.length > 3180 ? `.${i / 3180}` : ''}=${cookieValue.slice(i, i + 3180)}`);
  const response = await fetch(base + path, { method, headers: { Cookie: chunks.join('; '), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const data = await response.json(); return { status: response.status, data };
}
const { data: me } = await admin.from('profiles').select('id').eq('user_id', member.user.id).single();
const { data: peer } = await admin.from('profiles').select('id').eq('user_id', other.user.id).single();
const { data: previous } = await admin.from('meeting_intents').select('*').in('profile_id', [me.id, peer.id]);
let storyId; let optionId; let browser;
try {
  assert.equal((await fetch(base + '/api/meetings')).status, 401);
  assert.equal((await request(member, '/api/admin/community')).status, 403);
  assert.equal((await request(member, '/api/meetings', 'POST', { optionId: 'invalid' })).status, 400);
  optionId = randomUUID();
  const made = await request(owner, '/api/admin/community', 'POST', { action: 'saveOption', id: optionId, label: 'QA geçici plan', icon: 'coffee', active: true, sort_order: 99 });
  assert.equal(made.status, 200);
  const management = await request(owner, '/api/admin/community'); assert.equal(management.status, 200);
  assert.ok(management.data.options.some((o) => o.id === optionId));
  assert.equal((await request(member, '/api/meetings', 'POST', { optionId })).status, 200);
  assert.equal((await request(other, '/api/meetings', 'POST', { optionId })).status, 200);
  const selected = await request(member, '/api/meetings'); assert.equal(selected.status, 200); assert.equal(selected.data.selected.option_id, optionId);
  console.log('API auth, validation and plan persistence passed; eligible peers:', selected.data.profiles.length);
  const png = await sharp({ create: { width: 540, height: 960, channels: 3, background: '#803ab5' } }).png().toBuffer();
  const form = new FormData(); form.set('photo', new Blob([png], { type: 'image/png' }), 'qa-story.png');
  const uploaded = await request(member, '/api/stories', 'POST', form); assert.equal(uploaded.status, 201); storyId = uploaded.data.id;
  assert.equal((await request(other, '/api/stories', 'DELETE', { id: storyId })).status, 404);
  assert.equal((await request(member, '/api/stories', 'PATCH', { id: storyId })).status, 200);
  const stories = await request(member, '/api/stories'); assert.equal(stories.data.stories.find((s) => s.id === storyId).seen, true);
  browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const name = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const value = 'base64-' + Buffer.from(JSON.stringify(member)).toString('base64url');
  const cookies = [];
  for (let i = 0; i < value.length; i += 3180) cookies.push({ name: value.length > 3180 ? `${name}.${i / 3180}` : name, value: value.slice(i, i + 3180), url: base });
  await context.addCookies(cookies);
  const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/?tab=meetings', { waitUntil: 'networkidle', timeout: 90000 });
  if (new URL(base).hostname === '127.0.0.1') await page.addStyleTag({ content: 'nextjs-portal { display:none!important; }' });
  await page.getByRole('button', { name: 'QA geçici plan' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'QA geçici plan' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Planımı kaldır' }).click();
  await page.getByRole('button', { name: 'Planımı kaldır' }).waitFor({ state: 'hidden' });
  assert.equal((await request(member, '/api/meetings')).data.selected, null);
  console.log('Bearer/native save → browser read; browser cancel → bearer/native read passed.');
  mkdirSync('artifacts/community', { recursive: true });
  await page.screenshot({ path: 'artifacts/community/web-meetings.png', fullPage: true });
  await page.getByRole('button', { name: 'Keşfet', exact: true }).last().click();
  await page.getByRole('button', { name: 'Hikayem', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.deck img, .story-photo img')].every((img) => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: 'artifacts/community/web-discovery.png', fullPage: true });
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await page.getByRole('button', { name: 'Liste', exact: true, pressed: true }).waitFor();
  await page.locator('.profile-grid > button').first().waitFor();
  await page.getByRole('button', { name: 'Hikayem', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.profile-grid img')].slice(0, 4).every((img) => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: 'artifacts/community/web-list.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/community/web-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Kaydır', exact: true }).click();
  await page.locator('.deck .profile-card').waitFor();
  await page.screenshot({ path: 'artifacts/community/web-desktop-discovery.png', fullPage: true });
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const ownerValue = 'base64-' + Buffer.from(JSON.stringify(owner)).toString('base64url');
  const ownerCookies = [];
  for (let i = 0; i < ownerValue.length; i += 3180) ownerCookies.push({ name: ownerValue.length > 3180 ? `${name}.${i / 3180}` : name, value: ownerValue.slice(i, i + 3180), url: base });
  await ownerContext.addCookies(ownerCookies);
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(base + '/admin/lovask-control/community', { waitUntil: 'networkidle' });
  await ownerPage.getByRole('heading', { name: 'Buluşma seçenekleri', exact: true }).waitFor();
  await ownerPage.screenshot({ path: 'artifacts/community/admin.png', fullPage: true });
  assert.deepEqual(errors, []);
  assert.equal((await request(owner, '/api/admin/community', 'POST', { action: 'removeStory', id: storyId, reason: 'QA test cleanup' })).status, 200);
  assert.equal((await request(member, '/api/stories')).data.stories.some((s) => s.id === storyId), false);
  storyId = null;
  assert.equal((await request(owner, '/api/admin/community', 'POST', { action: 'saveOption', id: optionId, label: 'QA geçici plan', icon: 'coffee', active: false, sort_order: 99 })).status, 200);
  assert.equal((await request(other, '/api/meetings')).data.selected, null);
  assert.equal((await request(other, '/api/meetings', 'POST', { optionId })).status, 409);
  console.log('Story ownership, shared seen state, admin removal and disabled plan checks passed.');
} finally {
  await browser?.close();
  if (storyId) { const { data } = await admin.from('profile_stories').select('storage_path').eq('id', storyId).maybeSingle(); await admin.from('profile_stories').delete().eq('id', storyId); if (data) await admin.storage.from('profiles').remove([data.storage_path]); }
  await admin.from('meeting_intents').delete().in('profile_id', [me.id, peer.id]);
  if (previous?.length) await admin.from('meeting_intents').upsert(previous);
  if (optionId) await admin.from('meeting_options').delete().eq('id', optionId);
}
