import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await createClient(); const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ conversations: [], demo: true });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: role } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !["owner","moderator","support"].includes(role.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  let allowedMatchIds: string[] | null = null;
  if (role.role !== "owner") {
    const { data: grants } = await session.from("conversation_access_grants").select("match_id").eq("admin_user_id", user.id).is("revoked_at", null).gt("expires_at", new Date().toISOString());
    allowedMatchIds = (grants ?? []).map((grant) => grant.match_id);
    if (!allowedMatchIds.length) return NextResponse.json({ conversations: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }
  let matchesQuery = admin.from("matches").select("id,user_a,user_b,last_message_at,matched_at").eq("status", "active").order("last_message_at", { ascending: false, nullsFirst: false }).limit(60);
  if (allowedMatchIds) matchesQuery = matchesQuery.in("id", allowedMatchIds);
  const { data: matches } = await matchesQuery;
  const profileIds = [...new Set((matches ?? []).flatMap((match) => [match.user_a, match.user_b]))];
  const matchIds = (matches ?? []).map((match) => match.id);
  const [{ data: profiles }, { data: messages }, { data: controls }, { data: risks }, { data: hiddenRows }] = await Promise.all([
    profileIds.length ? admin.from("profiles").select("id,display_name,kind").in("id", profileIds) : Promise.resolve({ data: [] }),
    matchIds.length ? admin.from("messages").select("match_id,body,created_at").in("match_id", matchIds).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    matchIds.length ? admin.from("bot_conversation_controls").select("match_id,mode,takeover_expires_at").in("match_id", matchIds) : Promise.resolve({ data: [] }),
    matchIds.length ? admin.from("bot_risk_events").select("match_id,severity,status").in("match_id", matchIds).in("status", ["open","reviewing"]).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    matchIds.length ? admin.from("hidden_conversations").select("match_id,profile_id,hidden_at").in("match_id", matchIds) : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const latest = new Map<string, { body: string | null; created_at: string }>(); for (const message of messages ?? []) if (!latest.has(message.match_id)) latest.set(message.match_id, message);
  const controlMap = new Map((controls ?? []).map((control) => [control.match_id, control]));
  const riskMap = new Map<string, NonNullable<typeof risks>[number]>(); for (const risk of risks ?? []) if (!riskMap.has(risk.match_id)) riskMap.set(risk.match_id, risk);
  const rows = (matches ?? []).flatMap((match) => {
    const a = profileMap.get(match.user_a); const b = profileMap.get(match.user_b); if (!a || !b) return [];
    const control = controlMap.get(match.id); const risk = riskMap.get(match.id);
    const hiddenFor = (hiddenRows ?? []).filter((h) => h.match_id === match.id).map((h) => ({
      profileId: h.profile_id,
      name: profileMap.get(h.profile_id)?.display_name ?? "Kullanıcı",
      hiddenAt: h.hidden_at,
    }));
    return [{ id: match.id, a, b, preview: latest.get(match.id)?.body ?? "Henüz mesaj yok", updatedAt: latest.get(match.id)?.created_at ?? match.matched_at, mode: control?.mode ?? "ai", takeoverExpiresAt: control?.takeover_expires_at ?? null, hasBot: a.kind === "bot" || b.kind === "bot", hasRisk: Boolean(risk), riskSeverity: risk?.severity ?? null, hiddenFor }];
  });
  after(async () => { await session.rpc("write_admin_audit", { event_action: "conversations.listed", event_target_type: "conversation", event_target_id: null, event_metadata: { count: rows.length } }); });
  return NextResponse.json({ conversations: rows }, { headers: { "Cache-Control": "private, no-store" } });
}
