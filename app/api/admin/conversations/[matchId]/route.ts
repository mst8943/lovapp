import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { scheduleBotReply } from "@/lib/ai/automation";

const modeSchema = z.object({
  action: z.literal("mode").optional(),
  mode: z.enum(["ai", "admin", "paused"]),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  autoReturn: z.boolean().default(true),
  reason: z.string().trim().min(5).max(500).optional(),
});
const relationshipSchema = z.object({
  action: z.literal("relationship"),
  stage: z.enum(["new_match", "getting_to_know", "comfortable", "closer", "distant", "reconnecting"]),
  score: z.number().int().min(-100).max(100),
});
const memorySchema = z.object({ action: z.literal("memory.delete") });
const riskSchema = z.object({
  action: z.literal("risk"),
  riskId: z.string().uuid(),
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolution: z.string().trim().max(500).optional(),
});
const dailyStateSchema = z.object({
  action: z.literal("daily_state"),
  energy: z.enum(["low", "normal", "high"]),
  availability: z.enum(["busy", "relaxed", "brief"]),
  mood: z.enum(["cheerful", "calm", "thoughtful", "stressed"]),
  context: z.string().trim().min(1).max(240),
});
const patchSchema = z.union([modeSchema, relationshipSchema, memorySchema, riskSchema, dailyStateSchema]);
const sendSchema = z.object({ message: z.string().trim().min(1).max(1200) });

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await conversationContext((await context.params).matchId);
  if (auth instanceof NextResponse) return auth;
  const { data: messages } = await auth.admin.from("messages").select("id,sender_id,kind,body,audio_path,created_at,sent_by_admin").eq("match_id", auth.match.id).order("created_at").limit(120);
  const visibleMessages = await Promise.all((messages ?? []).map(async ({ audio_path, ...message }) => {
    if (message.kind !== "image" || !audio_path) return { ...message, imageUrl: null };
    const { data } = await auth.admin.storage.from("chat-images").createSignedUrl(audio_path, 900);
    return { ...message, imageUrl: data?.signedUrl ?? null };
  }));
  await auth.session.rpc("write_admin_audit", { event_action: "conversation.viewed", event_target_type: "conversation", event_target_id: auth.match.id, event_metadata: { hasBot: Boolean(auth.bot) } });
  const [{ data: risks }, { data: memory }, { data: relationship }, dailyResult] = await Promise.all([
    auth.admin.from("bot_risk_events").select("id,category,severity,status,created_at,resolution").eq("match_id", auth.match.id).order("created_at", { ascending: false }).limit(10),
    auth.admin.from("bot_conversation_memory").select("summary,facts,updated_at").eq("match_id", auth.match.id).maybeSingle(),
    auth.admin.from("bot_relationship_state").select("stage,score,admin_override").eq("match_id", auth.match.id).maybeSingle(),
    auth.bot
      ? auth.admin.from("bot_daily_states").select("energy,availability,mood,context,generated_automatically,state_date").eq("bot_profile_id", auth.bot.id).order("state_date", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return NextResponse.json({ match: auth.match, profiles: auth.profiles, mode: auth.control?.mode ?? "ai", control: auth.control, messages: visibleMessages, risks: risks ?? [], memory, relationship, dailyState: dailyResult.data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Gönderilen ayar geçersiz." }, { status: 400 });
  const auth = await conversationContext((await context.params).matchId);
  if (auth instanceof NextResponse) return auth;
  if (!auth.bot) return NextResponse.json({ error: "Bu işlem yalnızca bot sohbetlerinde kullanılabilir." }, { status: 409 });

  if (parsed.data.action === "relationship") {
    const payload = { match_id: auth.match.id, stage: parsed.data.stage, score: parsed.data.score, admin_override: true, updated_by: auth.user.id, updated_at: new Date().toISOString() };
    const { error } = await auth.admin.from("bot_relationship_state").upsert(payload);
    if (error) return NextResponse.json({ error: "İlişki durumu kaydedilemedi." }, { status: 500 });
    await audit(auth, "conversation.relationship.overridden", { stage: parsed.data.stage, score: parsed.data.score });
    return NextResponse.json({ relationship: payload });
  }

  if (parsed.data.action === "memory.delete") {
    const { error } = await auth.admin.from("bot_conversation_memory").delete().eq("match_id", auth.match.id);
    if (error) return NextResponse.json({ error: "Bot hafızası silinemedi." }, { status: 500 });
    await audit(auth, "conversation.memory.deleted", {});
    return NextResponse.json({ deleted: true });
  }

  if (parsed.data.action === "risk") {
    if (!['owner', 'moderator', 'support'].includes(auth.role)) return NextResponse.json({ error: "Risk inceleme yetkiniz yok." }, { status: 403 });
    const now = new Date().toISOString();
    const { data: event, error } = await auth.admin.from("bot_risk_events").update({ status: parsed.data.status, resolution: parsed.data.resolution ?? null, reviewed_by: auth.user.id, reviewed_at: now }).eq("id", parsed.data.riskId).eq("match_id", auth.match.id).select("id").maybeSingle();
    if (error || !event) return NextResponse.json({ error: "Risk kaydı güncellenemedi." }, { status: 500 });
    await audit(auth, "conversation.risk.reviewed", { riskId: parsed.data.riskId, status: parsed.data.status });
    return NextResponse.json({ reviewed: true });
  }

  if (parsed.data.action === "daily_state") {
    if (!['owner', 'bot_editor'].includes(auth.role)) return NextResponse.json({ error: "Günlük durum düzenleme yetkiniz yok." }, { status: 403 });
    const stateDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const payload = { bot_profile_id: auth.bot.id, state_date: stateDate, energy: parsed.data.energy, availability: parsed.data.availability, mood: parsed.data.mood, context: parsed.data.context, generated_automatically: false, updated_by: auth.user.id, updated_at: new Date().toISOString() };
    const { error } = await auth.admin.from("bot_daily_states").upsert(payload, { onConflict: "bot_profile_id,state_date" });
    if (error) return NextResponse.json({ error: "Günlük durum kaydedilemedi." }, { status: 500 });
    await audit(auth, "bot.daily_state.overridden", { botId: auth.bot.id, stateDate });
    return NextResponse.json({ dailyState: payload });
  }

  const expiresAt = parsed.data.mode === "admin" && parsed.data.autoReturn
    ? new Date(Date.now() + (parsed.data.durationMinutes ?? 60) * 60_000).toISOString()
    : null;
  const { error } = await auth.admin.from("bot_conversation_controls").upsert({ match_id: auth.match.id, mode: parsed.data.mode, takeover_expires_at: expiresAt, auto_return_to_ai: parsed.data.autoReturn, pause_reason: parsed.data.mode === "paused" ? parsed.data.reason ?? "admin_paused" : null, updated_by: auth.user.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Sohbet modu değiştirilemedi." }, { status: 500 });
  if (parsed.data.mode !== "ai") {
    await auth.admin.from("bot_reply_jobs").update({ status: "cancelled", cancellation_reason: `${parsed.data.mode}_takeover`, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("match_id", auth.match.id).in("status", ["queued", "typing", "processing"]);
  } else {
    const member = auth.profiles.find((profile) => profile.kind === "human");
    const { data: latest } = await auth.admin.from("messages").select("id,sender_id").eq("match_id", auth.match.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (member && latest?.sender_id === member.id) await scheduleBotReply({ admin: auth.admin, matchId: auth.match.id, botProfileId: auth.bot.id, memberProfileId: member.id, sourceMessageId: latest!.id });
  }
  await audit(auth, "conversation.mode.changed", { mode: parsed.data.mode, expiresAt, autoReturn: parsed.data.autoReturn, reason: parsed.data.reason ?? null });
  return NextResponse.json({ mode: parsed.data.mode, takeoverExpiresAt: expiresAt });
}

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mesajı kontrol et." }, { status: 400 });
  const auth = await conversationContext((await context.params).matchId);
  if (auth instanceof NextResponse) return auth;
  if (!auth.bot || auth.control?.mode !== "admin") return NextResponse.json({ error: "Önce admin devralmasını etkinleştir." }, { status: 409 });
  const { data: message, error } = await auth.admin.from("messages").insert({ match_id: auth.match.id, sender_id: auth.bot.id, kind: "text", body: parsed.data.message, sent_by_admin: auth.user.id }).select("id,created_at").single();
  if (error || !message) return NextResponse.json({ error: "Mesaj gönderilemedi." }, { status: 500 });
  await auth.admin.from("matches").update({ last_message_at: message.created_at }).eq("id", auth.match.id);
  const recipient = auth.profiles.find((profile) => profile.kind === "human");
  if (recipient) after(() => sendPushToProfile(auth.admin, recipient.id, { title: "Lovask", body: `${auth.bot!.display_name} sana yazdı.`, url: `/?open=chat&match=${auth.match.id}`, tag: `match-${auth.match.id}`, matchId: auth.match.id }));
  await audit(auth, "conversation.admin_message.sent", { messageId: message.id, botId: auth.bot.id });
  return NextResponse.json({ messageId: message.id, createdAt: message.created_at }, { status: 201 });
}

async function conversationContext(matchId: string) {
  if (!z.string().uuid().safeParse(matchId).success) return NextResponse.json({ error: "Geçersiz sohbet." }, { status: 400 });
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Canlı veritabanı bağlantısı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: role } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !["owner", "moderator", "support"].includes(role.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  if (role.role !== "owner") {
    const { data: grant } = await session.from("conversation_access_grants").select("id").eq("match_id", matchId).eq("admin_user_id", user.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!grant) return NextResponse.json({ error: "Bu sohbet için aktif vaka erişiminiz yok." }, { status: 403 });
  }
  const { data: match } = await admin.from("matches").select("id,user_a,user_b,status").eq("id", matchId).maybeSingle();
  if (!match) return NextResponse.json({ error: "Sohbet bulunamadı." }, { status: 404 });
  const [{ data: profiles }, { data: control }] = await Promise.all([
    admin.from("profiles").select("id,display_name,kind").in("id", [match.user_a, match.user_b]),
    admin.from("bot_conversation_controls").select("mode,takeover_expires_at,auto_return_to_ai,pause_reason").eq("match_id", match.id).maybeSingle(),
  ]);
  const bot = profiles?.find((profile) => profile.kind === "bot") ?? null;
  if (control?.mode === "admin" && control.auto_return_to_ai && control.takeover_expires_at && new Date(control.takeover_expires_at) <= new Date()) {
    await admin.from("bot_conversation_controls").update({ mode: "ai", takeover_expires_at: null, updated_at: new Date().toISOString() }).eq("match_id", match.id).eq("mode", "admin");
    control.mode = "ai"; control.takeover_expires_at = null;
  }
  return { session, admin, user, role: role.role, match, profiles: profiles ?? [], bot, control };
}

async function audit(auth: Exclude<Awaited<ReturnType<typeof conversationContext>>, NextResponse>, action: string, metadata: Record<string, unknown>) {
  await auth.session.rpc("write_admin_audit", { event_action: action, event_target_type: "conversation", event_target_id: auth.match.id, event_metadata: metadata });
}
