import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const env = parseEnv(readFileSync(".env.test.local", "utf8"));
assert.equal(env.LOVASK_QA_A_EMAIL, "qa-erkek-test@lovask.com.tr");
const email = env.LOVASK_QA_A_EMAIL;
const originalPassword = env.LOVASK_QA_A_PASSWORD;
const base = env.LOVASK_BASE_URL || "https://lovask.com.tr";
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const originalLogin = await auth.auth.signInWithPassword({ email, password: originalPassword });
assert.ifError(originalLogin.error);
const userId = originalLogin.data.user?.id;
assert(userId);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const generated = await admin.auth.admin.generateLink({ type: "recovery", email });
assert.ifError(generated.error);
const tokenHash = generated.data.properties.hashed_token;
assert(tokenHash);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const newPassword = `Qa!${randomBytes(8).toString("hex")}`;
try {
  const page = await browser.newPage({ serviceWorkers: "block" });
  const confirm = new URL("/auth/confirm", base);
  confirm.searchParams.set("token_hash", tokenHash);
  confirm.searchParams.set("type", "recovery");
  confirm.searchParams.set("next", "/update-password");
  await page.goto(confirm.toString(), { waitUntil: "networkidle", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/update-password", "Recovery link not accepted");
  await page.locator('input[autocomplete="new-password"]').fill(newPassword);
  await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 30000 });
  const changed = await auth.auth.signInWithPassword({ email, password: newPassword });
  assert.ifError(changed.error);
  assert.equal(changed.data.user?.id, userId);
  console.log("QA recovery link, password update and new login: PASS");
} finally {
  await browser.close();
  const restored = await admin.auth.admin.updateUserById(userId, { password: originalPassword });
  assert.ifError(restored.error);
  const login = await auth.auth.signInWithPassword({ email, password: originalPassword });
  assert.ifError(login.error);
  console.log("QA password restored: PASS");
}
