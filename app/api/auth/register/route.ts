import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidAuthOrigin } from "@/lib/auth-origin";
import { readOpenRegistration } from "@/lib/registration-settings";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { notifyHermes } from "@/lib/hermes-notifications";

const schema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Ad soyad en az 3 karakter olmalı.")
      .max(120, "Ad soyad en fazla 120 karakter olabilir."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Geçerli bir e-posta adresi gir.")
      .max(254, "E-posta adresi çok uzun."),
    password: z
      .string()
      .min(6, "Şifre en az 6 karakter olmalı.")
      .max(128, "Şifre en fazla 128 karakter olabilir."),
    passwordConfirmation: z
      .string()
      .min(6, "Şifre tekrarı en az 6 karakter olmalı.")
      .max(128, "Şifre tekrarı en fazla 128 karakter olabilir."),
    termsAccepted: z.literal(true, {
      error: "Kullanım Koşulları kabul edilmelidir.",
    }),
    privacyAccepted: z.literal(true, {
      error: "Gizlilik metni kabul edilmelidir.",
    }),
    marketingConsent: z.boolean(),
    platform: z.enum(["android"]).optional(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: "Şifreler eşleşmiyor.",
    path: ["passwordConfirmation"],
  });

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function GET() {
  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "Kayıt sistemi kullanılamıyor." },
      { status: 503 },
    );
  const setting = await readOpenRegistration(admin);
  if (setting.error)
    return NextResponse.json(
      { error: "Kayıt modu doğrulanamadı." },
      { status: 503 },
    );
  return NextResponse.json(
    {
      enabled: setting.enabled,
      challengeRequired: Boolean(
        process.env.TURNSTILE_SECRET_KEY ||
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      ),
      googleEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request))
    return NextResponse.json(
      { error: "Geçersiz istek.", code: "invalid_origin" },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Kayıt bilgilerini kontrol et.",
        code: "validation_failed",
      },
      { status: 400 },
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createAdminClient();
  if (!url || !key || !admin)
    return NextResponse.json(
      { error: "Kayıt sistemi kullanılamıyor.", code: "not_configured" },
      { status: 503 },
    );

  const setting = await readOpenRegistration(admin);
  if (setting.error)
    return NextResponse.json(
      { error: "Kayıt modu doğrulanamadı.", code: "auth_unavailable" },
      { status: 503 },
    );
  if (!setting.enabled)
    return NextResponse.json(
      { error: "Standart kayıt şu anda kapalı.", code: "registration_closed" },
      { status: 403 },
    );

  const limit = await consumeRateLimit(request, {
    scope: "auth.register",
    limit: 8,
    windowSeconds: 3600,
  });
  if (!limit)
    return NextResponse.json(
      {
        error: "Kayıt güvenlik kontrolü kullanılamıyor.",
        code: "rate_limit_unavailable",
      },
      { status: 503 },
    );
  const limited = rateLimitResponse(limit);
  if (limited) return limited;

  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        pendingCookies.push(...cookies);
      },
    },
  });
  const appOrigin =
    process.env.NODE_ENV === "production"
      ? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr")
          .origin
      : new URL(request.url).origin;
  const result = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
        marketing_consent_at: parsed.data.marketingConsent
          ? new Date().toISOString()
          : null,
      },
      emailRedirectTo: `${appOrigin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
    },
  });
  if (result.error?.code === "user_already_exists") {
    return NextResponse.json(
      {
        error: "Bu e-postayla zaten bir hesap olabilir. Giriş yapmayı dene.",
        code: "account_exists",
      },
      { status: 409 },
    );
  }
  if (result.error)
    return NextResponse.json(
      {
        error:
          result.error.code === "weak_password"
            ? "Şifre sağlayıcı tarafından zayıf bulundu. En az 6 karakterlik farklı bir şifre dene."
            : "Hesap oluşturulamadı. Biraz sonra tekrar dene.",
        code: result.error.code ?? "signup_failed",
      },
      { status: result.error.status || 400 },
    );
  if (!result.data.user || result.data.user.identities?.length === 0) {
    return NextResponse.json(
      {
        error: "Bu e-postayla zaten bir hesap olabilir. Giriş yapmayı dene.",
        code: "account_exists",
      },
      { status: 409 },
    );
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(
    result.data.user.id,
    {
      app_metadata: {
        ...result.data.user.app_metadata,
        approved_member: true,
        registration_source: "open_email",
      },
    },
  );
  if (metadataError) {
    await admin.auth.admin.deleteUser(result.data.user.id);
    return NextResponse.json(
      { error: "Üyelik yetkisi oluşturulamadı.", code: "auth_unavailable" },
      { status: 503 },
    );
  }
  await admin
    .from("product_funnel_events")
    .insert({
      event_name: "signup_completed",
      subject_id: result.data.user.id,
      source: parsed.data.platform ?? "web",
    });
  await notifyHermes({ title: "Yeni Lovask üyeliği", fields: { platform: parsed.data.platform ?? "web" }, dedupeKey: `signup:${result.data.user.id}` });

  // The signup token predates approved_member; onboarding checks that JWT claim.
  if (result.data.session) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: result.data.session.refresh_token,
    });
    if (error || !data.session) {
      return NextResponse.json(
        {
          error:
            "Hesabın oluşturuldu ancak oturum yenilenemedi. Giriş yaparak devam edebilirsin.",
          code: "session_refresh_failed",
        },
        { status: 503 },
      );
    }
  }

  const response = NextResponse.json({
    ok: true,
    requiresEmailConfirmation: !result.data.session,
  });
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
