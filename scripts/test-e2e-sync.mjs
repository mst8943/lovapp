import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { resolvePresence } from "../lib/presence.ts";

// 1. Load environment
const prodEnvRaw = await readFile(".env.production.local", "utf8");
const testEnvRaw = await readFile(".env.test.local", "utf8");

function parseEnv(raw) {
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return map;
}

const prodEnv = parseEnv(prodEnvRaw);
const testEnv = parseEnv(testEnvRaw);

const baseUrl = process.env.LOVASK_BASE_URL ?? testEnv.LOVASK_BASE_URL ?? "https://lovask.com.tr";
const supabaseUrl = prodEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = prodEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = prodEnv.SUPABASE_SERVICE_ROLE_KEY;

assert(supabaseUrl && anonKey && serviceKey, "Supabase environment keys missing");

function webSessionCookie(url, session) {
  const name = `sb-${new URL(url).host.split(".")[0]}-auth-token`;
  const raw = Buffer.from(JSON.stringify(session)).toString("base64url").replaceAll("=", "");
  const value = `base64-${raw}`;
  if (value.length <= 3180) return `${name}=${value}`;
  const chunks = [];
  for (let start = 0; start < value.length; start += 3180) {
    chunks.push(`${name}.${Math.floor(start / 3180)}=${value.slice(start, start + 3180)}`);
  }
  return chunks.join("; ");
}

const adminDb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mobileClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("=== 1. Authenticating Mobile Session via Supabase ===");
const userEmail = testEnv.LOVASK_STANDARD_EMAIL;
const userPassword = testEnv.LOVASK_STANDARD_PASSWORD;
assert(userEmail && userPassword, "Standard test user credentials missing");

const { data: authData, error: authError } = await mobileClient.auth.signInWithPassword({
  email: userEmail,
  password: userPassword,
});
assert(!authError && authData.session, `Mobile auth failed: ${authError?.message}`);
const session = authData.session;
const token = session.access_token;
const sessionCookie = webSessionCookie(supabaseUrl, session);
console.log("[PASS] Mobile auth successful.");

console.log("=== 2. Testing Mobile API Contract Endpoints with Web Session Cookie ===");
async function apiGet(path, customCookie = sessionCookie, authToken = token) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
      Cookie: customCookie,
      Origin: baseUrl,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Read Account State via Mobile API
const accountRes = await apiGet("/api/profile/account");
console.log(`Mobile /api/profile/account status: ${accountRes.status}`);
assert.equal(accountRes.status, 200, "Mobile account read failed");
assert(accountRes.data.profile, "Missing profile in account response");
const mobileProfile = accountRes.data.profile;
console.log(`[PASS] Mobile Account loaded: Profile ID ${mobileProfile.id}, Discoverable: ${mobileProfile.is_discoverable}`);

// Read Discovery via Mobile API
const discoveryRes = await apiGet("/api/discovery");
assert.equal(discoveryRes.status, 200, "Mobile discovery read failed");
assert(Array.isArray(discoveryRes.data.profiles), "Discovery profiles is not an array");
console.log(`[PASS] Mobile Discovery loaded: ${discoveryRes.data.profiles.length} candidate profiles.`);

// Read Conversations via Mobile API
const convoRes = await apiGet("/api/conversations");
assert.equal(convoRes.status, 200, "Mobile conversations read failed");
assert(Array.isArray(convoRes.data.conversations), "Conversations is not an array");
console.log(`[PASS] Mobile Conversations loaded: ${convoRes.data.conversations.length} active threads.`);

console.log("=== 3. Testing Web and Admin Panel Synchronization ===");
// Admin direct verification using service role
const { data: adminProfile, error: adminErr } = await adminDb
  .from("profiles")
  .select("id, user_id, display_name, city, is_discoverable, xp, level")
  .eq("id", mobileProfile.id)
  .single();
assert(!adminErr && adminProfile, `Admin direct query failed: ${adminErr?.message}`);
assert.equal(adminProfile.id, mobileProfile.id, "Admin ID mismatch");
assert.equal(adminProfile.is_discoverable, mobileProfile.is_discoverable, "Admin discoverable mismatch");
console.log(`[PASS] Admin Database confirms member ${adminProfile.display_name} (${adminProfile.id}) matches Mobile.`);

