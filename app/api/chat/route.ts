import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  advanceTypingState,
  botPresence,
  processDueBotJobs,
  resolveAutomationSettings,
  scheduleBotReply,
} from "@/lib/ai/automation";
import { profiles } from "@/lib/demo-data";
import { sendPushToProfile } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const sendSchema = z.object({
  profileId: z.string().min(1).max(80),
  message: z.string().trim().min(1).max(1200),
  clientId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
});
const uuid = z.string().uuid();

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const profileId = searchParams.get("profileId");
  const before = searchParams.get("before");
  const beforeId = searchParams.get("beforeId");
  if (!profileId || !uuid.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  if ((before && (!beforeId || Number.isNaN(Date.parse(before)))) || (beforeId && (!before || !uuid.safeParse(beforeId).success))) return NextResponse.json({ error: "Geçersiz mesaj sayfası." }, { status: 400 });
  const session = await createSessionClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });

  const context = await findMatchContext(admin, user.id, profileId);
  if (!context) return NextResponse.json({ error: "Aktif eşleşme gerekli." }, { status: 403 });
  if (!before && context.targetKind === "bot") await processDueBotJobs(admin, { matchId: context.matchId, limit: 1 });
  if (searchParams.get("status") === "1") {
    const botState = context.targetKind === "bot" ? await advanceTypingState(admin, context.matchId) : null;
    return NextResponse.json({ botState }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const { data, error } = await session.rpc("get_match_message_page_v2", { match_uuid: context.matchId, page_limit: 51, before_created_at: before, before_message_id: beforeId });
  if (error) return NextResponse.json({ error: "Mesaj geçmişi yüklenemedi." }, { status: 503 });
  const rows = data ?? [];
  const hasMore = rows.length > 50;
  const page = hasMore ? rows.slice(1) : rows;
  const audioPaths = page.flatMap((message: { kind: string; audio_path?: string | null }) => message.kind === "audio" && message.audio_path ? [message.audio_path] : []);
  const imagePaths = page.flatMap((message: { kind: string; audio_path?: string | null }) => message.kind === "image" && message.audio_path ? [message.audio_path] : []);
  const { data: signedAudio } = audioPaths.length ? await admin.storage.from("voice-messages").createSignedUrls(audioPaths, 60 * 60) : { data: [] };
  const { data: signedImages } = imagePaths.length ? await admin.storage.from("chat-images").createSignedUrls(imagePaths, 60 * 60) : { data: [] };
  const audioUrls = new Map((signedAudio ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  const imageUrls = new Map((signedImages ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  const messages = page.map((message: { id: string; sender_id: string; kind: "text" | "audio" | "image"; body: string | null; audio_path: string | null; audio_duration_ms: number | null; audio_waveform: number[] | null; read_at: string | null; created_at: string; reply_to_id: string | null; reply_body: string | null; reply_kind: string | null; deleted_at: string | null; reactions: Array<{emoji: string; profileId: string}> }) => ({
      id: message.id,
      from: message.sender_id === context.memberId ? "me" : "them",
      text: message.body,
      audio: message.kind === "audio",
      audioUrl: message.kind === "audio" && message.audio_path ? audioUrls.get(message.audio_path) : undefined,
      imageUrl: message.kind === "image" && message.audio_path ? imageUrls.get(message.audio_path) : undefined,
      durationMs: message.audio_duration_ms,
      waveform: message.audio_waveform,
      readAt: message.read_at,
      createdAt: message.created_at,
      replyToId: message.reply_to_id,
      replyText: message.reply_to_id ? message.reply_kind === "audio" ? "Sesli mesaj" : message.reply_kind === "image" ? "Fotoğraf" : message.reply_body ?? "Mesaj silindi" : null,
      deleted: Boolean(message.deleted_at),
      reactions: message.reactions,
    }));
  const nextCursor = messages[0]?.createdAt ? { createdAt: messages[0].createdAt, id: messages[0].id } : null;
  if (before) return NextResponse.json({ messages, hasMore, nextCursor }, { headers: { "Cache-Control": "private, no-store" } });
  const { error: markReadError } = await session.rpc("mark_match_messages_read", { match_uuid: context.matchId });
  const [{ data: presence }, botState, botSettings, { data: hasNoir }] = await Promise.all([
    session.rpc("get_match_presence", { match_uuid: context.matchId }),
    context.targetKind === "bot" ? advanceTypingState(admin, context.matchId) : Promise.resolve(null),
    context.targetKind === "bot" ? resolveAutomationSettings(admin, context.targetId) : Promise.resolve(null),
    session.rpc("has_active_noir"),
  ]);
  const resolvedPresence = context.targetKind === "bot" && botSettings
    ? botPresence(botSettings)
    : hasNoir ? presence?.[0] ?? null : null;
  return NextResponse.json({
    matchId: context.matchId,
    currentProfileId: context.memberId,
    messages,
    hasMore,
    nextCursor,
    markedRead: !markReadError,
    presence: resolvedPresence,
    botState,
    matched: context.matched,
    request: context.request,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz mesaj." }, { status: 400 });
  const admin = createAdminClient();
  const session = await createSessionClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  const liveMode = Boolean(admin && session && user);

  if (!liveMode) {
    const demoProfile = profiles.find((item) => item.id === parsed.data.profileId && item.isBot);
    if (!demoProfile) return NextResponse.json({ error: "Bot profili bulunamadı." }, { status: 404 });
    return NextResponse.json({ reply: demoReply(demoProfile.name, parsed.data.message) });
  }

  if (!uuid.safeParse(parsed.data.profileId).success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const context = await findMatchContext(admin!, user.id, parsed.data.profileId);
  if (!context) return NextResponse.json({ error: "Aktif eşleşme gerekli." }, { status: 403 });
  if (parsed.data.replyToId) {
    const { data: reply } = await admin!.from("messages").select("id").eq("id", parsed.data.replyToId).eq("match_id", context.matchId).is("deleted_at", null).maybeSingle();
    if (!reply) return NextResponse.json({ error: "Yanıtlanan mesaj bulunamadı." }, { status: 400 });
  }

  const clientId = parsed.data.clientId ?? crypto.randomUUID();
  const { data: sent, error: sendError } = context.targetKind === "bot"
    ? await admin!.rpc("send_bot_text_message_service", { member_uuid: context.memberId, match_uuid: context.matchId, message_body: parsed.data.message, client_uuid: clientId })
    : await session!.rpc("send_text_message", { match_uuid: context.matchId, message_body: parsed.data.message, client_uuid: clientId });
  if (sendError) {
    const requestError = sendError.message.includes("message_request");
    return NextResponse.json({ error: requestError ? "Mesaj isteği kabul edilmeden yeni mesaj gönderilemez. Sohbeti yenile." : "Mesaj kaydedilemedi." }, { status: requestError ? 409 : 503 });
  }
  const sendState = sent as { allowed?: boolean; reason?: string; messageId?: string; createdAt?: string; remaining?: number; limit?: number; duplicate?: boolean; xpAwarded?: number } | null;
  if (sendState?.allowed === false) return NextResponse.json({ error: sendState.reason === "request_limit" ? "Bugünkü yeni mesaj isteği hakkın doldu. Mevcut sohbetlerin devam edebilir." : "Bugünkü mesaj hakkın doldu.", quotaReached: sendState.reason !== "request_limit", remaining: sendState.remaining, limit: sendState.limit }, { status: 429 });
  if (sendState?.duplicate) return NextResponse.json({ duplicate: true, userMessageId: sendState.messageId });
  if (parsed.data.replyToId && sendState?.messageId) {
    const { error: replyError } = await admin!.from("messages").update({ reply_to_id: parsed.data.replyToId }).eq("id", sendState.messageId).eq("match_id", context.matchId).eq("sender_id", context.memberId);
    if (replyError) console.error("Chat reply link failed", replyError);
  }

  const base = { userMessageId: sendState?.messageId, createdAt: sendState?.createdAt, remainingMessages: sendState?.remaining, messageLimit: sendState?.limit, xpAwarded: sendState?.xpAwarded ?? 0 };
  if (context.targetKind !== "bot") {
    after(() => sendPushToProfile(admin!, context.targetId, { title: "Lovask", body: "Yeni bir mesajın var.", url: `/?open=chat&match=${context.matchId}`, tag: `match-${context.matchId}`, matchId: context.matchId }));
    return NextResponse.json(base, { status: 201 });
  }

  if (!sendState?.duplicate) {
    await Promise.all([
      admin!.from("bot_experiment_assignments").update({ replied_at: new Date().toISOString() }).eq("match_id", context.matchId).is("replied_at", null).gte("sent_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString()),
    ]);
  }

  const [{ data: persona }, { data: control }] = await Promise.all([
    admin!.from("bot_personas").select("persona,provider,model").eq("profile_id", context.targetId).eq("is_active", true).maybeSingle(),
    admin!.from("bot_conversation_controls").select("mode,takeover_expires_at,auto_return_to_ai").eq("match_id", context.matchId).maybeSingle(),
  ]);
  if (!persona) return NextResponse.json({ ...base, replyPending: true }, { status: 202 });
  let controlMode = control?.mode ?? "ai";
  if (controlMode === "admin" && control?.auto_return_to_ai && control.takeover_expires_at && new Date(control.takeover_expires_at) <= new Date()) {
    await admin!.from("bot_conversation_controls").update({ mode: "ai", takeover_expires_at: null, updated_at: new Date().toISOString() }).eq("match_id", context.matchId).eq("mode", "admin");
    controlMode = "ai";
  }
  if (controlMode !== "ai") return NextResponse.json({ ...base, awaitingAdmin: true }, { status: 202 });

  try {
    const job = await scheduleBotReply({
      admin: admin!, matchId: context.matchId, botProfileId: context.targetId,
      memberProfileId: context.memberId, sourceMessageId: sendState?.messageId,
    });
    return NextResponse.json({ ...base, replyPending: Boolean(job), botState: job ? { pending: true, typing: false } : null }, { status: 202 });
  } catch (error) {
    console.error("Lovask bot reply scheduling failed", error);
    return NextResponse.json({ ...base, replyPending: true }, { status: 202 });
  }
}

async function findMatchContext(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, targetId: string) {
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", userId).eq("kind", "human").maybeSingle();
  if (!member) return null;
  const [{ data: target }, { data: match }] = await Promise.all([
    admin.from("profiles").select("id,kind,display_name").eq("id", targetId).maybeSingle(),
    admin.from("matches").select("id,user_a,user_b,connection_type,request_status,request_sender_id,request_expires_at").eq("status", "active").or(`and(user_a.eq.${member.id},user_b.eq.${targetId}),and(user_a.eq.${targetId},user_b.eq.${member.id})`).limit(1).maybeSingle(),
  ]);
  if (!target || !match) return null;
  const request = match.connection_type === "message_request" ? { status: match.request_status, incoming: match.request_sender_id !== member.id, expiresAt: match.request_expires_at } : null;
  if (request && (!["draft", "pending"].includes(request.status) || (request.expiresAt && new Date(request.expiresAt) <= new Date()) || (request.status === "draft" && request.incoming))) return null;
  return { matchId: match.id, memberId: member.id, targetId: target.id, targetName: target.display_name, targetKind: target.kind as "human" | "bot", matched: match.connection_type === "matched", request };
}

function demoReply(name: string, message: string) {
  const topic = message.length > 45 ? "Bu hikâyenin devamını gerçekten merak ettim." : "Bu cevap bende yeni bir soru uyandırdı.";
  return name === "Defne" ? `${topic} İlk kahve rotamız nereden başlardı? ✨` : `${topic} Bunu bir şarkıyla anlatsan hangisini seçerdin?`;
}
