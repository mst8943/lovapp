import "server-only";

import type { NextRequest } from "next/server";

type TurnstileResult = { success: boolean; unavailable: boolean };

export async function verifyTurnstile(request: NextRequest, token: string, expectedAction: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    const partiallyConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    return { success: !partiallyConfigured, unavailable: partiallyConfigured };
  }

  const body = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get("cf-connecting-ip")?.trim()
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { success: false, unavailable: true };
    const result = await response.json() as { success?: boolean; action?: string };
    return { success: result.success === true && result.action === expectedAction, unavailable: false };
  } catch {
    return { success: false, unavailable: true };
  }
}
