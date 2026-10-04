import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Supabase production credentials are unavailable.");

const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const envPath = ".env.test.local";
let envText = await readFile(envPath, "utf8").catch(() => "");
const readValue = (name) => envText.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const setValue = (name, value) => {
  const line = `${name}=${value}`;
  envText = new RegExp(`^${name}=.*$`, "m").test(envText)
    ? envText.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${envText.trimEnd()}\n${line}\n`;
};

const accounts = [
  {
    key: "A",
    email: "qa-erkek-test@lovask.com.tr",
    name: "QA Erkek Test",
    birthDate: "1999-04-15",
    gender: "erkek",
    interestedGenders: ["kadın"],
    photos: ["/profiles/mert.webp", "/hero_man.webp"],
  },
  {
    key: "B",
    email: "qa-kadin-test@lovask.com.tr",
    name: "QA Kadın Test",
    birthDate: "2000-04-15",
    gender: "kadın",
    interestedGenders: ["erkek"],
    photos: ["/profiles/lara.webp", "/profiles/defne.webp"],
  },
];

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
  return null;
}

async function ensureUser(account) {
  const passwordName = `LOVASK_QA_${account.key}_PASSWORD`;
  const password = readValue(passwordName) || `${randomBytes(24).toString("base64url")}Aa1!`;
  let user = await findUser(account.email);
  if (user && user.app_metadata?.test_account !== true) {
    throw new Error(`Refusing to reuse unmarked account: ${account.email}`);
  }
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: account.name },
      app_metadata: { approved_member: true, test_account: true, test_kind: `qa_${account.key.toLowerCase()}` },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("QA user creation failed.");
    user = created.data.user;
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, full_name: account.name },
      app_metadata: { ...user.app_metadata, approved_member: true, test_account: true, test_kind: `qa_${account.key.toLowerCase()}` },
    });
    if (updated.error) throw updated.error;
    user = updated.data.user;
  }
  setValue(`LOVASK_QA_${account.key}_EMAIL`, account.email);
  setValue(passwordName, password);
  return user;
}

async function ensureProfile(account, user) {
  const { data: profile, error } = await admin.from("profiles").upsert({
    user_id: user.id,
    kind: "human",
    display_name: account.name,
    birth_date: account.birthDate,
    gender: account.gender,
    bio: "QA TEST ACCOUNT - GERÇEK KULLANICI DEĞİLDİR.",
    city: "İstanbul",
    relationship_goal: "serious",
    marital_status: "never_married",
    has_children: false,
    children_preference: "open",
    is_discoverable: true,
    onboarding_completed: true,
    deleted_at: null,
    safety_restricted_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("id").single();
  if (error) throw error;

  const writes = await Promise.all([
    admin.from("private_profile_data").upsert({ profile_id: profile.id, birth_date: account.birthDate, updated_at: new Date().toISOString() }, { onConflict: "profile_id" }),
    admin.from("discovery_preferences").upsert({
      profile_id: profile.id,
      min_age: 18,
      max_age: 80,
      interested_genders: account.interestedGenders,
      same_city_only: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" }),
  ]);
  for (const write of writes) if (write.error) throw write.error;

  const { data: badges, error: badgeError } = await admin.from("intent_badges").select("id,slug").in("slug", ["serious", "coffee"]);
  if (badgeError || badges?.length !== 2) throw badgeError ?? new Error("QA intent badges are unavailable.");
  const removedIntentions = await admin.from("profile_intentions").delete().eq("profile_id", profile.id);
  if (removedIntentions.error) throw removedIntentions.error;
  const intentions = await admin.from("profile_intentions").insert(badges.map((badge) => ({ profile_id: profile.id, badge_id: badge.id })));
  if (intentions.error) throw intentions.error;

  const { data: prompt, error: promptError } = await admin.from("icebreaker_prompts").select("id").eq("is_active", true).limit(1).single();
  if (promptError) throw promptError;
  const removedAnswers = await admin.from("profile_answers").delete().eq("profile_id", profile.id);
  if (removedAnswers.error) throw removedAnswers.error;
  const answer = await admin.from("profile_answers").insert({
    profile_id: profile.id,
    prompt_id: prompt.id,
    answer: "Ciddi bir ilişki ve güvene dayalı bir bağ arıyorum. ☕",
  });
  if (answer.error) throw answer.error;

  const storedPhotos = [];
  for (const [index, publicPath] of account.photos.entries()) {
    const storagePath = `qa/${profile.id}/${index}-${path.basename(publicPath)}`;
    const upload = await admin.storage.from("profiles").upload(storagePath, await readFile(`public${publicPath}`), {
      contentType: "image/webp",
      upsert: true,
    });
    if (upload.error) throw upload.error;
    storedPhotos.push(storagePath);
  }
  const removedPhotos = await admin.from("profile_photos").delete().eq("profile_id", profile.id);
  if (removedPhotos.error) throw removedPhotos.error;
  const photos = await admin.from("profile_photos").insert(storedPhotos.map((storagePath, index) => ({
    profile_id: profile.id,
    storage_path: storagePath,
    variants: { "480": storagePath, "960": storagePath, "1440": storagePath },
    width: 960,
    height: 1200,
    moderation_status: "approved",
    processing_status: "ready",
    sort_order: index,
    is_primary: index === 0,
  })));
  if (photos.error) throw photos.error;
  setValue(`LOVASK_QA_${account.key}_PROFILE_ID`, profile.id);
  return profile.id;
}

const resolved = [];
for (const account of accounts) {
  const user = await ensureUser(account);
  const profileId = await ensureProfile(account, user);
  resolved.push({ account: account.key, email: account.email, userId: user.id, profileId });
}

await writeFile(envPath, envText, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ created: true, accounts: resolved, credentialsStoredIn: envPath, passwordsPrinted: false }, null, 2));
