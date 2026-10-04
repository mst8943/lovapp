import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const webPushSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(8).max(256) }),
});
const fcmSchema = z.object({
  fcmToken: z.string().min(10).max(2048),
});
const subscriptionSchema = z.union([webPushSchema, fcmSchema]);

const deleteSchema = z.object({
  endpoint: z.string().max(2048).optional(),
  fcmToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz bildirim aboneliği." }, { status: 400 });
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });

  const endpoint = "fcmToken" in parsed.data ? `fcm:${parsed.data.fcmToken}` : parsed.data.endpoint;
  const p256dh = "fcmToken" in parsed.data ? "fcm_token_placeholder_for_mobile" : parsed.data.keys.p256dh;
  const auth = "fcmToken" in parsed.data ? "fcm_auth_placeholder" : parsed.data.keys.auth;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? ("fcmToken" in parsed.data ? "Lovask Android App" : null);

  const { error } = await admin.from("push_subscriptions").upsert({
    profile_id: profile.id,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    disabled_at: null,
    failure_count: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Bildirim tercihi kaydedilemedi." }, { status: 503 });
  return NextResponse.json({ subscribed: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz bildirim aboneliği." }, { status: 400 });
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (profile) {
    const targetEndpoint = parsed.data.fcmToken ? `fcm:${parsed.data.fcmToken}` : parsed.data.endpoint;
    if (targetEndpoint) {
      await admin.from("push_subscriptions").delete().eq("profile_id", profile.id).eq("endpoint", targetEndpoint);
    }
  }
  return NextResponse.json({ subscribed: false });
}
