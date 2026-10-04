import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendFcmToDevice } from "../lib/fcm.ts";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKey = keys.publicKey;
const privateKey = keys.privateKey.export({ type: "pkcs8", format: "pem" });
const previous = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const previousFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
const originalFetch = globalThis.fetch;
const directory = mkdtempSync(join(tmpdir(), "lovask-fcm-"));
let oauthCalls = 0;
let sends = 0;
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "qa@example.test", private_key: privateKey, project_id: "qa-project" });
globalThis.fetch = async (url, options) => {
  if (String(url).includes("oauth2.googleapis.com")) {
    oauthCalls++;
    const assertion = new URLSearchParams(options.body).get("assertion");
    const [header, payload, signature] = assertion.split(".");
    const valid = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, "base64url"));
    assert(valid, "OAuth assertion signature invalid");
    return Response.json({ access_token: "qa-access-token", expires_in: 3600 });
  }
  assert.equal(String(url), "https://fcm.googleapis.com/v1/projects/qa-project/messages:send");
  assert.equal(options.headers.Authorization, "Bearer qa-access-token");
  const message = JSON.parse(options.body).message;
  assert.equal(message.token, "qa-device-token");
  assert.equal(message.data.payload, "chat:match:peer");
  sends++;
  return Response.json({ name: "projects/qa-project/messages/qa" });
};
try {
  const message = { title: "Lovask", body: "Yeni mesaj", data: { payload: "chat:match:peer" } };
  assert.equal((await sendFcmToDevice("qa-device-token", message)).ok, true);
  assert.equal((await sendFcmToDevice("qa-device-token", message)).ok, true);
  assert.equal(oauthCalls, 1, "Token should be reused until expiry");
  assert.equal(sends, 2);
  writeFileSync(join(directory, "service-account.json"), process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  process.env.FIREBASE_SERVICE_ACCOUNT_FILE = join(directory, "service-account.json");
  assert.equal((await sendFcmToDevice("qa-device-token", message)).ok, true);
  assert.equal(sends, 3, "File-based service account should send");
} finally {
  globalThis.fetch = originalFetch;
  if (previous === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = previous;
  if (previousFile === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  else process.env.FIREBASE_SERVICE_ACCOUNT_FILE = previousFile;
  rmSync(directory, { recursive: true, force: true });
}
console.log("FCM v1 signature, token reuse and send shape passed.");
