import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const env = parseEnv(readFileSync(".env.test.local", "utf8"));
const ids = [env.LOVASK_QA_A_PROFILE_ID, env.LOVASK_QA_B_PROFILE_ID];
if (ids.some((id) => !id)) throw new Error("QA profile IDs missing");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const events = await db.from("product_funnel_events")
  .select("id,event_name,profile_id,subject_id,occurred_at")
  .in("profile_id", ids)
  .in("event_name", ["match_created", "first_message_sent", "reply_received"])
  .not("subject_id", "is", null);
if (events.error) throw events.error;
const orphans = [];
for (const event of events.data ?? []) {
  const match = await db.from("matches").select("id", { count: "exact", head: true }).eq("id", event.subject_id);
  if (match.error) throw match.error;
  if (match.count === 0) orphans.push(event);
}
console.log(JSON.stringify(orphans.map(({ id, event_name, occurred_at }) => ({ id, event_name, occurred_at }))));
if (process.argv.includes("--apply") && orphans.length) {
  const removed = await db.from("product_funnel_events").delete().in("id", orphans.map((event) => event.id)).in("profile_id", ids);
  if (removed.error) throw removed.error;
  console.log(`Removed ${orphans.length} orphaned QA events.`);
}
