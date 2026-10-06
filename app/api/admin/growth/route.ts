import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/), label: z.string().trim().min(2).max(120), kind: z.enum(["ambassador", "community", "campaign"]) });
const toggleSchema = z.object({ id: z.string().uuid(), isActive: z.boolean() });

export async function GET(request: Request) {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const start = params.get("start");
  const end = params.get("end");
  const source = params.get("source")?.trim() || null;
  const validDate = (value: string | null) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
  if (!validDate(start) || !validDate(end) || (source && source.length > 80) || (start && end && start > end)) {
    return NextResponse.json({ error: "Tarih veya kaynak filtresi geçersiz." }, { status: 400 });
  }
  const [campaigns, codes, metrics, productFunnel, humans, bots, activeHumans7, activeHumans30] = await Promise.all([
    auth.admin.from("growth_campaigns").select("id,slug,name,city,member_limit,is_active,starts_at,ends_at").order("created_at"),
    auth.admin.from("referral_codes").select("id,code,kind,label,is_active,max_activations,owner_profile_id,campaign_id,created_at").order("created_at", { ascending: false }),
    auth.admin.rpc("admin_growth_metrics", { start_at: start ? `${start}T00:00:00+03:00` : null, end_at: end ? new Date(Date.parse(`${end}T00:00:00+03:00`) + 86_400_000).toISOString() : null, source_filter: source }),
    auth.admin.rpc("product_funnel_counts", { since_date: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString() }),
    auth.admin.from("profiles").select("id", { count: "exact", head: true }).eq("kind", "human").is("deleted_at", null),
    auth.admin.from("profiles").select("id", { count: "exact", head: true }).eq("kind", "bot").is("deleted_at", null),
    auth.admin.from("profile_presence").select("profile_id,profiles!inner(id)", { count: "exact", head: true }).eq("profiles.kind", "human").is("profiles.deleted_at", null).gte("last_seen_at", new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()),
    auth.admin.from("profile_presence").select("profile_id,profiles!inner(id)", { count: "exact", head: true }).eq("profiles.kind", "human").is("profiles.deleted_at", null).gte("last_seen_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()),
  ]);
  if (campaigns.error || codes.error || metrics.error || productFunnel.error || humans.error || bots.error || activeHumans7.error || activeHumans30.error || !metrics.data) {
    console.error("admin growth query failed", campaigns.error ?? codes.error ?? metrics.error ?? productFunnel.error ?? humans.error ?? bots.error ?? activeHumans7.error ?? activeHumans30.error);
    return NextResponse.json({ error: "Büyüme verileri alınamadı." }, { status: 503 });
  }
  const result = metrics.data as { totals: Record<string, number>; sources: unknown[]; campaignCounts: Record<string, { members: number; applications: number }>; codeCounts: Record<string, number> };
  return NextResponse.json({ campaigns: (campaigns.data ?? []).map((campaign) => ({ ...campaign, ...result.campaignCounts[campaign.id] })), sources: result.sources, codes: (codes.data ?? []).map((code) => ({ ...code, activations: result.codeCounts[code.id] ?? 0 })), productFunnel: productFunnel.data ?? [], totals: { ...result.totals, humanProfiles: humans.count ?? 0, botProfiles: bots.count ?? 0, activeHumans7: activeHumans7.count ?? 0, activeHumans30: activeHumans30.count ?? 0 } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const create = createSchema.safeParse(body);
  if (create.success) {
    const { data: campaign } = await auth.admin.from("growth_campaigns").select("id").eq("slug", "istanbul-kurucu-200").maybeSingle();
    const { data, error } = await auth.admin.from("referral_codes").insert({ code: create.data.code, label: create.data.label, kind: create.data.kind, campaign_id: campaign?.id ?? null, created_by: auth.user.id }).select("id").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Bu kod zaten var." : "Kod oluşturulamadı." }, { status: 400 });
    await auth.session.rpc("write_admin_audit", { event_action: "growth.referral_code.created", event_target_type: "referral_code", event_target_id: data.id, event_metadata: { code: create.data.code, kind: create.data.kind } });
    return NextResponse.json({ ok: true });
  }
  const toggle = toggleSchema.safeParse(body);
  if (!toggle.success) return NextResponse.json({ error: "Alanları kontrol et." }, { status: 400 });
  const { error } = await auth.admin.from("referral_codes").update({ is_active: toggle.data.isActive, updated_at: new Date().toISOString() }).eq("id", toggle.data.id);
  if (error) return NextResponse.json({ error: "Kod güncellenemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "growth.referral_code.updated", event_target_type: "referral_code", event_target_id: toggle.data.id, event_metadata: { isActive: toggle.data.isActive } });
  return NextResponse.json({ ok: true });
}
