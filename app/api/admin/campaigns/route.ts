import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const fields = z.object({
  title: z.string().trim().min(4).max(100), body: z.string().trim().min(10).max(280),
  ctaLabel: z.string().trim().min(2).max(40),
  ctaPath: z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9/_?=&%.-]+$/),
  startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }),
  isActive: z.boolean(),
}).refine((campaign) => campaign.endsAt > campaign.startsAt, "Bitiş başlangıçtan sonra olmalı.");

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("app_campaigns")
    .select("id,title,body,cta_label,cta_path,starts_at,ends_at,is_active")
    .order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Kampanyalar yüklenemedi." }, { status: 503 });
  const counts = await Promise.all((data ?? []).map((campaign) => auth.admin.from("app_campaign_clicks")
    .select("campaign_id", { count: "exact", head: true }).eq("campaign_id", campaign.id)));
  if (counts.some((result) => result.error || result.count === null)) return NextResponse.json({ error: "Tıklama sayıları yüklenemedi." }, { status: 503 });
  return NextResponse.json({ campaigns: (data ?? []).map((campaign, index) => ({ ...campaign, uniqueDailyClicks: counts[index].count ?? 0 })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = fields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Kampanya bilgilerini kontrol edin." }, { status: 400 });
  const campaign = parsed.data;
  const { data, error } = await auth.admin.from("app_campaigns").insert({
    title: campaign.title, body: campaign.body, cta_label: campaign.ctaLabel,
    cta_path: campaign.ctaPath, starts_at: campaign.startsAt, ends_at: campaign.endsAt,
    is_active: campaign.isActive, created_by: auth.user.id,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Kampanya kaydedilemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "campaign.created", event_target_type: "app_campaign", event_target_id: data.id, event_metadata: { title: campaign.title, active: campaign.isActive } });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const id = z.string().uuid().safeParse(body?.id);
  const parsed = fields.safeParse(body);
  if (!id.success || !parsed.success) return NextResponse.json({ error: "Kampanya bilgilerini kontrol edin." }, { status: 400 });
  const campaign = parsed.data;
  const { data, error } = await auth.admin.from("app_campaigns").update({
    title: campaign.title, body: campaign.body, cta_label: campaign.ctaLabel,
    cta_path: campaign.ctaPath, starts_at: campaign.startsAt, ends_at: campaign.endsAt,
    is_active: campaign.isActive, updated_at: new Date().toISOString(),
  }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Kampanya güncellenemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "campaign.updated", event_target_type: "app_campaign", event_target_id: data.id, event_metadata: { title: campaign.title, active: campaign.isActive } });
  return NextResponse.json({ updated: true });
}
