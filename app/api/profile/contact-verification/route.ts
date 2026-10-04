import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeTurkishMobile, sendNetgsmSms, sendResendEmail } from "@/lib/application-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readVerificationSettings } from "@/lib/verification-settings";
import { readProviderConfig } from "@/lib/verification-providers";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({ action: z.enum(["send", "confirm"]), channel: z.enum(["email", "sms"]), code: z.string().regex(/^\d{6}$/).optional() });

async function context() {
  const session = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile ? { admin, profile, user } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const [flags, { data }, { data: privateData }] = await Promise.all([
    readVerificationSettings(ctx.admin),
    ctx.admin.from("contact_verification_challenges").select("channel,destination,verified_at").eq("profile_id", ctx.profile.id),
    ctx.admin.from("private_profile_data").select("phone").eq("profile_id", ctx.profile.id).maybeSingle(),
  ]);
  if (flags.error) return NextResponse.json({ error: "Ayarlar yüklenemedi." }, { status: 503 });
  return NextResponse.json({ emailEnabled: flags.emailEnabled, smsEnabled: flags.smsEnabled, emailVerified: data?.some((row) => row.channel === "email" && row.destination === ctx.user.email && row.verified_at) ?? false, smsVerified: data?.some((row) => row.channel === "sms" && row.destination === normalizeTurkishMobile(privateData?.phone ?? "") && row.verified_at) ?? false }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz doğrulama isteği." }, { status: 400 });
  const limited = rateLimitResponse(await consumeRateLimit(request, { scope: "contact.verification", limit: 12, windowSeconds: 3600 }));
  if (limited) return limited;
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const flags = await readVerificationSettings(ctx.admin);
  if (flags.error) return NextResponse.json({ error: "Ayarlar doğrulanamadı." }, { status: 503 });
  if (!(parsed.data.channel === "email" ? flags.emailEnabled : flags.smsEnabled)) return NextResponse.json({ error: "Bu doğrulama şu anda kapalı." }, { status: 403 });
  const { data: privateData } = await ctx.admin.from("private_profile_data").select("phone").eq("profile_id", ctx.profile.id).maybeSingle();
  const destination = parsed.data.channel === "email" ? ctx.user.email : normalizeTurkishMobile(privateData?.phone ?? "");
  if (!destination) return NextResponse.json({ error: "Doğrulanacak iletişim bilgisi bulunamadı." }, { status: 409 });
  const { data: existing } = await ctx.admin.from("contact_verification_challenges").select("destination,code_hash,expires_at,attempts,verified_at,created_at").eq("profile_id", ctx.profile.id).eq("channel", parsed.data.channel).maybeSingle();
  if (parsed.data.action === "send") {
    if (existing?.verified_at && existing.destination === destination) return NextResponse.json({ verified: true });
    if (existing?.created_at && Date.now() - Date.parse(existing.created_at) < 60_000) return NextResponse.json({ error: "Yeni kod için bir dakika bekle." }, { status: 429 });
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    let provider;
    try { provider = await readProviderConfig(ctx.admin); } catch { return NextResponse.json({ error: "Sağlayıcı ayarları kullanılamıyor." }, { status: 503 }); }
    const { error } = await ctx.admin.from("contact_verification_challenges").upsert({ profile_id: ctx.profile.id, channel: parsed.data.channel, destination, code_hash: hash(ctx.profile.id, parsed.data.channel, code), expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0, verified_at: null, created_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Kod oluşturulamadı." }, { status: 503 });
    const delivery = parsed.data.channel === "email"
      ? await sendResendEmail({ to: destination, name: "Lovask üyesi", subject: "Lovask doğrulama kodun", text: `Doğrulama kodun: ${code}. Kod 10 dakika geçerlidir.`, html: `<p>Lovask doğrulama kodun: <strong>${code}</strong>. Kod 10 dakika geçerlidir.</p>` }, provider)
      : await sendNetgsmSms(destination, `Lovask dogrulama kodunuz: ${code}. 10 dakika gecerlidir.`, provider);
    if (!delivery.sent) {
      await ctx.admin.from("contact_verification_challenges").delete().eq("profile_id", ctx.profile.id).eq("channel", parsed.data.channel);
      return NextResponse.json({ error: "Kod gönderilemedi. Sağlayıcı ayarlarını kontrol edin." }, { status: 503 });
    }
    return NextResponse.json({ sent: true });
  }
  if (!parsed.data.code) return NextResponse.json({ error: "Kod geçersiz veya süresi dolmuş." }, { status: 400 });
  const { data: expectedHash, error: attemptError } = await ctx.admin.rpc("take_contact_verification_attempt", { p_profile: ctx.profile.id, p_channel: parsed.data.channel, p_destination: destination });
  if (attemptError || !expectedHash) return NextResponse.json({ error: "Kod geçersiz veya süresi dolmuş." }, { status: 400 });
  const actual = Buffer.from(hash(ctx.profile.id, parsed.data.channel, parsed.data.code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Kod yanlış." }, { status: 400 });
  }
  const { data: verified, error } = await ctx.admin.from("contact_verification_challenges").update({ verified_at: new Date().toISOString() }).eq("profile_id", ctx.profile.id).eq("channel", parsed.data.channel).eq("code_hash", expectedHash).is("verified_at", null).select("verified_at").maybeSingle();
  return error || !verified ? NextResponse.json({ error: "Doğrulama kaydedilemedi. Yeni kod iste." }, { status: 409 }) : NextResponse.json({ verified: true });
}

function hash(profileId: string, channel: string, code: string) {
  return createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY}:${profileId}:${channel}:${code}`).digest("hex");
}
