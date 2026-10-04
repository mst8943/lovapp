import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const env = parseEnv(readFileSync(".env.production.local", "utf8"));
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
for (const kind of ["human", "bot"]) {
  const { count, error } = await client.from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind).eq("onboarding_completed", true)
    .eq("is_discoverable", true).is("deleted_at", null);
  if (error) throw error;
  console.log(`${kind}: ${count}`);
}
const activeBoosts = await client.from("profile_boosts")
  .select("profile_id", { count: "exact", head: true })
  .gt("expires_at", new Date().toISOString());
if (activeBoosts.error) throw activeBoosts.error;
console.log(`active_boosts: ${activeBoosts.count}`);
const { data, error } = await client.rpc("product_funnel_counts", {
  since_date: new Date(Date.now() - 30 * 86_400_000).toISOString(),
});
if (error) throw error;
console.log(JSON.stringify(data));
