import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasValidAuthOrigin } from "@/lib/auth-origin";

const schema = z.object({
  mode: z.literal("login"),
  email: z.string().trim().email("Geçerli bir e-posta adresi gir.").max(254),
  password: z.string().min(1, "Şifreni gir.").max(128),
});

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request)) return NextResponse.json({ error: "Geçersiz istek.", code: "invalid_origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "E-posta veya şifreyi kontrol et.", code: "validation_failed" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Canlı bağlantı gerekli.", code: "not_configured" }, { status: 503 });

  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => { pendingCookies.push(...cookies); },
    },
  });
  const result = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });

  if (result.error) {
    return NextResponse.json({ error: "Oturum açılamadı.", code: result.error.code ?? "auth_unavailable" }, { status: result.error.status || 400 });
  }
  if (!result.data.session) {
    return NextResponse.json({ error: "Oturum oluşturulamadı.", code: "session_missing" }, { status: 409 });
  }
  if (result.data.user.app_metadata.approved_member !== true) {
    return NextResponse.json({ error: "Onaylanmış üyelik gerekli.", code: "application_required" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, mode: parsed.data.mode });
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
