import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitRule = {
  scope: string;
  limit: number;
  windowSeconds: number;
  identity?: string;
  identityOnly?: boolean;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

export async function consumeRateLimit(request: Request, rule: RateLimitRule): Promise<RateLimitResult | null> {
  const admin = createAdminClient();
  const secret = process.env.RATE_LIMIT_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !secret) return null;

  const identity = rule.identity?.trim().toLocaleLowerCase("tr-TR") ?? "anonymous";
  const subject = rule.identityOnly ? identity : `${clientAddress(request)}\n${identity}`;
  const subjectHash = createHmac("sha256", secret).update(subject).digest("hex");
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    limit_scope: rule.scope,
    limit_subject_hash: subjectHash,
    max_hits: rule.limit,
    window_seconds: rule.windowSeconds,
  });
  if (error) return null;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return null;
  return {
    allowed: Boolean(result.allowed),
    remaining: Number(result.remaining ?? 0),
    retryAfter: Math.max(1, Number(result.retry_after ?? rule.windowSeconds)),
  };
}

export function rateLimitResponse(result: RateLimitResult | null) {
  if (!result) return null;
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Çok fazla deneme yapıldı. Biraz sonra tekrar dene.", code: "rate_limited" },
    { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": String(result.retryAfter) } },
  );
}

function clientAddress(request: Request) {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}


