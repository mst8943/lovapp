import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const original = read("../supabase/migrations/050_distance_noir_filters_and_chat_pagination.sql");
const boosted = read("../supabase/migrations/061_profile_boost.sql");
const extract = (sql) => sql.slice(sql.indexOf("function public.get_discovery_candidates(candidate_limit integer default 20)"), sql.indexOf("grant execute on function public.get_discovery_candidates(integer) to authenticated;") + "grant execute on function public.get_discovery_candidates(integer) to authenticated;".length);
const weight = "power(((('x'||left(md5(target.id::text||viewer.id::text||current_date::text),8))::bit(32)::bigint+1)::numeric/4294967296),\n      case when exists(select 1 from public.profile_boosts boost where boost.profile_id=target.id and boost.expires_at>now()) then 1.0/3 else 1.0 end) desc";
assert.equal(extract(boosted).replace(weight, "md5(target.id::text||viewer.id::text||current_date::text)"), extract(original));
assert.match(boosted, /from public\.profiles where id=public\.current_profile_id\(\) and kind='human' for update/);
assert.match(boosted, /boost\.started_at\+interval '7 days'<=now\(\)/);
assert.match(boosted, /started\+interval '30 minutes'/);
console.log("Boost migration preserves discovery filters and enforces duration/cooldown.");
