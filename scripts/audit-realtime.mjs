import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const testEnv = await readFile(".env.test.local", "utf8");
const env = (name) => testEnv.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const b = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);

const [loginA, loginB] = await Promise.all([
  a.auth.signInWithPassword({ email: env("LOVASK_QA_A_EMAIL"), password: env("LOVASK_QA_A_PASSWORD") }),
  b.auth.signInWithPassword({ email: env("LOVASK_QA_B_EMAIL"), password: env("LOVASK_QA_B_PASSWORD") }),
]);
assert.ifError(loginA.error);
assert.ifError(loginB.error);
const profileA = env("LOVASK_QA_A_PROFILE_ID");
const profileB = env("LOVASK_QA_B_PROFILE_ID");
let createdMatch = false;
let restoredMatch;
let { data: match, error: matchError } = await admin.from("matches").select("id,status,closed_at,last_message_at")
  .or(`and(user_a.eq.${profileA},user_b.eq.${profileB}),and(user_a.eq.${profileB},user_b.eq.${profileA})`).maybeSingle();
assert.ifError(matchError);
if (match && match.status !== "active") {
  restoredMatch = { status: match.status, closed_at: match.closed_at, last_message_at: match.last_message_at };
  const activated = await admin.from("matches").update({ status: "active", closed_at: null }).eq("id", match.id).select("id").single();
  assert.ifError(activated.error);
} else if (!match) {
  const inserted = await admin.from("matches").insert({
    user_a: profileA < profileB ? profileA : profileB,
    user_b: profileA < profileB ? profileB : profileA,
    status: "active",
  }).select("id").single();
  assert.ifError(inserted.error);
  match = inserted.data;
  createdMatch = true;
}

const clientId = crypto.randomUUID();
let status = "pending";
let received = false;
const channel = b.channel(`qa-realtime-${clientId}`).on("postgres_changes", {
  event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${match.id}`,
}, (payload) => { if (payload.new.client_message_id === clientId) received = true; });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Realtime subscription timeout (${status})`)), 10_000);
  channel.subscribe((next) => {
    status = next;
    if (next === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
    if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(next)) { clearTimeout(timer); reject(new Error(`Realtime subscription failed (${next})`)); }
  });
});

const sent = await a.rpc("send_text_message", { match_uuid: match.id, message_body: "QA realtime probe", client_uuid: clientId });
assert.ifError(sent.error);
for (let attempt = 0; attempt < 50 && !received; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
await admin.from("messages").delete().eq("client_message_id", clientId);
if (createdMatch) await admin.from("matches").delete().eq("id", match.id);
else if (restoredMatch) await admin.from("matches").update(restoredMatch).eq("id", match.id);
const subscribed = status === "SUBSCRIBED";
await Promise.all([b.removeChannel(channel), a.auth.signOut(), b.auth.signOut()]);
a.realtime.disconnect();
b.realtime.disconnect();
admin.realtime.disconnect();
console.log(JSON.stringify({ subscribed, received }));
assert.equal(received, true, "Subscribed QA recipient did not receive the inserted message.");
