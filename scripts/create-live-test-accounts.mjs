import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--allow-production-test-seed")) {
  throw new Error("Refusing privileged production seed without --allow-production-test-seed.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Production Supabase credentials are unavailable.");

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const envPath = ".env.test.local";
let envText = await readFile(envPath, "utf8");
const readValue = (name) => envText.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const setValue = (name, value) => {
  const line = `${name}=${value}`;
  envText = new RegExp(`^${name}=.*$`, "m").test(envText)
    ? envText.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${envText.trimEnd()}\n${line}\n`;
};
const suffix = `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex")}`;
const password = () => `${randomBytes(24).toString("base64url")}Aa1!`;

async function ensureUser(kind, emailName, passwordName) {
  let email = readValue(emailName);
  let userPassword = readValue(passwordName);
  if (email && !userPassword) throw new Error(`${passwordName} is empty for an existing configured email.`);
  if (!email) {
    email = `codex-test-${kind}-${suffix}@lovask.com.tr`;
    userPassword = password();
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: `Lovask Test ${kind}` },
    app_metadata: { approved_member: true, test_account: true, test_kind: kind },
  });
  let user = created.user;
  if (error?.message?.toLowerCase().includes("already")) {
    for (let page = 1; page <= 10 && !user; page += 1) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listed.error) throw listed.error;
      user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase()) ?? null;
      if (listed.data.users.length < 1000) break;
    }
  } else if (error) {
    throw error;
  }
  if (!user) throw new Error(`Could not resolve ${kind} test user.`);
  if (user.app_metadata?.test_account !== true) throw new Error(`Refusing to modify unmarked account: ${email}`);
  const updated = await admin.auth.admin.updateUserById(user.id, {
    password: userPassword,
    email_confirm: true,
    app_metadata: { ...user.app_metadata, approved_member: true, test_account: true, test_kind: kind },
  });
  if (updated.error) throw updated.error;
  setValue(emailName, email);
  setValue(passwordName, userPassword);
  return updated.data.user;
}

async function ensureProfile(user, input) {
  const { data: profile, error } = await admin.from("profiles").upsert({
    user_id: user.id,
    kind: "human",
    display_name: input.name,
    birth_date: input.birthDate,
    gender: input.gender,
    city: "İstanbul",
    relationship_goal: "serious",
    marital_status: "never_married",
    has_children: false,
    children_preference: "open",
    is_discoverable: true,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("id").single();
  if (error) throw error;

  const privateResult = await admin.from("private_profile_data").upsert({
    profile_id: profile.id,
    birth_date: input.birthDate,
    updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id" });
  if (privateResult.error) throw privateResult.error;

  const preferences = await admin.from("discovery_preferences").upsert({
    profile_id: profile.id,
    min_age: 18,
    max_age: 80,
    interested_genders: input.interestedGenders,
    same_city_only: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id" });
  if (preferences.error) throw preferences.error;

  const removed = await admin.from("profile_photos").delete().eq("profile_id", profile.id);
  if (removed.error) throw removed.error;
  const photos = await admin.from("profile_photos").insert(input.photos.map((path, index) => ({
    profile_id: profile.id,
    storage_path: path,
    variants: { "480": path, "960": path, "1440": path },
    width: 960,
    height: 1200,
    moderation_status: "approved",
    processing_status: "ready",
    sort_order: index,
    is_primary: index === 0,
  })));
  if (photos.error) throw photos.error;
  return profile.id;
}

const standard = await ensureUser("standard", "LOVASK_STANDARD_EMAIL", "LOVASK_STANDARD_PASSWORD");
const noir = await ensureUser("noir", "LOVASK_NOIR_EMAIL", "LOVASK_NOIR_PASSWORD");
const owner = await ensureUser("owner", "LOVASK_OWNER_EMAIL", "LOVASK_OWNER_PASSWORD");
await ensureUser("lifecycle", "LOVASK_LIFECYCLE_EMAIL", "LOVASK_LIFECYCLE_PASSWORD");

const standardProfileId = await ensureProfile(standard, {
  name: "Lovask Test Standard",
  birthDate: "1994-04-12",
  gender: "erkek",
  interestedGenders: ["kadın"],
  photos: ["/profiles/mert.webp", "/profiles/defne.webp"],
});
const noirProfileId = await ensureProfile(noir, {
  name: "Lovask Test Noir",
  birthDate: "1995-08-21",
  gender: "kadın",
  interestedGenders: ["erkek"],
  photos: ["/profiles/lara.webp", "/profiles/defne.webp"],
});

const entitlement = await admin.from("user_entitlements").upsert({
  profile_id: noirProfileId,
  noir_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  source: "test_audit",
  updated_at: new Date().toISOString(),
}, { onConflict: "profile_id" });
if (entitlement.error) throw entitlement.error;

const ownerRole = await admin.from("admin_users").upsert({ user_id: owner.id, role: "owner" }, { onConflict: "user_id" });
if (ownerRole.error) throw ownerRole.error;

setValue("LOVASK_STANDARD_PROFILE_ID", standardProfileId);
setValue("LOVASK_NOIR_PROFILE_ID", noirProfileId);
await writeFile(envPath, envText, { encoding: "utf8", mode: 0o600 });

console.log(JSON.stringify({
  created: true,
  accounts: ["standard", "noir", "owner", "lifecycle"],
  credentialsStoredIn: envPath,
  passwordsPrinted: false,
}, null, 2));
