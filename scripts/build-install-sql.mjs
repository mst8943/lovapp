import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "supabase", "migrations");
const files = (await readdir(dir)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
const sections = [];
for (const file of files) {
  sections.push(`-- ===== ${file} =====\n${await readFile(path.join(dir, file), "utf8")}`);
}
await writeFile(path.join(root, "supabase", "INSTALL.sql"), `-- Lovask fresh-install bundle. Run once on an empty Supabase project.\n\n${sections.join("\n\n")}`, "utf8");
console.log(`Created supabase/INSTALL.sql from ${files.length} migrations.`);
