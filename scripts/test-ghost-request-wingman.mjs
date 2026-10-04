import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = { ...parseEnv(readFileSync('.env.production.local', 'utf8')), ...parseEnv(readFileSync('.env.test.local', 'utf8')) };
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
async function qa(kind) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  const { data, error } = await client.auth.signInWithPassword({ email: env[`LOVASK_${kind}_EMAIL`], password: env[`LOVASK_${kind}_PASSWORD`] });
  assert.ifError(error);
  const { data: profile, error: profileError } = await admin.from('profiles').select('id,ghost_enabled').eq('user_id', data.user.id).single();
  assert.ifError(profileError);
  return { client, profile };
}

const [a, b] = await Promise.all([qa('QA_A'), qa('QA_B')]);
const { data: entitlement } = await admin.from('user_entitlements').select('*').eq('profile_id', a.profile.id).maybeSingle();
const { data: originalSwipe } = await admin.from('swipes').select('*').eq('swiper_id', a.profile.id).eq('target_id', b.profile.id).maybeSingle();
const pair = [a.profile.id, b.profile.id].sort();
const { data: originalMatch } = await admin.from('matches').select('*').eq('user_a', pair[0]).eq('user_b', pair[1]).maybeSingle();
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const { data: originalUsage } = await admin.from('wingman_daily_usage').select('*').eq('profile_id', a.profile.id).eq('usage_date', date).maybeSingle();
let createdMatchId;
try {
  assert.ifError((await admin.from('swipes').delete().eq('swiper_id', a.profile.id).eq('target_id', b.profile.id)).error);
  assert.ifError((await admin.from('user_entitlements').upsert({ profile_id: a.profile.id, noir_until: new Date(Date.now() + 86_400_000).toISOString(), source: 'qa_test' })).error);
  assert.ifError((await admin.from('profiles').update({ ghost_enabled: true }).eq('id', a.profile.id)).error);
  const hidden = await b.client.rpc('ghost_allows', { viewer_uuid: b.profile.id, target_uuid: a.profile.id });
  assert.ifError(hidden.error); assert.equal(hidden.data, false);
  assert.ifError((await admin.from('swipes').insert({ swiper_id: a.profile.id, target_id: b.profile.id, direction: 'right' })).error);
  const visible = await b.client.rpc('ghost_allows', { viewer_uuid: b.profile.id, target_uuid: a.profile.id });
  assert.ifError(visible.error); assert.equal(visible.data, true);

  const request = { status: 'active', connection_type: 'message_request', request_sender_id: a.profile.id, request_status: 'pending', request_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() };
  const changed = originalMatch
    ? await admin.from('matches').update(request).eq('id', originalMatch.id).select('id,request_expires_at').single()
    : await admin.from('matches').insert({ ...request, user_a: pair[0], user_b: pair[1] }).select('id,request_expires_at').single();
  assert.ifError(changed.error);
  if (!originalMatch) createdMatchId = changed.data.id;
  const remainingMs = new Date(changed.data.request_expires_at).getTime() - Date.now();
  assert.ok(remainingMs > 23 * 3_600_000 && remainingMs <= 24 * 3_600_000);

  assert.ifError((await admin.from('wingman_daily_usage').delete().eq('profile_id', a.profile.id).eq('usage_date', date)).error);
  for (let i = 0; i < 3; i++) {
    const result = await a.client.rpc('reserve_wingman_request');
    assert.ifError(result.error); assert.equal(result.data, true);
  }
  const limited = await a.client.rpc('reserve_wingman_request');
  assert.ifError(limited.error); assert.equal(limited.data, false);
  console.log('Ghost visibility, 24-hour request expiry, and Wingman daily limit passed.');
} finally {
  if (createdMatchId) await admin.from('matches').delete().eq('id', createdMatchId);
  if (originalMatch) await admin.from('matches').update({ status: originalMatch.status, connection_type: originalMatch.connection_type, request_sender_id: originalMatch.request_sender_id, request_status: originalMatch.request_status, request_expires_at: originalMatch.request_expires_at, closed_at: originalMatch.closed_at }).eq('id', originalMatch.id);
  await admin.from('swipes').delete().eq('swiper_id', a.profile.id).eq('target_id', b.profile.id);
  if (originalSwipe) await admin.from('swipes').insert({ swiper_id: originalSwipe.swiper_id, target_id: originalSwipe.target_id, direction: originalSwipe.direction, created_at: originalSwipe.created_at });
  await admin.from('profiles').update({ ghost_enabled: a.profile.ghost_enabled }).eq('id', a.profile.id);
  if (entitlement) await admin.from('user_entitlements').upsert(entitlement);
  else await admin.from('user_entitlements').delete().eq('profile_id', a.profile.id);
  if (originalUsage) await admin.from('wingman_daily_usage').upsert(originalUsage);
  else await admin.from('wingman_daily_usage').delete().eq('profile_id', a.profile.id).eq('usage_date', date);
}
