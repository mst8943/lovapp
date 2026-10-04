import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const env = parseEnv(readFileSync(".env.test.local", "utf8"));
const a = { id: env.LOVASK_QA_A_PROFILE_ID, email: env.LOVASK_QA_A_EMAIL, password: env.LOVASK_QA_A_PASSWORD };
const b = { id: env.LOVASK_QA_B_PROFILE_ID, email: env.LOVASK_QA_B_EMAIL, password: env.LOVASK_QA_B_PASSWORD };
assert.equal(a.email, "qa-erkek-test@lovask.com.tr");
assert.equal(b.email, "qa-kadin-test@lovask.com.tr");
assert(a.id && b.id && a.password && b.password);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [low, high] = [a.id, b.id].sort();
const queries = await Promise.all([
  db.from("matches").select("id,status", { count: "exact" }).eq("user_a", low).eq("user_b", high),
  db.from("swipes").select("swiper_id", { count: "exact", head: true }).eq("swiper_id", a.id).eq("target_id", b.id),
  db.from("swipes").select("swiper_id", { count: "exact", head: true }).eq("swiper_id", b.id).eq("target_id", a.id),
  db.from("blocks").select("blocker_id", { count: "exact", head: true }).eq("blocker_id", a.id).eq("blocked_id", b.id),
  db.from("blocks").select("blocker_id", { count: "exact", head: true }).eq("blocker_id", b.id).eq("blocked_id", a.id),
]);
for (const result of queries) if (result.error) throw result.error;
if (process.argv.includes("--preflight")) {
  console.log(JSON.stringify({ matches: queries[0].count, swipesAtoB: queries[1].count, swipesBtoA: queries[2].count, blocksAtoB: queries[3].count, blocksBtoA: queries[4].count }));
  process.exit(0);
}
assert.equal(queries[0].count, 0, "QA pair already has a match; preserve existing data");
assert.equal(queries[3].count, 0, "QA A has blocked QA B");
assert.equal(queries[4].count, 0, "QA B has blocked QA A");
const usageBefore = await db.from("message_daily_usage").select("profile_id,usage_date,sent_count").in("profile_id", [a.id, b.id]);
if (usageBefore.error) throw usageBefore.error;
const base = process.env.LOVASK_BASE_URL ?? env.LOVASK_BASE_URL ?? "https://lovask.com.tr";
let matchId;
let browser;
let outcome;
const check = (result) => { if (result.error) throw result.error; return result.data; };
const cookie = (session) => {
  const name = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  assert(value.length < 3180, "QA auth cookie exceeds one chunk");
  return `${name}=${value}`;
};
try {
  const match = check(await db.from("matches").insert({ user_a: low, user_b: high }).select("id").single());
  matchId = match.id;
  const mobile = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signedIn, error: signInError } = await mobile.auth.signInWithPassword({ email: b.email, password: b.password });
  assert(!signInError && signedIn.session, `QA B login failed: ${signInError?.message}`);
  const mobileGet = async (path) => {
    const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${signedIn.session.access_token}`, Cookie: cookie(signedIn.session) }, signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, `Mobile GET ${path}: ${response.status}`);
    return response.json();
  };
  const conversation = await mobileGet("/api/conversations");
  assert(conversation.conversations.some((item) => item.matchId === matchId), "QA match absent from mobile inbox API");
  browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("E-posta").fill(a.email);
  await page.locator('input[autocomplete="current-password"]').fill(a.password);
  await page.locator("form").getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 });
  await page.goto(`${base}/?tab=messages`, { waitUntil: "networkidle" });
  await page.locator("button.conversation").filter({ hasText: "QA Kadın Test" }).click();
  const message = `QA web mobile ${Date.now()}`;
  await page.getByRole("textbox", { name: "Mesaj" }).fill(message);
  const sentResponse = page.waitForResponse((response) => response.url().includes("/api/chat") && response.request().method() === "POST", { timeout: 30_000 });
  await page.getByRole("button", { name: "Gönder" }).click();
  const sent = await sentResponse;
  assert.equal(sent.status(), 201, `Web chat send failed: ${sent.status()} ${await sent.text()}`);
  let history;
  for (let attempt = 0; attempt < 10; attempt++) {
    history = await mobileGet(`/api/chat?profileId=${a.id}`);
    if (history.messages.some((item) => item.text === message)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert(history.messages.some((item) => item.text === message), "Web message absent from mobile API");
  const rows = check(await db.from("messages").select("id,body,sender_id").eq("match_id", matchId));
  assert(rows.some((row) => row.body === message && row.sender_id === a.id), "Admin DB message mismatch");
  outcome = { matchId, webToMobile: true, adminConsistent: true, messageCount: rows.length };
} finally {
  if (browser) await browser.close();
  if (matchId) check(await db.from("matches").delete().eq("id", matchId));
  if (matchId) check(await db.from("product_funnel_events").delete().eq("subject_id", matchId).in("profile_id", [a.id, b.id]));
  if (matchId) check(await db.from("deferred_push_notifications").delete().contains("payload", { matchId }));
  const current = await db.from("message_daily_usage").select("profile_id,usage_date,sent_count").in("profile_id", [a.id, b.id]);
  if (current.error) throw current.error;
  for (const row of current.data ?? []) {
    const old = usageBefore.data?.find((item) => item.profile_id === row.profile_id && item.usage_date === row.usage_date);
    if (old) check(await db.from("message_daily_usage").update({ sent_count: old.sent_count }).eq("profile_id", row.profile_id).eq("usage_date", row.usage_date));
    else check(await db.from("message_daily_usage").delete().eq("profile_id", row.profile_id).eq("usage_date", row.usage_date));
  }
  if (matchId) {
    const remaining = await db.from("matches").select("id", { count: "exact", head: true }).eq("id", matchId);
    if (remaining.error) throw remaining.error;
    assert.equal(remaining.count, 0, "QA match cleanup failed");
    const messages = await db.from("messages").select("id", { count: "exact", head: true }).eq("match_id", matchId);
    if (messages.error) throw messages.error;
    assert.equal(messages.count, 0, "QA message cleanup failed");
  }
}
console.log(JSON.stringify(outcome));
