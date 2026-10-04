import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const testEnv = await readFile(".env.test.local", "utf8");
const env = (name) => testEnv.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const id = crypto.randomUUID();
let planId;
let orderId;

try {
  const { data: plan, error: planError } = await admin.from("premium_plans").insert({
    slug: `qa-claim-${id}`,
    name: "QA checkout claim",
    duration_days: 1,
    price_amount: 1,
    currency: "TRY",
    is_active: false,
  }).select("id").single();
  assert.ifError(planError);
  planId = plan.id;

  const { data: order, error: orderError } = await admin.from("payment_orders").insert({
    profile_id: env("LOVASK_QA_A_PROFILE_ID"),
    plan_id: planId,
    provider: "shopier",
    amount: 1,
    currency: "TRY",
    status: "awaiting_payment",
    payment_reference: `QA-CLAIM-${id}`,
  }).select("id").single();
  assert.ifError(orderError);
  orderId = order.id;

  const claim = (claimedAt) => admin.from("payment_orders")
    .update({ checkout_claimed_at: claimedAt, updated_at: claimedAt })
    .eq("id", orderId).eq("provider", "shopier").in("status", ["awaiting_payment", "pending"])
    .is("checkout_url", null).is("checkout_claimed_at", null)
    .select("id").maybeSingle();
  const results = await Promise.all([claim(new Date().toISOString()), claim(new Date().toISOString())]);
  results.forEach(({ error }) => assert.ifError(error));
  assert.equal(results.filter(({ data }) => data).length, 1, "Exactly one concurrent checkout claim must win.");
  console.log(JSON.stringify({ concurrentClaims: 2, winners: 1, externalCheckoutCreated: false }));
} finally {
  if (orderId) await admin.from("payment_orders").delete().eq("id", orderId);
  if (planId) await admin.from("premium_plans").delete().eq("id", planId);
}
