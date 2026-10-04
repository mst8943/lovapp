import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const secrets = Object.fromEntries(readFileSync(".env.test.local", "utf8")
  .split(/\r?\n/).filter((line) => line.includes("=") && !line.startsWith("#"))
  .map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
const publicEnv = JSON.parse(readFileSync("apps/mobile/env.json", "utf8"));
const client = createClient(publicEnv.SUPABASE_URL, publicEnv.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: "qa-kadin-test@lovask.com.tr",
  password: secrets.LOVASK_QA_B_PASSWORD,
});
assert.ifError(error);
assert(data.session);
const session = data.session;
const cookie = `sb-jagqvyfnychnoxarebgv-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
for (const path of [
  "/api/profile/account",
  "/api/profile/boost",
  "/api/profile/contact-verification",
  "/api/profile/verification",
  "/api/discovery",
  "/api/conversations",
  "/api/noir",
]) {
  const response = await fetch(`https://lovask.com.tr${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}`, Cookie: cookie },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `${path}: ${response.status} ${JSON.stringify(body)}`);
  if (path === "/api/profile/boost") assert.equal(typeof body.canActivate, "boolean");
  if (path === "/api/profile/contact-verification") {
    assert.equal(body.emailEnabled, false);
    assert.equal(body.smsEnabled, false);
  }
  console.log(`${path}: 200`);
}
const recovery = await fetch("https://lovask.com.tr/reset-password", { signal: AbortSignal.timeout(30000) });
assert.equal(recovery.status, 200, "Password recovery page unavailable");
console.log("/reset-password: 200 (email delivery not tested)");
