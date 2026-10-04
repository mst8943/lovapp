import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

type ServiceAccount = { client_email: string; private_key: string; project_id: string };
let cachedToken: { value: string; expiresAt: number; account: string } | null = null;

function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8") : "");
  if (!raw) throw new Error("Firebase service account is missing");
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) throw new Error("Firebase service account is incomplete");
  return parsed as ServiceAccount;
}

async function accessToken(account: ServiceAccount) {
  if (cachedToken?.account === account.client_email && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })).toString("base64url");
  const signed = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(signed).sign(account.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${signed}.${signature}` }),
  });
  if (!response.ok) throw new Error(`Firebase OAuth failed: ${response.status}`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Firebase OAuth returned no access token");
  cachedToken = { value: body.access_token, expiresAt: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 60) * 1000, account: account.client_email };
  return body.access_token;
}

export async function sendFcmToDevice(token: string, notification: { title: string; body: string; data: Record<string, string> }) {
  const account = serviceAccount();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await accessToken(account)}` },
    body: JSON.stringify({ message: { token, notification: { title: notification.title, body: notification.body }, data: notification.data, android: { priority: "high" } } }),
  });
  const body = await response.json().catch(() => ({})) as { error?: { status?: string; details?: { errorCode?: string }[] } };
  return { ok: response.ok, status: response.status, code: body.error?.details?.[0]?.errorCode ?? body.error?.status ?? null };
}
