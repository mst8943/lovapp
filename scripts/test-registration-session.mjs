import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function check(flow, { confirmation = false, refreshFails = false, approved = false } = {}) {
  const events = [];
  let cookies;
  const user = { id: "test-user", identities: [{}], app_metadata: { approved_member: approved } };
  const session = { refresh_token: "signup-refresh-token" };
  const auth = {
    signUp: async () => {
      cookies.setAll([{ name: "session", value: "unapproved", options: { path: "/" } }]);
      return { data: { user, session: confirmation ? null : session }, error: null };
    },
    exchangeCodeForSession: async () => ({ error: null }),
    getUser: async () => ({ data: { user } }),
    refreshSession: async (input) => {
      events.push("refresh");
      assert.equal(user.app_metadata.approved_member, true);
      if (flow === "email") assert.equal(input.refresh_token, session.refresh_token);
      if (refreshFails) return { data: { session: null }, error: { message: "offline" } };
      cookies?.setAll([{ name: "session", value: "approved", options: { path: "/" } }]);
      return { data: { session }, error: null };
    },
    signOut: async () => { events.push("signout"); },
  };
  const mocks = {
    "@supabase/ssr": { createServerClient: (_url, _key, options) => { cookies = options.cookies; return { auth }; } },
    "@/lib/supabase/server": { createClient: async () => ({ auth }) },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }), auth: { admin: {
      updateUserById: async (_id, changes) => {
        events.push("approve");
        user.app_metadata = changes.app_metadata;
        return { error: null };
      },
      deleteUser: async () => { assert.fail("Approved accounts must survive refresh failures"); },
    } } }) },
    "@/lib/auth-origin": { hasValidAuthOrigin: () => true },
    "@/lib/registration-settings": { readOpenRegistration: async () => ({ enabled: true }) },
    "@/lib/navigation": { safeInternalPath: (path, fallback) => path ?? fallback },
    "@/lib/rate-limit": { consumeRateLimit: async () => ({ allowed: true }), rateLimitResponse: () => null },
  };
  const path = flow === "email" ? "../app/api/auth/register/route.ts" : "../app/auth/callback/route.ts";
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, {
    exports, require: (name) => mocks[name] ?? require(name), URL,
    process: { env: { NODE_ENV: "test", NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } },
  });
  const response = flow === "email"
    ? await exports.POST({ url: "https://example.test/api/auth/register", cookies: { getAll: () => [] }, json: async () => ({
      fullName: "Test Member", email: "test@example.test", password: "Qa6!xY", passwordConfirmation: "Qa6!xY", termsAccepted: true, privacyAccepted: true, marketingConsent: false,
    }) })
    : await exports.GET(new Request("https://example.test/auth/callback?code=test&flow=register"));

  assert.deepEqual(events, approved ? [] : confirmation ? ["approve"] : refreshFails && flow === "google" ? ["approve", "refresh", "signout"] : ["approve", "refresh"]);
  if (flow === "email") {
    assert.equal(response.status, refreshFails ? 503 : 200);
    const body = await response.json();
    if (refreshFails) assert.equal(body.code, "session_refresh_failed");
    else {
      assert.equal(body.requiresEmailConfirmation, confirmation);
      if (!confirmation) assert.equal(response.cookies.get("session").value, "approved");
    }
  } else {
    const target = new URL(response.headers.get("location"));
    assert.equal(target.pathname, refreshFails ? "/login" : "/onboarding");
  }
}

await check("email");
await check("email", { confirmation: true });
await check("email", { refreshFails: true });
await check("google");
await check("google", { refreshFails: true });
await check("google", { approved: true });
console.log("Registration session checks passed (6 scenarios).");
