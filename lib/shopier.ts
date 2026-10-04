import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSettings, encryptSettings } from "@/lib/verification-providers";
import type { ShopierOrder, ShopierTransaction } from "@/lib/shopier-payment";

const API_BASE = "https://api.shopier.com/v1";
const OAUTH_TOKEN_URL = "https://api.shopier.com:8443/v1/oauth2/token";

export const SHOPIER_STATIC_PRODUCTS = {
  "49985664": {
    planSlug: "noir-weekly",
    priceAmount: 199,
    checkoutUrl: "https://www.shopier.com/lovapp/49985664",
  },
  "49836409": {
    planSlug: "noir-monthly",
    priceAmount: 599,
    checkoutUrl: "https://www.shopier.com/lovapp/49836409",
  },
} as const;

export function staticShopierCheckout(planSlug: string) {
  return (
    Object.entries(SHOPIER_STATIC_PRODUCTS).find(
      ([, product]) => product.planSlug === planSlug,
    )?.[1] ?? null
  );
}

type ShopierConnection = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId: string;
};

async function readConnection() {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("shopier_connection")
    .select("encrypted_config")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data?.encrypted_config
    ? {
        encrypted: data.encrypted_config,
        value: decryptSettings<ShopierConnection>(data.encrypted_config),
      }
    : null;
}

export async function shopierConfigured() {
  if (
    !process.env.SHOPIER_CLIENT_ID ||
    !process.env.SHOPIER_CLIENT_SECRET ||
    !process.env.SHOPIER_WEBHOOK_TOKEN ||
    !process.env.VERIFICATION_SETTINGS_KEY
  )
    return false;
  try {
    return Boolean(await readConnection());
  } catch {
    return false;
  }
}

export async function shopierAccountId() {
  return (await readConnection())?.value.accountId ?? null;
}

async function requestShopierToken(
  grantType: "authorization_code" | "refresh_token",
  credential: string,
) {
  const clientId = process.env.SHOPIER_CLIENT_ID;
  const clientSecret = process.env.SHOPIER_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("shopier_oauth_not_configured");
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: grantType,
      client_id: clientId,
      client_secret: clientSecret,
      [grantType === "authorization_code" ? "code" : "refresh_token"]:
        credential,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`shopier_oauth_${response.status}`);
  const result = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!result.access_token || !result.refresh_token || !result.expires_in)
    throw new Error("shopier_oauth_invalid_response");
  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
  };
}

export async function connectShopier(code: string) {
  const tokens = await requestShopierToken("authorization_code", code);
  const ownerResponse = await fetch(`${API_BASE}/shop/owner`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokens.access_token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!ownerResponse.ok)
    throw new Error(`shopier_owner_${ownerResponse.status}`);
  const owner = (await ownerResponse.json()) as { id?: string | number };
  if (!owner.id) throw new Error("shopier_account_missing");
  const admin = createAdminClient();
  if (!admin) throw new Error("shopier_database_unavailable");
  const connection: ShopierConnection = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    accountId: String(owner.id),
  };
  const { error } = await admin.from("shopier_connection").upsert({
    id: true,
    encrypted_config: encryptSettings(connection),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("shopier_connection_save_failed");
  return connection.accountId;
}

async function shopierAccessToken(forceRefresh = false) {
  const current = await readConnection();
  if (!current) throw new Error("shopier_not_connected");
  if (!forceRefresh && current.value.expiresAt > Date.now() + 60_000)
    return current.value.accessToken;
  let tokens;
  try {
    tokens = await requestShopierToken(
      "refresh_token",
      current.value.refreshToken,
    );
  } catch (error) {
    const latest = await readConnection();
    if (latest && latest.encrypted !== current.encrypted)
      return latest.value.accessToken;
    throw error;
  }
  const admin = createAdminClient();
  if (!admin) throw new Error("shopier_database_unavailable");
  const next: ShopierConnection = {
    ...current.value,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  const { data, error } = await admin
    .from("shopier_connection")
    .update({
      encrypted_config: encryptSettings(next),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .eq("encrypted_config", current.encrypted)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("shopier_token_save_failed");
  if (data) return next.accessToken;
  return (await readConnection())?.value.accessToken ?? next.accessToken;
}

export async function getVerifiedShopierPayment(orderId: string) {
  const [order, transaction] = await Promise.all([
    shopierFetch<ShopierOrder>(
      `/orders/${encodeURIComponent(orderId)}`,
      undefined,
      2500,
    ),
    shopierFetch<ShopierTransaction>(
      `/orders/transactions/${encodeURIComponent(orderId)}`,
      undefined,
      2500,
    ),
  ]);
  return { order, transaction };
}

export function verifyShopierWebhook(
  rawBody: string,
  providedSignature: string | null,
) {
  const token = process.env.SHOPIER_WEBHOOK_TOKEN;
  if (!token || !providedSignature) return false;
  const signature = providedSignature.trim().replace(/^sha256=/i, "");
  const digest = createHmac("sha256", token).update(rawBody, "utf8").digest();
  const candidates: Buffer[] = [];
  if (/^[0-9a-f]{64}$/i.test(signature))
    candidates.push(Buffer.from(signature, "hex"));
  try {
    candidates.push(Buffer.from(signature, "base64"));
  } catch {
    /* Invalid base64. */
  }
  return candidates.some(
    (candidate) =>
      candidate.length === digest.length && timingSafeEqual(candidate, digest),
  );
}

async function shopierFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<T> {
  const send = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  let response = await send(await shopierAccessToken());
  if (response.status === 401)
    response = await send(await shopierAccessToken(true));
  const body = (await response.json().catch(() => null)) as
    T | { message?: string } | null;
  if (!response.ok) throw new Error(`shopier_api_${response.status}`);
  return body as T;
}
