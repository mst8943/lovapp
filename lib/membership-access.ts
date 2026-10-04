import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type MembershipApplication = { id: string; email: string; full_name: string; application_code: string };
const ACCESS_GRANT_TTL_SECONDS = 24 * 60 * 60;

export async function createApprovedMemberAccess(admin: AdminClient, application: MembershipApplication) {
  const existingUser = await findUserByEmail(admin, application.email);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr";
  const callback = new URL("/auth/callback", appUrl);
  callback.searchParams.set("next", "/update-password");
  const metadata = { approved_member: true, membership_application_id: application.id, application_code: application.application_code };
  const generated = await admin.auth.admin.generateLink(existingUser ? {
    type: "recovery",
    email: application.email,
    options: { redirectTo: callback.toString() },
  } : {
    type: "invite",
    email: application.email,
    options: { redirectTo: callback.toString(), data: { full_name: application.full_name } },
  });
  if (generated.error || !generated.data.properties.action_link || !generated.data.user) {
    throw new Error(generated.error?.message ?? "member_access_link_failed");
  }
  const user = existingUser ?? generated.data.user;
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, ...metadata },
  });
  if (metadataError) throw new Error(metadataError.message);
  const grant = createAccessGrant(application.id);
  const accessUrl = new URL("/member-access", appUrl);
  accessUrl.searchParams.set("grant", grant);
  return { userId: user.id, actionLink: accessUrl.toString(), existingAccount: Boolean(existingUser) };
}

export async function createFreshMemberRecoveryLink(admin: AdminClient, application: MembershipApplication) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr";
  const generated = await admin.auth.admin.generateLink({
    type: "recovery",
    email: application.email,
  });
  const tokenHash = generated.data?.properties?.hashed_token;
  if (generated.error || !tokenHash) {
    throw new Error(generated.error?.message ?? "member_recovery_link_failed");
  }
  // Admin-generated recovery links use an implicit fragment flow. A server
  // callback cannot read that fragment, so verify the hash in our own route
  // and explicitly persist the resulting Supabase session cookies instead.
  const confirm = new URL("/auth/confirm", appUrl);
  confirm.searchParams.set("token_hash", tokenHash);
  confirm.searchParams.set("type", "recovery");
  confirm.searchParams.set("next", "/update-password");
  return confirm.toString();
}

export function verifyAccessGrant(grant: string) {
  const [payload, signature] = grant.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: unknown; applicationId?: unknown; expiresAt?: unknown };
    if (parsed.v !== 1 || typeof parsed.applicationId !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { applicationId: parsed.applicationId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function createAccessGrant(applicationId: string) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    applicationId,
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_GRANT_TTL_SECONDS,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function sign(payload: string) {
  const secret = process.env.MEMBERSHIP_ACCESS_HMAC_SECRET ?? process.env.RATE_LIMIT_HMAC_SECRET;
  if (!secret) throw new Error("membership_access_secret_missing");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

async function findUserByEmail(admin: AdminClient, email: string): Promise<User | null> {
  const expected = email.trim().toLocaleLowerCase("tr-TR");
  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new Error(result.error.message);
    const found = result.data.users.find((user) => user.email?.trim().toLocaleLowerCase("tr-TR") === expected);
    if (found) return found;
    if (result.data.users.length < 200) return null;
  }
  return null;
}
