import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries((await readFile(path.join(root, ".env.production.local"), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const names = [
  "Ada", "Ahu", "Alya", "Aslı", "Aybüke", "Aylin", "Azra", "Bade", "Banu", "Başak", "Beril", "Beren", "Berrak", "Beste", "Beyza", "Bilge", "Burcu", "Cansu", "Cemre", "Ceren", "Damla", "Defne", "Derya", "Dicle", "Dilan", "Dilara", "Ece", "Ecem", "Eda", "Ekin", "Elif", "Elvan", "Esra", "Eylül", "Feyza", "Gizem", "Gökçe", "Gül", "Gülce", "Hande", "Hazal", "İdil", "İlayda", "İpek", "İrem", "Jale", "Lara", "Leyla", "Lina", "Melike", "Melis", "Merve", "Mina", "Miray", "Nazlı", "Nehir", "Neslihan", "Nil", "Nisa", "Nisan", "Nurgül", "Öykü", "Pelin", "Pınar", "Rana", "Rüya", "Seda", "Selen", "Selin", "Selma", "Serra", "Sevgi", "Sıla", "Simay", "Sinem", "Su", "Sude", "Şebnem", "Şeyma", "Tuba", "Tuğçe", "Yaren", "Yasemin", "Yağmur", "Yeliz", "Yonca", "Zehra", "Zeliha", "Zeynep"
];
const maleNames = new Set(["Ahmet", "Ali", "Arda", "Burak", "Can", "Cenk", "Cihan", "Deniz", "Doruk", "Emir", "Emre", "Eren", "Kaan", "Kerem", "Mehmet", "Mert", "Murat", "Oğuz", "Onur", "Ömer", "Serkan", "Sinan", "Tolga", "Umut", "Yusuf"]);
const { data: bots, error } = await db.from("profiles").select("id,display_name,gender").eq("kind", "bot").order("created_at", { ascending: true });
if (error) throw error;
const used = new Set((bots ?? []).filter((bot) => !["erkek", "male", "man"].includes(String(bot.gender).toLowerCase()) && !maleNames.has(String(bot.display_name).split(/[ .]/)[0])).map((bot) => bot.display_name));
const targets = (bots ?? []).filter((bot) => ["erkek", "male", "man"].includes(String(bot.gender).toLowerCase()) || maleNames.has(String(bot.display_name).split(/[ .]/)[0]));
let nameIndex = 0;
for (const bot of targets) {
  while (nameIndex < names.length && used.has(names[nameIndex])) nameIndex++;
  const name = names[nameIndex++] ?? `Aylin ${bot.id.slice(0, 4)}`;
  const result = await db.from("profiles").update({ display_name: name, gender: "kadın" }).eq("id", bot.id).eq("kind", "bot");
  if (result.error) throw result.error;
  used.add(name);
}
console.log(JSON.stringify({ bots: bots?.length ?? 0, updated: targets.length, kept: (bots?.length ?? 0) - targets.length }));
