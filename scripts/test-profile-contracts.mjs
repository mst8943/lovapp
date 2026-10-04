import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const user = { id: "member" };
let photos = [];
let count = 1;
let photoError = null;
let filters = [];
let deleted = false;
const admin = {
  from(table) {
    const result = table === "profiles" ? { data: { id: "profile", onboarding_completed: true } } : { data: photos, count, error: photoError };
    const query = {
      select() { return query; },
      eq(...args) { filters.push(["eq", ...args]); return query; },
      neq(...args) { filters.push(["neq", ...args]); return query; },
      order() { return query; },
      maybeSingle() { return Promise.resolve(result); },
      update() { return query; },
      delete() { deleted = true; return query; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
    return query;
  },
};
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports, Date, console,
    require(id) {
      if (id === "@/lib/supabase/admin") return { createAdminClient: () => admin };
      if (id === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) };
      return require(id);
    },
  }, { filename: path });
  return loaded.exports;
}

const { resolvePresence } = load("lib/presence.ts");
for (const id of ["a", "b", "c", "member", "default"]) {
  assert.equal(resolvePresence({ id }).isOnline, false);
  assert.equal(resolvePresence({ id }).text, "Aktiflik bilgisi yok");
}
assert.equal(resolvePresence({ lastSeenAt: "invalid" }).isOnline, false);
assert.equal(resolvePresence({ isOnline: true }).isOnline, true);
assert.equal(resolvePresence({ lastSeenAt: new Date(Date.now() - 60_000).toISOString() }).isOnline, true);

const account = load("app/api/profile/account/route.ts");
const visibility = () => account.PATCH({ json: async () => ({ discoverable: true }) });
assert.equal((await visibility()).status, 200);
assert(filters.some(([op, key, value]) => op === "eq" && key === "moderation_status" && value === "approved"));
count = 0;
assert.equal((await visibility()).status, 409);
photoError = { message: "unavailable" };
assert.equal((await visibility()).status, 503);
photoError = null;

const photoRoute = load("app/api/profile/photos/route.ts");
const targetId = "00000000-0000-4000-8000-000000000001";
const photo = (id, status) => ({ id, moderation_status: status, processing_status: "ready", variants: {} });
const remove = () => photoRoute.DELETE({ json: async () => ({ photoId: targetId }) });
photos = [photo(targetId, "rejected"), photo("other", "approved")];
assert.equal((await remove()).status, 200);
assert.equal(deleted, true);
deleted = false;
photos = [photo(targetId, "approved"), photo("other", "approved"), photo("rejected", "rejected")];
assert.equal((await remove()).status, 200);
deleted = false;
photos = [photo(targetId, "approved"), photo("rejected", "rejected")];
assert.equal((await remove()).status, 409);
assert.equal(deleted, false);
photos = [photo(targetId, "approved"), photo("other", "approved"), photo("pending", "pending")];
assert.equal((await remove()).status, 200);
photoError = { message: "unavailable" };
assert.equal((await remove()).status, 503);
console.log("Presence and profile photo contracts passed.");
