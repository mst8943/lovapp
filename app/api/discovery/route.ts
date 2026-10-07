import { after, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadDiscoveryProfiles, selectDailyPick } from "@/lib/discovery";
import { istanbulDate, questionForDate } from "@/lib/daily-question";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push";
import { scheduleProactiveBotJob } from "@/lib/ai/automation";

const swipeSchema = z.object({
  targetProfileId: z.string().uuid(),
  direction: z.enum(["left", "right", "super"]),
  note: z.string().trim().min(1).max(280).optional(),
}).refine((value) => !value.note || value.direction === "super");

export async function GET(request: Request) {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  if (new URL(request.url).searchParams.get("summary") === "1") {
    const [superLike, likeAllowance, quest] = await Promise.all([
      session.rpc("get_super_like_allowance"),
      getLikeAllowance(session, admin, user.id),
      getQuestSummary(admin, user.id),
    ]);
    if (superLike.error || likeAllowance.error) return NextResponse.json({ error: "Beğeni hakkı yüklenemedi." }, { status: 503 });
    return NextResponse.json({ superLike: superLike.data ?? null, likeAllowance: likeAllowance.data ?? null, quest }, { headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const [profiles, viewer, superLike, likeAllowance] = await Promise.all([
      loadDiscoveryProfiles(session, admin),
      admin.from("profiles").select("id,relationship_goal,city").eq("user_id", user.id).eq("kind", "human").maybeSingle(),
      session.rpc("get_super_like_allowance"),
      getLikeAllowance(session, admin, user.id),
    ]);
    if (superLike.error || likeAllowance.error) throw new Error("like allowance unavailable");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const dailyPick = viewer.data?.id ? selectDailyPick(profiles, viewer.data, today) : null;
    const sameAnswerIds = await sameDailyAnswerIds(admin, viewer.data?.id, profiles.map((profile) => profile.id));
    const marked = profiles.map((profile) => (sameAnswerIds.has(profile.id) ? { ...profile, sameDailyAnswer: true } : profile));
    return NextResponse.json({ profiles: marked, dailyPick, superLike: superLike.data ?? null, likeAllowance: likeAllowance.data ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Keşfet kartları yüklenemedi." }, { status: 503 });
  }
}

async function sameDailyAnswerIds(admin: SupabaseClient, viewerId: string | undefined, candidateIds: string[]) {
  if (!viewerId || !candidateIds.length) return new Set<string>();
  try {
    const date = istanbulDate();
    const { data: mine } = await admin.from("daily_question_answers").select("option_index").eq("profile_id", viewerId).eq("question_date", date).maybeSingle();
    if (!mine) return new Set<string>();
    const { data } = await admin.from("daily_question_answers").select("profile_id").eq("question_date", date).eq("question_key", questionForDate(date).key).eq("option_index", mine.option_index).in("profile_id", candidateIds);
    return new Set((data ?? []).map((row) => row.profile_id as string));
  } catch { return new Set<string>(); }
}

async function getQuestSummary(admin: SupabaseClient, userId: string) {
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", userId).eq("kind", "human").maybeSingle();
  if (!profile) return { progress: 0, target: 3, xp: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: quest } = await admin.from("daily_quests")
    .select("id,target_count,xp_reward")
    .eq("slug", "three-profile-decisions")
    .eq("is_active", true)
    .maybeSingle();
  if (!quest) return { progress: 0, target: 3, xp: 0 };
  const { data: progress } = await admin.from("user_quest_progress")
    .select("progress")
    .eq("user_id", profile.id)
    .eq("quest_id", quest.id)
    .eq("quest_date", today)
    .maybeSingle();
  return { progress: progress?.progress ?? 0, target: quest.target_count, xp: quest.xp_reward };
}

async function getLikeAllowance(session: SupabaseClient, admin: SupabaseClient, userId: string) {
  const result = await session.rpc("get_like_allowance");
  const allowance = result.data as { remaining?: number | null; premium?: boolean } | null;
  if (result.error || allowance?.premium || allowance?.remaining !== 0) return result;
  const { data: profile, error: profileError } = await admin.from("profiles").select("id").eq("user_id", userId).eq("kind", "human").maybeSingle();
  if (profileError || !profile) return result;
  const usageDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: usage, error: usageError } = await admin.from("swipe_daily_usage").select("like_count").eq("profile_id", profile.id).eq("usage_date", usageDate).maybeSingle();
  if (usageError || usage) return result;
  return { ...result, data: { ...allowance, remaining: 10 } };
}

export async function POST(request: Request) {
  const parsed = swipeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Kaydırma kararı geçersiz." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const { data, error } = await session.rpc("record_swipe", {
    target_profile: parsed.data.targetProfileId,
    swipe_choice: parsed.data.direction,
  });
  if (error) {
    const known: Record<string, { message: string; status: number }> = {
      onboarding_required: { message: "Keşfete başlamadan önce profilini tamamla.", status: 409 },
      profile_details_required: { message: "Karar vermeden önce profil ayrıntılarını tamamla.", status: 409 },
      target_unavailable: { message: "Bu profil artık keşfette değil.", status: 410 },
      already_swiped: { message: "Bu profil için kararını daha önce verdin.", status: 409 },
      like_limit_reached: { message: "Bugünkü ücretsiz beğeni hakkın doldu.", status: 429 },
      super_like_limit_reached: { message: "Süper Beğeni hakkın henüz yenilenmedi.", status: 429 },
    };
    const key = Object.keys(known).find((item) => error.message.includes(item));
    const result = key ? known[key] : { message: "Kararın kaydedilemedi.", status: 500 };
    return NextResponse.json({ error: result.message, code: key ?? "swipe_failed" }, { status: result.status });
  }
  const result = data as { matched?: boolean; targetKind?: "human" | "bot"; matchId?: string } | null;
  if (parsed.data.note) {
    const { error: noteError } = await session.rpc("set_super_like_note", { target_uuid: parsed.data.targetProfileId, note_text: parsed.data.note });
    if (noteError) return NextResponse.json({ error: "Süper Beğeni gönderildi ancak not eklenemedi." }, { status: 500 });
  }
  if (result?.matched && result.targetKind === "human") {
    const admin = createAdminClient();
    if (admin) after(() => sendPushToProfile(admin, parsed.data.targetProfileId, { title: "Yeni bir eşleşme", body: "Birbirinizi beğendiniz. Sohbetiniz hazır.", url: result.matchId ? `/?open=chat&match=${result.matchId}` : "/?open=messages", tag: `match-${result.matchId ?? parsed.data.targetProfileId}`, matchId: result.matchId ?? undefined }));
  }
  if (result?.matched && result.targetKind === "bot" && result.matchId) {
    const admin = createAdminClient();
    if (admin) after(async () => {
      const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
      if (member) await scheduleProactiveBotJob({ admin, matchId: result.matchId!, botProfileId: parsed.data.targetProfileId, memberProfileId: member.id, jobType: "first_message" });
    });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await session.rpc("rewind_last_swipe");
  if (error) {
    const known: Record<string, { message: string; status: number }> = {
      noir_required: { message: "Geri Al, Noir erişimiyle kullanılabilir.", status: 403 },
      nothing_to_rewind: { message: "Geri alınacak bir karar yok.", status: 409 },
      conversation_started: { message: "Sohbet başladıktan sonra eşleşme geri alınamaz.", status: 409 },
      super_like_not_rewindable: { message: "Süper Beğeni geri alınamaz.", status: 409 },
      matched_decision_not_rewindable: { message: "Eşleşmeyle sonuçlanan karar geri alınamaz.", status: 409 },
    };
    const key = Object.keys(known).find((item) => error.message.includes(item));
    const result = key ? known[key] : { message: "Son karar geri alınamadı.", status: 500 };
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ rewound: data }, { headers: { "Cache-Control": "private, no-store" } });
}
