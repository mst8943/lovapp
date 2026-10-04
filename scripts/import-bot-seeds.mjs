import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const root = process.cwd();
const env = Object.fromEntries((await readFile(path.join(root, ".env.production.local"), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const files = (await readdir(root)).filter((name) => /^bot-profiles(?:-(?:0[1-7]|new))?\.json$/.test(name)).sort();
const seedDir = path.join(root, "public", "bot-seeds");
const seeds = (await readdir(seedDir)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).sort();
const widths = [480, 960, 1440];
const allBots = (await Promise.all(files.map(async (file) => (JSON.parse(await readFile(path.join(root, file), "utf8")).bots ?? []).map((bot) => ({ ...bot, source: file }))))).flat();
const existing = new Set((await admin.from("profiles").select("display_name").eq("kind", "bot")).data?.map((row) => row.display_name) ?? []);
const badges = new Map(((await admin.from("intent_badges").select("id,label")).data ?? []).map((row) => [row.label, row.id]));
const prompts = new Map(((await admin.from("icebreaker_prompts").select("id,prompt")).data ?? []).map((row) => [row.prompt, row.id]));
let created = 0, skipped = 0;
for (let index = 0; index < allBots.length; index++) {
  const bot = allBots[index];
  if (existing.has(bot.name)) { skipped++; continue; }
  const birth = new Date(); birth.setUTCFullYear(birth.getUTCFullYear() - Number(bot.age));
  const { data: profile, error } = await admin.from("profiles").insert({ kind: "bot", display_name: bot.name, birth_date: birth.toISOString().slice(0, 10), gender: bot.gender, city: bot.city, onboarding_completed: true, is_discoverable: true }).select("id").single();
  if (error || !profile) throw new Error(`${bot.name}: ${error?.message ?? "profile insert failed"}`);
  const persona = await admin.from("bot_personas").insert({ profile_id: profile.id, persona: bot.persona, provider: bot.provider ?? "inherit", model: bot.model, created_by: null });
  if (persona.error) throw persona.error;
  const version = await admin.from("bot_persona_versions").insert({ profile_id: profile.id, version_number: 1, status: "published", persona: bot.persona, provider: bot.provider ?? "inherit", model: bot.model, created_by: null, published_by: null, published_at: new Date().toISOString() });
  if (version.error) throw version.error;
  const badgeIds = (bot.badges ?? []).map((label) => badges.get(label)).filter(Boolean).map((badge_id) => ({ profile_id: profile.id, badge_id }));
  if (badgeIds.length) await admin.from("profile_intentions").insert(badgeIds);
  if (bot.prompt && bot.answer && prompts.has(bot.prompt)) await admin.from("profile_answers").insert({ profile_id: profile.id, prompt_id: prompts.get(bot.prompt), answer: bot.answer });
  const seed = seeds[index % seeds.length];
  const image = sharp(await readFile(path.join(seedDir, seed)), { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  const photoId = randomUUID(), variants = {}, uploaded = [];
  for (const width of widths) { const storagePath = `${profile.id}/${photoId}/${width}.webp`; const output = await image.clone().resize({ width, withoutEnlargement: false }).webp({ quality: 82, effort: 4 }).toBuffer(); const upload = await admin.storage.from("profiles").upload(storagePath, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false }); if (upload.error) throw upload.error; uploaded.push(storagePath); variants[String(width)] = storagePath; }
  const photo = await admin.from("profile_photos").insert({ id: photoId, profile_id: profile.id, storage_path: variants["1440"], variants, width: metadata.width, height: metadata.height, sort_order: 0, is_primary: true, moderation_status: "approved", processing_status: "ready" });
  if (photo.error) throw photo.error;
  existing.add(bot.name); created++;
  if (created % 25 === 0) console.log(`created=${created} skipped=${skipped}`);
}
console.log(JSON.stringify({ files, total: allBots.length, created, skipped, seeds }));
