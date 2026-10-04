import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = { ...parseEnv(readFileSync('.env.production.local', 'utf8')), ...parseEnv(readFileSync('.env.test.local', 'utf8')) };
const base = process.argv[2] ?? 'http://127.0.0.1:3015';
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(kind) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: env[`LOVASK_${kind}_EMAIL`], password: env[`LOVASK_${kind}_PASSWORD`] });
  assert.ifError(error);
  return data.session;
}
async function request(session, path, method = 'GET', body) {
  const name = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  const cookies = [];
  for (let i = 0; i < value.length; i += 3180) cookies.push(`${name}${value.length > 3180 ? `.${i / 3180}` : ''}=${value.slice(i, i + 3180)}`);
  const response = await fetch(base + path, { method, headers: { Cookie: cookies.join('; '), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}

const [a, b, owner] = await Promise.all(['QA_A', 'QA_B', 'OWNER'].map(login));
const { data: people, error: peopleError } = await admin.from('profiles').select('id,user_id').in('user_id', [a.user.id, b.user.id]);
assert.ifError(peopleError);
const me = people.find((person) => person.user_id === a.user.id).id;
const peer = people.find((person) => person.user_id === b.user.id).id;
const [user_a, user_b] = [me, peer].sort();
const { data: existing } = await admin.from('matches').select('*').eq('user_a', user_a).eq('user_b', user_b).maybeSingle();
let matchId = existing?.id;
const original = existing ? { status: existing.status, connection_type: existing.connection_type, request_status: existing.request_status, request_sender_id: existing.request_sender_id, request_expires_at: existing.request_expires_at } : null;
const createdIds = [];
let temporaryVoicePath;
let didUploadVoice = false;
try {
  if (existing) {
    const { error } = await admin.from('matches').update({ status: 'active', connection_type: 'matched', request_status: null, request_sender_id: null, request_expires_at: null }).eq('id', matchId);
    assert.ifError(error);
  } else {
    const { data, error } = await admin.from('matches').insert({ user_a, user_b, status: 'active', connection_type: 'matched' }).select('id').single();
    assert.ifError(error); matchId = data.id;
  }
  const originalId = randomUUID();
  const { error: insertError } = await admin.from('messages').insert({ id: originalId, match_id: matchId, sender_id: me, kind: 'text', body: 'QA geçici mesaj' });
  assert.ifError(insertError); createdIds.push(originalId);
  assert.equal((await request(b, '/api/chat/message', 'DELETE', { messageId: originalId })).status, 403);
  assert.equal((await request(b, '/api/chat/message', 'PATCH', { messageId: originalId, emoji: '❤️' })).status, 200);
  const history = await request(a, `/api/chat?profileId=${peer}`);
  assert.equal(history.status, 200, JSON.stringify(history.data));
  assert.ok(history.data.messages.find((item) => item.id === originalId)?.reactions.some((item) => item.emoji === '❤️'));
  const reply = await request(a, '/api/chat', 'POST', { profileId: peer, message: 'QA yanıt', clientId: randomUUID(), replyToId: originalId });
  assert.ok([201, 202].includes(reply.status), JSON.stringify(reply.data));
  createdIds.push(reply.data.userMessageId);
  const afterReply = await request(b, `/api/chat?profileId=${me}`);
  assert.equal(afterReply.data.messages.find((item) => item.id === reply.data.userMessageId)?.replyToId, originalId);
  assert.equal((await request(a, '/api/chat/message', 'DELETE', { messageId: originalId })).status, 200);
  const afterDelete = await request(b, `/api/chat?profileId=${me}`);
  const tombstone = afterDelete.data.messages.find((item) => item.id === originalId);
  assert.equal(tombstone.deleted, true);
  assert.equal(tombstone.text, 'Mesaj silindi');
  assert.equal((await request(a, '/api/chat/message', 'PATCH', { messageId: originalId, emoji: '👍' })).status, 409);
  assert.equal((await request(a, '/api/profile/voice')).status, 200);
  assert.equal((await request(a, '/api/admin/users/' + me)).status, 403);
  assert.equal((await request(owner, '/api/admin/users/' + me)).status, 200);
  const { data: priorVoice } = await admin.from('profile_voice_prompts').select('audio_path').eq('profile_id', me).maybeSingle();
  if (!priorVoice) {
    temporaryVoicePath = join(tmpdir(), `lovask-qa-${randomUUID()}.mp3`);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=16', '-b:a', '32k', temporaryVoicePath]);
    const form = new FormData();
    form.set('prompt', 'Beni güldürmenin yolu…');
    form.set('durationMs', '16000');
    form.set('audio', new Blob([readFileSync(temporaryVoicePath)], { type: 'audio/mpeg' }), 'qa.mp3');
    const uploaded = await request(a, '/api/profile/voice', 'POST', form);
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
    didUploadVoice = true;
    const voice = await request(a, '/api/profile/voice');
    assert.equal(voice.data.voice.prompt, 'Beni güldürmenin yolu…');
    assert.equal((await fetch(voice.data.voice.audioUrl)).status, 200);
    assert.ok((await request(owner, '/api/admin/users/' + me)).data.user.voiceUrl);
    assert.equal((await request(owner, '/api/admin/users/' + me, 'PATCH', { action: 'remove_voice' })).status, 200);
    assert.equal((await request(a, '/api/profile/voice')).data.voice, null);
  }
  console.log('Chat reply, reaction, owner delete, tombstone, voice upload/playback and admin removal passed.');
} finally {
  if (temporaryVoicePath) { try { unlinkSync(temporaryVoicePath); } catch {} }
  if (didUploadVoice) {
    const { data: testVoice } = await admin.from('profile_voice_prompts').select('audio_path').eq('profile_id', me).maybeSingle();
    if (testVoice?.audio_path) { await admin.from('profile_voice_prompts').delete().eq('profile_id', me); await admin.storage.from('voice-messages').remove([testVoice.audio_path]); }
  }
  if (createdIds.length) await admin.from('messages').delete().in('id', createdIds.filter(Boolean));
  if (existing) await admin.from('matches').update(original).eq('id', matchId);
  else if (matchId) await admin.from('matches').delete().eq('id', matchId);
}
