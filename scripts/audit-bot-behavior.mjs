import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries((await readFile(path.join(root, ".env.production.local"), "utf8"))
  .split(/\r?\n/)
  .filter((line) => line && line.includes("=") && !line.startsWith("#"))
  .map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(JSON.stringify({ skipped: true, reason: "SUPABASE_SERVICE_ROLE_KEY yapılandırılmamış." }));
  process.exit(0);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [botResult, personaResult, controlResult, jobResult, messageResult] = await Promise.all([
  db.from("profiles").select("id,display_name,gender,is_discoverable").eq("kind", "bot"),
  db.from("bot_personas").select("profile_id", { count: "exact", head: true }).eq("is_active", true),
  db.from("bot_automation_overrides").select("profile_id", { count: "exact", head: true }).eq("automation_enabled", true),
  db.from("bot_reply_jobs").select("id", { count: "exact", head: true }),
  db.from("messages").select("id", { count: "exact", head: true }),
]);
const failure = [botResult, personaResult, controlResult, jobResult, messageResult].find((result) => result.error)?.error;
if (failure) throw failure;

const bots = botResult.data ?? [];
const male = new Set(["Ahmet", "Ali", "Arda", "Burak", "Can", "Cenk", "Cihan", "Deniz", "Doruk", "Emir", "Emre", "Eren", "Kaan", "Kerem", "Mehmet", "Mert", "Murat", "Oğuz", "Onur", "Ömer", "Serkan", "Sinan", "Tolga", "Umut", "Yusuf"]);
const maleBots = bots.filter((bot) => ["erkek", "male", "man"].includes(String(bot.gender).toLowerCase()) || male.has(String(bot.display_name).split(/[ .]/)[0]));
console.log(JSON.stringify({
  bots: bots.length,
  active: bots.filter((bot) => bot.is_discoverable).length,
  personas: personaResult.count ?? 0,
  activeControls: controlResult.count ?? 0,
  replyJobs: jobResult.count ?? 0,
  messages: messageResult.count ?? 0,
  maleNamedBots: maleBots.length,
  sampleMaleNamedBots: maleBots.slice(0, 10).map((bot) => bot.display_name),
}));
