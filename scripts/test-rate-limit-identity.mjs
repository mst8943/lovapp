import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';

const subjects = [];
const source = ts.transpileModule(readFileSync('lib/rate-limit.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(source, {
  exports, process: { env: { RATE_LIMIT_HMAC_SECRET: 'test' } },
  require: (name) => name === 'next/server' ? { NextResponse } : name === 'node:crypto' ? { createHmac } : { createAdminClient: () => ({ rpc: async (_, params) => { subjects.push(params.limit_subject_hash); return { data: { allowed: true, remaining: 4 }, error: null }; } }) },
});
const request = (ip) => new Request('https://example.test', { headers: { 'x-forwarded-for': ip } });
await exports.consumeRateLimit(request('1.1.1.1'), { scope: 'report', limit: 5, windowSeconds: 60, identity: 'user', identityOnly: true });
await exports.consumeRateLimit(request('2.2.2.2'), { scope: 'report', limit: 5, windowSeconds: 60, identity: 'user', identityOnly: true });
assert.equal(subjects[0], subjects[1]);
await exports.consumeRateLimit(request('2.2.2.2'), { scope: 'report', limit: 5, windowSeconds: 60, identity: 'user' });
assert.notEqual(subjects[1], subjects[2]);
