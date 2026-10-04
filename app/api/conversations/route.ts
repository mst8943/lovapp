import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStoragePhotosBatch } from "@/lib/discovery";
import { processDueBotMatches } from "@/lib/bot-matches";
import { botPresences } from "@/lib/ai/automation";

const startConversationSchema = z.object({ targetProfileId: z.string().uuid() });
const respondSchema = z.object({ matchId: z.string().uuid(), action: z.enum(["accept", "reject"]) });
type ConversationMessageSummary = {
  match_id: string;
  last_body: string | null;
  last_kind: "text" | "audio" | "image" | null;
  last_sender_id: string | null;
  last_at: string | null;
  unread_count: number;
};

export async function PATCH(request: Request) {
  const parsed = respondSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz mesaj isteği." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await session.rpc("respond_message_request", { match_uuid: parsed.data.matchId, request_action: parsed.data.action });
  if (error) return NextResponse.json({ error: "İstek yanıtlanamadı. Süresi dolmuş veya kapanmış olabilir." }, { status: 409 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = startConversationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });

  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const [{ data: member }, { data: target }] = await Promise.all([
    admin.from("profiles").select("id,onboarding_completed").eq("user_id", user.id).eq("kind", "human").maybeSingle(),
    admin.from("profiles").select("id,kind,is_discoverable,onboarding_completed").eq("id", parsed.data.targetProfileId).maybeSingle(),
  ]);
  if (!member?.onboarding_completed) return NextResponse.json({ error: "Önce profilini tamamla." }, { status: 409 });
  if (!target?.is_discoverable || !target.onboarding_completed || target.id === member.id) {
    return NextResponse.json({ error: "Bu profil şu anda mesaj kabul etmiyor." }, { status: 410 });
  }

  const { data: blocked } = await admin.from("blocks").select("blocker_id").or(
    `and(blocker_id.eq.${member.id},blocked_id.eq.${target.id}),and(blocker_id.eq.${target.id},blocked_id.eq.${member.id})`,
  ).limit(1).maybeSingle();
  if (blocked) return NextResponse.json({ error: "Bu profil ile konuşma başlatılamıyor." }, { status: 403 });

  const { data, error: matchError } = await session.rpc("open_message_request", { target_profile: target.id });
  const match = data as { matchId?: string; connectionType?: string; requestStatus?: string } | null;
  if (matchError || !match?.matchId) {
    if (matchError?.message.includes("request_already_closed")) return NextResponse.json({ error: "Bu sohbet yeniden açılamaz." }, { status: 409 });
    if (matchError?.message.includes("target_unavailable")) return NextResponse.json({ error: "Bu profil şu anda mesaj kabul etmiyor." }, { status: 410 });
    console.error("Direct conversation start failed", { memberId: member.id, targetId: target.id, error: matchError?.message });
    return NextResponse.json({ error: "Sohbet başlatılamadı." }, { status: 503 });
  }

  const { error: revealError } = await admin.from("hidden_conversations").delete().eq("profile_id", member.id).eq("match_id", match.matchId);
  if (revealError) return NextResponse.json({ error: "Sohbet listeye geri eklenemedi. Tekrar dene." }, { status: 503 });

  return NextResponse.json({ ...match, messageLimit: 25, noirMessageLimit: 100 }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function DELETE(request: Request) {
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId || !z.string().uuid().safeParse(matchId).success) return NextResponse.json({ error: "Geçersiz sohbet." }, { status: 400 });
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !admin || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const { data: match } = await admin.from("matches").select("id").eq("id", matchId).or(`user_a.eq.${member.id},user_b.eq.${member.id}`).maybeSingle();
  if (!match) return NextResponse.json({ error: "Sohbet bulunamadı." }, { status: 404 });
  const { error } = await admin.from("hidden_conversations").upsert({ profile_id: member.id, match_id: match.id });
  if (error) return NextResponse.json({ error: "Sohbet kaldırılamadı." }, { status: 503 });
  return NextResponse.json({ deleted: true });
}

export async function GET() {
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!member) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const { error: expiryError } = await admin.rpc("expire_pending_message_requests");
  if (expiryError) return NextResponse.json({ error: "Sohbet istekleri güncellenemedi." }, { status: 503 });
  after(() => processDueBotMatches(admin, { memberProfileId: member.id, limit: 20 }).catch((error) => {
    console.error("Delayed bot match processing failed", error);
  }));
  const { data: connections, error: connectionsError } = await admin.from("matches").select("id,user_a,user_b,matched_at,last_message_at,connection_type,request_status,request_sender_id,request_expires_at").eq("status", "active").or(`user_a.eq.${member.id},user_b.eq.${member.id}`).order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  if (connectionsError) return NextResponse.json({ error: "Sohbetler yüklenemedi." }, { status: 503 });
  const { data: hidden, error: hiddenError } = await admin.from("hidden_conversations").select("match_id").eq("profile_id", member.id);
  if (hiddenError) return NextResponse.json({ error: "Sohbetler yüklenemedi. Tekrar dene." }, { status: 503 });
  const hiddenIds = new Set((hidden ?? []).map((item) => item.match_id));
  const matches = (connections ?? []).filter((match) => !hiddenIds.has(match.id) && (match.connection_type !== "message_request" || (
    ["draft", "pending"].includes(match.request_status)
    && (!match.request_expires_at || new Date(match.request_expires_at) > new Date())
    && (match.request_status !== "draft" || match.request_sender_id === member.id)
  )));
  const matchIds = (matches ?? []).map((match) => match.id);
  const targetIds = (matches ?? []).map((match) => match.user_a === member.id ? match.user_b : match.user_a);
  const [{ data: profiles }, { data: photos }, { data: messageSummaries, error: summaryError }, { data: pendingJobs }, { data: intentions }, { data: answers }, { data: presences }] = await Promise.all([
    targetIds.length ? admin.from("profiles").select("id,display_name,birth_date,city,is_verified,kind").in("id", targetIds) : Promise.resolve({ data: [] }),
    targetIds.length ? admin.from("profile_photos").select("profile_id,storage_path,variants,is_primary,sort_order").in("profile_id", targetIds).eq("processing_status", "ready").neq("moderation_status", "rejected").order("sort_order") : Promise.resolve({ data: [] }),
    matchIds.length ? session.rpc("get_conversation_message_summaries", { requested_match_ids: matchIds }) : Promise.resolve({ data: [], error: null }),
    matchIds.length ? admin.from("bot_reply_jobs").select("match_id,status").in("match_id", matchIds).in("status", ["queued","typing","processing"]) : Promise.resolve({ data: [] }),
    targetIds.length ? admin.from("profile_intentions").select("profile_id,intent_badges(label)").in("profile_id", targetIds) : Promise.resolve({ data: [] }),
    targetIds.length ? admin.from("profile_answers").select("profile_id,answer,icebreaker_prompts(prompt)").in("profile_id", targetIds).order("sort_order") : Promise.resolve({ data: [] }),
    targetIds.length ? admin.from("profile_presence").select("profile_id,last_seen_at").in("profile_id", targetIds) : Promise.resolve({ data: [] }),
  ]);
  if (summaryError) return NextResponse.json({ error: "Sohbet özetleri yüklenemedi." }, { status: 503 });
  const presenceMap = new Map((presences ?? []).map((row) => [row.profile_id, row]));
  const botPresenceMap = await botPresences(admin, (profiles ?? []).filter((profile) => profile.kind === "bot").map((profile) => profile.id));
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const photoMap = new Map<string, NonNullable<typeof photos>>();
  for (const photo of photos ?? []) photoMap.set(photo.profile_id, [...(photoMap.get(photo.profile_id) ?? []), photo]);
  const messageMap = new Map(((messageSummaries ?? []) as ConversationMessageSummary[]).map((summary) => [summary.match_id, summary]));
  const answerMap = new Map((answers ?? []).map((row) => [row.profile_id, row]));
  const badgesMap = new Map<string, string[]>();
  for (const row of intentions ?? []) {
    const badge = row.intent_badges as unknown as { label: string } | null;
    if (badge?.label) {
      const list = badgesMap.get(row.profile_id);
      if (list) list.push(badge.label);
      else badgesMap.set(row.profile_id, [badge.label]);
    }
  }
  const pending = new Set((pendingJobs ?? []).map((job) => job.match_id));
  const photoPaths = (photos ?? []).flatMap((photo) => {
    const variants = photo.variants as Record<string, string> | null;
    const path = variants?.["960"] ?? variants?.["480"] ?? photo.storage_path;
    return path ? [path] : [];
  });
  const resolvedPhotos = await resolveStoragePhotosBatch(photoPaths, admin);
  const conversations = (matches ?? []).flatMap((match) => {
    const targetId = match.user_a === member.id ? match.user_b : match.user_a;
    const profile = profileMap.get(targetId);
    return profile ? [{ match, targetId, profile }] : [];
  }).map(({ match, targetId, profile }) => {
    const latest = messageMap.get(match.id);
    const signedPhotos = (photoMap.get(targetId) ?? []).flatMap((photo) => {
      const variants = photo.variants as Record<string,string> | null;
      const path = variants?.["960"] ?? variants?.["480"] ?? photo.storage_path;
      const url = path ? resolvedPhotos.get(path) : null;
      return url ? [url] : [];
    });
    const birth = new Date(`${profile.birth_date}T00:00:00Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
    const answer = answerMap.get(profile.id);
    const prompt = answer?.icebreaker_prompts as unknown as { prompt: string } | null;
    const presenceRow = presenceMap.get(profile.id);
    const botPresence = botPresenceMap.get(profile.id);
    const isOnline = botPresence ? botPresence.is_online : presenceRow?.last_seen_at ? (Date.now() - new Date(presenceRow.last_seen_at).getTime() < 5 * 60 * 1000) : undefined;
    return {
      matchId: match.id,
      profile: {
        id: profile.id,
        name: profile.display_name,
        age,
        image: signedPhotos[0] ?? "/icon.svg",
        photos: signedPhotos,
        city: profile.city ?? undefined,
        distance: profile.city ?? "Şehir belirtilmemiş",
        verified: profile.is_verified,
        isBot: profile.kind === "bot",
        badges: badgesMap.get(profile.id) ?? [],
        prompt: prompt?.prompt ?? "",
        answer: answer?.answer ?? "",
        isOnline,
        lastSeenAt: botPresence?.last_seen_at ?? presenceRow?.last_seen_at ?? null,
      },
      lastMessage: latest?.last_kind === "audio" ? (latest.last_sender_id === member.id ? "Sesli mesaj gönderdin" : "Sana bir sesli mesaj gönderdi") : latest?.last_kind === "image" ? (latest.last_sender_id === member.id ? "Fotoğraf gönderdin" : "Sana bir fotoğraf gönderdi") : latest?.last_body ?? null,
      lastMessageAt: latest?.last_at ?? match.matched_at,
      unreadCount: Number(latest?.unread_count ?? 0),
      pending: pending.has(match.id),
      matched: match.connection_type === "matched",
      request: match.connection_type === "message_request" ? { status: match.request_status, incoming: match.request_sender_id !== member.id, expiresAt: match.request_expires_at } : null,
    };
  });
  return NextResponse.json({ currentProfileId: member.id, conversations, newMatchIds: [] }, { headers: { "Cache-Control": "private, no-store" } });
}
