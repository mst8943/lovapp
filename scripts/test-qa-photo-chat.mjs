import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const env = parseEnv(readFileSync(".env.test.local", "utf8"));
const a = { id: env.LOVASK_QA_A_PROFILE_ID, email: env.LOVASK_QA_A_EMAIL, password: env.LOVASK_QA_A_PASSWORD };
const b = { id: env.LOVASK_QA_B_PROFILE_ID, email: env.LOVASK_QA_B_EMAIL, password: env.LOVASK_QA_B_PASSWORD };
assert.equal(a.email, "qa-erkek-test@lovask.com.tr");
assert.equal(b.email, "qa-kadin-test@lovask.com.tr");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [low, high] = [a.id, b.id].sort();
const current = await db.from("matches").select("id", { count: "exact", head: true }).eq("user_a", low).eq("user_b", high);
assert.ifError(current.error);
assert.equal(current.count, 0, "QA pair has an existing match; preserve it");
const before = await db.from("message_daily_usage").select("profile_id,usage_date,sent_count").in("profile_id", [a.id, b.id]);
assert.ifError(before.error);
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signed = await auth.auth.signInWithPassword({ email: a.email, password: a.password });
assert.ifError(signed.error);
const session = signed.data.session;
assert(session);
const recipient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const recipientAuth = await recipient.auth.signInWithPassword({ email: b.email, password: b.password });
assert.ifError(recipientAuth.error);
assert(recipientAuth.data.session);
const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookie = `sb-${host}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
const recipientCookie = `sb-${host}-auth-token=base64-${Buffer.from(JSON.stringify(recipientAuth.data.session)).toString("base64url")}`;
const base = env.LOVASK_BASE_URL || "https://lovask.com.tr";
const clientId = randomUUID();
const imagePath = `${a.id}/${clientId}.webp`;
let matchId;
try {
  const created = await db.from("matches").insert({ user_a: low, user_b: high, status: "active", connection_type: "matched" }).select("id").single();
  assert.ifError(created.error);
  matchId = created.data.id;
  const form = new FormData();
  form.set("matchId", matchId);
  form.set("clientId", clientId);
  form.set("photo", new Blob([readFileSync("public/profiles/mert.webp")], { type: "image/webp" }), "qa-photo.webp");
  const sent = await fetch(`${base}/api/chat/image`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, Cookie: cookie, Origin: base }, body: form, signal: AbortSignal.timeout(30000) });
  const result = await sent.json();
  assert.equal(sent.status, 201, JSON.stringify(result));
  const received = await fetch(`${base}/api/chat?profileId=${a.id}`, { headers: { Authorization: `Bearer ${recipientAuth.data.session.access_token}`, Cookie: recipientCookie }, signal: AbortSignal.timeout(30000) });
  assert.equal(received.status, 200);
  const messages = (await received.json()).messages;
  assert(messages.some((item) => item.id === result.messageId && item.imageUrl), "Photo absent from recipient chat history");
  const storage = await db.storage.from("chat-images").download(imagePath);
  assert.ifError(storage.error);
  assert.equal(storage.data.type, "image/webp");
  console.log("QA photo chat upload, WebP storage and history: PASS");
} finally {
  if (matchId) {
    const removed = await db.from("matches").delete().eq("id", matchId);
    assert.ifError(removed.error);
    const funnel = await db.from("product_funnel_events").delete().eq("subject_id", matchId).in("profile_id", [a.id, b.id]);
    assert.ifError(funnel.error);
    const notifications = await db.from("deferred_push_notifications").delete().contains("payload", { matchId });
    assert.ifError(notifications.error);
  }
  const deletedImage = await db.storage.from("chat-images").remove([imagePath]);
  assert.ifError(deletedImage.error);
  const after = await db.from("message_daily_usage").select("profile_id,usage_date,sent_count").in("profile_id", [a.id, b.id]);
  assert.ifError(after.error);
  for (const row of after.data ?? []) {
    const old = before.data?.find((item) => item.profile_id === row.profile_id && item.usage_date === row.usage_date);
    const restored = old
      ? await db.from("message_daily_usage").update({ sent_count: old.sent_count }).eq("profile_id", row.profile_id).eq("usage_date", row.usage_date)
      : await db.from("message_daily_usage").delete().eq("profile_id", row.profile_id).eq("usage_date", row.usage_date);
    assert.ifError(restored.error);
  }
}
