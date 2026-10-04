import { lstat, readdir, realpath, symlink, unlink } from "node:fs/promises";
import path from "node:path";

const runtimeModules = path.join(process.cwd(), ".next", "node_modules");
let entries = [];
try {
  entries = await readdir(runtimeModules);
} catch {
  process.exit(0);
}

let repaired = 0;
for (const entry of entries) {
  const linkPath = path.join(runtimeModules, entry);
  const link = await lstat(linkPath).catch(() => null);
  if (!link?.isSymbolicLink()) continue;
  const target = await realpath(linkPath).catch(() => null);
  if (!target) throw new Error(`Broken Next.js runtime link: ${entry}`);
  await unlink(linkPath);
  await symlink(target, linkPath, process.platform === "win32" ? "junction" : "dir");
  repaired += 1;
}

console.log(`Next.js runtime links repaired: ${repaired}`);
