import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let revealError = null;
let closed = false;
const filters = [];
const admin = { from(table) {
  const query = {
    select() { return query; }, delete() { return query; },
    eq(key, value) { if (table === "hidden_conversations") filters.push([key, value]); return query; },
    or() { return query; }, limit() { return query; }, order() { return query; },
    async maybeSingle() { return { data: table === "profiles" ? { id: filters.length ? "unused" : `profile-${++profileIndex}`, onboarding_completed: true, is_discoverable: true } : null }; },
    then(resolve) { return Promise.resolve({ data: [], error: table === "hidden_conversations" ? revealError : null }).then(resolve); },
  };
  return query;
}, rpc: async () => ({ error: null }) };
let profileIndex = 0;
const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync("app/api/conversations/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, console, require(id) {
  if (id === "next/server") return { ...require(id), after: () => {} };
  if (id === "@/lib/supabase/admin") return { createAdminClient: () => admin };
  if (id === "@/lib/supabase/server") return { createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
    rpc: async () => closed ? { error: { message: "request_already_closed" } } : { data: { matchId: "match" } },
  }) };
  if (id.startsWith("@/")) return {};
  return require(id);
} });
const reopen = () => {
  filters.length = 0; profileIndex = 0;
  return loaded.exports.POST({ json: async () => ({ targetProfileId: "00000000-0000-4000-8000-000000000002" }) });
};
assert.equal((await reopen()).status, 201);
assert.deepEqual(filters, [["profile_id", "profile-1"], ["match_id", "match"]]);
revealError = { message: "unavailable" };
assert.equal((await reopen()).status, 503);
closed = true;
assert.equal((await reopen()).status, 409);
assert.deepEqual(filters, []);
const listFailure = await loaded.exports.GET();
assert.equal(listFailure.status, 503);
assert.equal((await listFailure.json()).error, "Sohbetler yüklenemedi. Tekrar dene.");
console.log("Reopen restores only the requesting member's conversation; failures stay explicit.");
