import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = { ...parseEnv(readFileSync('.env.production.local', 'utf8')), ...parseEnv(readFileSync('.env.test.local', 'utf8')) };
const base = process.argv[2] ?? 'https://lovask.com.tr';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
async function login(kind) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  const { data, error } = await client.auth.signInWithPassword({ email: env[`LOVASK_${kind}_EMAIL`], password: env[`LOVASK_${kind}_PASSWORD`] });
  assert.ifError(error);
  const { data: profile, error: profileError } = await admin.from('profiles').select('id,ghost_enabled').eq('user_id', data.user.id).single();
  assert.ifError(profileError);
  return { session: data.session, profile };
}
function cookie(session) {
  const name = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  return Array.from({ length: Math.ceil(value.length / 3180) }, (_, i) => `${name}${value.length > 3180 ? `.${i}` : ''}=${value.slice(i * 3180, (i + 1) * 3180)}`).join('; ');
}
async function request(session, path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Cookie: cookie(session), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}

const [a, b] = await Promise.all([login('QA_A'), login('QA_B')]);
const pair = [a.profile.id, b.profile.id].sort();
const { data: originalMatch } = await admin.from('matches').select('*').eq('user_a', pair[0]).eq('user_b', pair[1]).maybeSingle();
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const { data: originalUsage } = await admin.from('wingman_daily_usage').select('*').eq('profile_id', a.profile.id).eq('usage_date', date).maybeSingle();
let createdMatchId;
try {
  const account = await request(a.session, '/api/profile/account');
  assert.equal(account.status, 200, JSON.stringify(account.data));
  assert.equal(typeof account.data.profile.ghost_enabled, 'boolean');
  const changed = originalMatch
    ? await admin.from('matches').update({ status: 'active', connection_type: 'matched', request_status: null, request_expires_at: null, closed_at: null }).eq('id', originalMatch.id).select('id').single()
    : await admin.from('matches').insert({ user_a: pair[0], user_b: pair[1], status: 'active', connection_type: 'matched' }).select('id').single();
  assert.ifError(changed.error); if (!originalMatch) createdMatchId = changed.data.id;
  await admin.from('wingman_daily_usage').delete().eq('profile_id', a.profile.id).eq('usage_date', date);
  const result = await request(a.session, '/api/chat/wingman', 'POST', { profileId: b.profile.id });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.suggestions.length, 3);
  assert.ok(result.data.suggestions.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 140));
  console.log('Live account and Wingman API passed.');
} finally {
  if (createdMatchId) await admin.from('matches').delete().eq('id', createdMatchId);
  if (originalMatch) await admin.from('matches').update({ status: originalMatch.status, connection_type: originalMatch.connection_type, request_sender_id: originalMatch.request_sender_id, request_status: originalMatch.request_status, request_expires_at: originalMatch.request_expires_at, closed_at: originalMatch.closed_at }).eq('id', originalMatch.id);
  if (originalUsage) await admin.from('wingman_daily_usage').upsert(originalUsage);
  else await admin.from('wingman_daily_usage').delete().eq('profile_id', a.profile.id).eq('usage_date', date);
}
