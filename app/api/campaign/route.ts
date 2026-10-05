import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const now = new Date().toISOString();
  const { data, error } = await admin.from("app_campaigns")
    .select("id,title,body,cta_label,cta_path")
    .eq("is_active", true).lte("starts_at", now).gt("ends_at", now)
    .order("starts_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Duyuru yüklenemedi." }, { status: 503 });
  return NextResponse.json({ campaign: data ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Duyuru bulunamadı." }, { status: 400 });
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const now = new Date().toISOString();
  const [{ data: campaign }, { data: profile }] = await Promise.all([
    admin.from("app_campaigns").select("id,cta_path").eq("id", parsed.data.id).eq("is_active", true).lte("starts_at", now).gt("ends_at", now).maybeSingle(),
    admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle(),
  ]);
  if (!campaign || !profile) return NextResponse.json({ error: "Duyuru artık kullanılamıyor." }, { status: 404 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { error } = await admin.from("app_campaign_clicks").insert({ campaign_id: campaign.id, profile_id: profile.id, click_date: today });
  if (error && error.code !== "23505") return NextResponse.json({ error: "Tıklama kaydedilemedi." }, { status: 503 });
  return NextResponse.json({ path: campaign.cta_path });
}
