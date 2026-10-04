import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliveryUpdate, normalizeTurkishMobile, sendApplicationReceipt } from "@/lib/application-notifications";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const PRIVACY_NOTICE_VERSION = "2026-08-11";
const schema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLocaleLowerCase("tr-TR")),
  phone: z.string().trim().min(10).max(24).transform((value, context) => {
    const phone = normalizeTurkishMobile(value);
    if (!phone) context.addIssue({ code: "custom", message: "Geçerli bir Türkiye cep telefonu yazın." });
    return phone ?? "";
  }),
  instagramUsername: z.string().trim().max(31).optional().default("").transform((value) => value.replace(/^@/, "")),
  occupation: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).optional().default(""),
  applicationNote: z.string().trim().max(800).optional().default(""),
  marketingConsent: z.boolean().default(false),
  notificationConsent: z.literal(true),
  privacyNoticeAccepted: z.literal(true),
  companyWebsite: z.string().max(0).optional().default(""),
  turnstileToken: z.string().max(4096).optional().default(""),
}).refine((value) => !value.instagramUsername || /^[A-Za-z0-9._]{1,30}$/.test(value.instagramUsername), { path: ["instagramUsername"], message: "Instagram kullanıcı adını kontrol et." });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Başvuru alanlarını kontrol et." }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Başvuru sistemi şu anda kullanılamıyor." }, { status: 503 });

  const input = parsed.data;
  const rateLimit = await consumeRateLimit(request, { scope: "applications.create", limit: 5, windowSeconds: 3600 });
  if (!rateLimit) return NextResponse.json({ error: "Başvuru güvenlik kontrolü kullanılamıyor." }, { status: 503 });
  const limited = rateLimitResponse(rateLimit);
  if (limited) return limited;
  const challenge = await verifyTurnstile(request, input.turnstileToken, "membership_application");
  if (!challenge.success) return NextResponse.json({ error: challenge.unavailable ? "Güvenlik doğrulaması kullanılamıyor." : "Güvenlik doğrulamasını tamamla." }, { status: challenge.unavailable ? 503 : 403 });

  const { data, error } = await admin.from("membership_applications").insert({
    email: input.email,
    phone_e164: input.phone,
    full_name: input.fullName,
    instagram_username: input.instagramUsername || null,
    occupation: input.occupation,
    industry: input.industry,
    city: input.city || null,
    application_note: input.applicationNote || null,
    marketing_consent: input.marketingConsent,
    notification_consent: input.notificationConsent,
    privacy_notice_version: PRIVACY_NOTICE_VERSION,
  }).select("id,application_code,full_name,email,phone_e164").single();
  if (error?.code === "23505") return accepted();
  if (error || !data) return NextResponse.json({ error: "Başvuru kaydedilemedi." }, { status: 503 });

  const deliveries = await sendApplicationReceipt({
    fullName: data.full_name,
    email: data.email,
    phoneE164: data.phone_e164,
    applicationCode: data.application_code,
  });
  await admin.from("membership_applications").update(deliveryUpdate(deliveries, "receipt")).eq("id", data.id);
  return accepted();
}

function accepted() {
  return NextResponse.json({ received: true }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const requestProtocol = (request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")).split(",")[0].trim();
  try {
    const source = new URL(origin);
    return source.host === requestHost && source.protocol === `${requestProtocol}:`;
  } catch {
    return false;
  }
}
