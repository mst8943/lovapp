import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasValidAuthOrigin } from "@/lib/auth-origin";
import { notifyHermes, hermesCooldownKey } from "@/lib/hermes-notifications";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("forgot_password"), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ event: z.literal("change_password"), password: z.string().min(6).max(128) }),
]);

export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "İstek bilgilerini kontrol et." }, { status: 400 });
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "Giriş sistemi şu anda kullanılamıyor." }, { status: 503 });

  if (parsed.data.event === "forgot_password") {
    const ipLimit = await consumeRateLimit(request, { scope: "auth.forgot-password.ip", limit: 8, windowSeconds: 3600 });
    if (!ipLimit) return NextResponse.json({ error: "İşlem şu anda tamamlanamadı." }, { status: 503 });
    const ipLimited = rateLimitResponse(ipLimit);
    if (ipLimited) return ipLimited;
    const limit = await consumeRateLimit(request, { scope: "auth.forgot-password", limit: 5, windowSeconds: 3600, identity: parsed.data.email });
    if (!limit) return NextResponse.json({ error: "İşlem şu anda tamamlanamadı." }, { status: 503 });
    const limited = rateLimitResponse(limit);
    if (limited) return limited;
    const redirectTo = new URL("/auth/callback?next=/update-password", request.url).toString();
    const { error } = await session.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
    if (error) console.error("Password recovery request failed");
    else await notifyHermes({ title: "Şifre sıfırlama isteği", dedupeKey: hermesCooldownKey("forgot-password", parsed.data.email) });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { error } = await session.auth.updateUser({ password: parsed.data.password });
  if (error) return NextResponse.json({ error: "Şifre güncellenemedi. Yeni bir bağlantı iste." }, { status: 409 });
  await notifyHermes({ title: "Şifre başarıyla değiştirildi", dedupeKey: `password-changed:${user.id}` });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
