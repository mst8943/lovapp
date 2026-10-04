import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

let failed = 0;
const admin = {
  rpc: async () => ({ data: { databaseBytes: 1 }, error: null }),
  from: () => ({ select: () => ({ eq: async () => ({ count: failed, error: null }) }) }),
};
const source = ts.transpileModule(readFileSync("app/api/internal/ops-health/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(source, {
  exports, Date,
  process: { env: { CRON_SECRET: "local-test-secret" } },
  require: (name) => name === "next/server" ? { NextResponse } : name.includes("hermes-notifications") ? { notifyHermes: async () => {} } : { createAdminClient: () => admin },
});
const request = (token) => new Request("https://example.test/api/internal/ops-health", { headers: { authorization: token } });
assert.equal((await exports.GET(request("Bearer wrong"))).status, 401);
assert.equal((await exports.GET(request("Bearer local-test-secret"))).status, 200);
failed = 1;
assert.equal((await exports.GET(request("Bearer local-test-secret"))).status, 503);
