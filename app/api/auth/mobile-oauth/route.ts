import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readOpenRegistration } from "@/lib/registration-settings";
import { notifyHermes } from "@/lib/hermes-notifications";

// Native PKCE is exchanged by the device, so apply the same approval rule as
// /auth/callback here, without returning or handling device refresh tokens.
export async function POST(request: Request) {
  const input = z.object({ flow: z.enum(["login", "register"]) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Geçersiz giriş akışı." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (user.app_metadata.approved_member === true) return NextResponse.json({ approved: true });
  const google = user.identities?.some((identity) => identity.provider === "google");
  if (!google) return NextResponse.json({ error: "Onaylanmış üyelik gerekli.", code: "application_required" }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Giriş sistemi kullanılamıyor." }, { status: 503 });
  const registration = await readOpenRegistration(admin);
  if (registration.error) return NextResponse.json({ error: "Kayıt modu doğrulanamadı." }, { status: 503 });
  if (!registration.enabled) return NextResponse.json(input.data.flow === "register"
    ? { error: "Standart kayıt şu anda kapalı.", code: "registration_closed" }
    : { error: "Onaylanmış üyelik gerekli.", code: "application_required" }, { status: 403 });
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, approved_member: true, registration_source: "open_google" } });
  if (error) return NextResponse.json({ error: "Üyelik onaylanamadı." }, { status: 503 });
  await admin.from("product_funnel_events").insert({ event_name: "signup_completed", subject_id: user.id, source: "android" });
  await notifyHermes({ title: "Yeni Lovask üyeliği", fields: { platform: "android", provider: "Google" }, dedupeKey: `signup:${user.id}` });
  return NextResponse.json({ approved: true }, { headers: { "Cache-Control": "private, no-store" } });
}
