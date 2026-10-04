import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  event: z.literal("campaign_viewed"),
  campaign: z.string().trim().max(80),
  referralCode: z.string().trim().toUpperCase().max(32).optional().default(""),
  source: z.string().trim().max(100).optional().default("direct"),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz olay." }, { status: 400 });
  const limited = rateLimitResponse(await consumeRateLimit(request, { scope: "growth.track", limit: 30, windowSeconds: 3600 }));
  if (limited) return limited;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });
  const [{ data: campaign }, { data: code }] = await Promise.all([
    admin.from("growth_campaigns").select("id").eq("slug", parsed.data.campaign).maybeSingle(),
    parsed.data.referralCode ? admin.from("referral_codes").select("id").eq("code", parsed.data.referralCode).eq("is_active", true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (campaign) await admin.from("growth_events").insert({ event_name: parsed.data.event, campaign_id: campaign.id, referral_code_id: code?.id ?? null, source: parsed.data.source });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
