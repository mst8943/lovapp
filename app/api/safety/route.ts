import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifyHermes } from "@/lib/hermes-notifications";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block"), targetProfileId: z.string().uuid() }),
  z.object({ action: z.literal("unblock"), targetProfileId: z.string().uuid() }),
  z.object({ action: z.literal("unmatch"), targetProfileId: z.string().uuid() }),
  z.object({ action: z.literal("report"), targetProfileId: z.string().uuid(), reason: z.enum(["fake_profile","harassment","inappropriate_content","fraud","underage","spam","other"]), details: z.string().trim().max(1000).optional(), matchId: z.string().uuid().nullable().optional(), block: z.boolean().default(true) }),
]);

export async function GET() {
  const session = await createClient(); const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ blocked: [] });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ blocked: [] });
  const { data } = await admin.from("blocks").select("blocked_id,created_at,profiles!blocks_blocked_id_fkey(display_name)").eq("blocker_id", profile.id).order("created_at", { ascending: false });
  return NextResponse.json({ blocked: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "İşlem bilgilerini kontrol edin." }, { status: 400 });
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (parsed.data.action === "report") {
    const limit = await consumeRateLimit(request, { scope: "safety.report", limit: 5, windowSeconds: 86400, identity: user.id, identityOnly: true });
    if (!limit) return NextResponse.json({ error: "Şikâyet şu anda alınamıyor." }, { status: 503 });
    const limited = rateLimitResponse(limit);
    if (limited) return limited;
  }
  const rpc = parsed.data.action === "block"
    ? session.rpc("block_profile", { target_profile: parsed.data.targetProfileId })
    : parsed.data.action === "unblock"
      ? session.rpc("unblock_profile", { target_profile: parsed.data.targetProfileId })
      : parsed.data.action === "unmatch"
        ? session.rpc("unmatch_profile", { target_profile: parsed.data.targetProfileId })
      : session.rpc("submit_profile_report", { target_profile: parsed.data.targetProfileId, report_reason: parsed.data.reason, report_details: parsed.data.details ?? null, related_match: parsed.data.matchId ?? null });
  const { data, error } = await rpc;
  if (error) return NextResponse.json({ error: "Güvenlik işlemi tamamlanamadı." }, { status: 409 });
  if (parsed.data.action === "report" && parsed.data.matchId) {
    await admin.from("bot_experiment_assignments").update({ reported_at: new Date().toISOString() }).eq("match_id", parsed.data.matchId).is("reported_at", null);
  } else if (parsed.data.action === "block") {
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (profile) {
      const { data: match } = await admin.from("matches").select("id").or(`and(user_a.eq.${profile.id},user_b.eq.${parsed.data.targetProfileId}),and(user_a.eq.${parsed.data.targetProfileId},user_b.eq.${profile.id})`).order("matched_at", { ascending: false }).limit(1).maybeSingle();
      if (match) await admin.from("bot_experiment_assignments").update({ blocked_at: new Date().toISOString() }).eq("match_id", match.id).is("blocked_at", null);
    }
  }
  if (parsed.data.action === "report" && parsed.data.block) {
    const { error: blockError } = await session.rpc("block_profile", { target_profile: parsed.data.targetProfileId });
    if (blockError) return NextResponse.json({ error: "Şikâyet alındı ancak profil engellenemedi." }, { status: 409 });
  }
  if (parsed.data.action === "report") await notifyHermes({ title: "Yeni kullanıcı şikâyeti", fields: { reportId: typeof data === "string" ? data.slice(0, 8) : undefined, reason: parsed.data.reason } });
  return NextResponse.json({ ok: true, reportId: parsed.data.action === "report" ? data : undefined });
}