// Owner Auth for Admin Panel API
const ownerEmail = testEnv.LOVASK_OWNER_EMAIL;
const ownerPassword = testEnv.LOVASK_OWNER_PASSWORD;
assert(ownerEmail && ownerPassword, "Owner credentials required; admin checks must not be skipped");
{
  const { data: ownerAuth, error: ownerAuthErr } = await mobileClient.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });
  assert(!ownerAuthErr && ownerAuth.session, "Owner authentication failed");
  {
    const ownerCookie = webSessionCookie(supabaseUrl, ownerAuth.session);
    const adminHealth = await apiGet("/api/admin/health", ownerCookie, ownerAuth.session.access_token);
    console.log(`Admin health endpoint status: ${adminHealth.status}`);
    assert.equal(adminHealth.status, 200, "Admin health failed");
    console.log("[PASS] Admin authentication and permissions verified.");
    const setup = await apiGet("/api/admin/setup", ownerCookie, ownerAuth.session.access_token);
    assert.equal(setup.status, 200, "Admin setup failed");
    assert.equal(setup.data.checks?.find((item) => item.label === "Android bildirimleri")?.ready, true, "Firebase Admin service account unavailable to live server");

    // A separate cookie-only web session exercises the browser auth path.
    const webClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: webAuth, error: webError } = await webClient.auth.signInWithPassword({ email: userEmail, password: userPassword });
    assert(!webError && webAuth.session, "Web authentication failed");
    const webCookie = webSessionCookie(supabaseUrl, webAuth.session);
    const webGet = async (path) => {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Cookie: webCookie, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      assert.equal(response.status, 200, `Web ${path}`);
      return response.json();
    };
    const webAccount = await webGet("/api/profile/account");
    assert.deepEqual(webAccount.profile, mobileProfile);
    const detail = await apiGet(`/api/admin/users/${mobileProfile.id}`, ownerCookie, ownerAuth.session.access_token);
    assert.equal(detail.status, 200, "Admin user detail failed");
    for (const field of ["id", "is_discoverable", "xp", "level"]) {
      assert.equal(detail.data.user[field], webAccount.profile[field], `Admin/web ${field}`);
    }
    const forbidden = await apiGet(`/api/admin/users/${mobileProfile.id}`);
    assert.equal(forbidden.status, 403, "Member must not access admin user detail");
    for (const path of ["/api/discovery/preferences", "/api/conversations"]) {
      const mobile = await apiGet(path);
      assert.equal(mobile.status, 200, `Mobile ${path}`);
      assert.deepEqual(await webGet(path), mobile.data, `Web/mobile ${path}`);
    }
    // Mutate only the explicitly configured test member and restore even on failure.
    assert(userEmail.startsWith("codex-test-"), "Sync mutation requires a dedicated test member");
    const setVisibility = async (discoverable, cookie, bearer) => {
      const response = await fetch(`${baseUrl}/api/profile/account`, {
        method: "PATCH",
        headers: { Cookie: cookie, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), Origin: baseUrl, "Content-Type": "application/json" },
        body: JSON.stringify({ discoverable }),
        signal: AbortSignal.timeout(30_000),
      });
      assert.equal(response.status, 200, `Visibility update: ${await response.text()}`);
    };
    try {
      await setVisibility(!mobileProfile.is_discoverable, sessionCookie, token);
      assert.equal((await webGet("/api/profile/account")).profile.is_discoverable, !mobileProfile.is_discoverable);
      const changed = await apiGet(`/api/admin/users/${mobileProfile.id}`, ownerCookie, ownerAuth.session.access_token);
      assert.equal(changed.status, 200);
      assert.equal(changed.data.user.is_discoverable, !mobileProfile.is_discoverable);
      await setVisibility(mobileProfile.is_discoverable, webCookie);
      assert.equal((await apiGet("/api/profile/account")).data.profile.is_discoverable, mobileProfile.is_discoverable);
    } finally {
      await setVisibility(mobileProfile.is_discoverable, webCookie);
    }
    console.log("[PASS] Separate web/mobile sessions, admin detail, role isolation and restored visibility round-trip.");
    const browser = await chromium.launch({ channel: "msedge", headless: true });
    try {
      for (const [cookie, path, expected] of [
        [webCookie, "/?tab=profile", adminProfile.display_name],
        [ownerCookie, "/admin/lovask-control/users", "Kullanıcılar"],
      ]) {
        const context = await browser.newContext({ serviceWorkers: "block" });
        await context.addCookies(cookie.split("; ").map((entry) => {
          const separator = entry.indexOf("=");
          return { name: entry.slice(0, separator), value: entry.slice(separator + 1), url: baseUrl };
        }));
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
        assert.equal(response.status(), 200, `Authenticated page ${path}`);
        assert(!page.url().includes("/login"), "Authenticated page redirected to login");
        assert((await page.locator("body").innerText()).includes(expected), `Missing authenticated content: ${path}`);
        assert.deepEqual(errors, [], `Browser runtime errors: ${path}`);
        await context.close();
      }
    } finally {
      await browser.close();
    }
    console.log("[PASS] Authenticated web profile and admin users pages render without runtime errors.");
  }
}

console.log("=== 4. Testing Presence Synchronization ===");
const p1 = resolvePresence({ isOnline: true });
assert.equal(p1.isOnline, true);
const p2 = resolvePresence({ lastSeenAt: new Date(Date.now() - 30_000).toISOString() });
assert.equal(p2.isOnline, true);
const p3 = resolvePresence({ lastSeenAt: new Date(Date.now() - 3600_000 * 5).toISOString() });
assert.equal(p3.isOnline, false);
console.log("[PASS] Cross-platform presence logic verified.");

console.log("\n========================================================");
console.log(" SUCCESS: All mobile, web, and admin sync checks PASSED!");
console.log("========================================================");
