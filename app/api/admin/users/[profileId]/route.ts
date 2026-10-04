import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const entitlementSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant_noir"), days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]) }),
  z.object({ action: z.literal("revoke_noir") }),
  z.object({ action: z.literal("remove_voice") }),
]);

export async function GET(_: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin(["owner", "support", "moderator"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const { data: profile } = await auth.admin.from("profiles").select("id,user_id,display_name,birth_date,gender,city,created_at,xp,level,is_discoverable,onboarding_completed").eq("id", profileId).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  const [privateData, entitlement, presence, matchA, matchB, messages, reports, voice, sentSuperLikes, receivedSuperLikes, hiddenConvs] = await Promise.all([
    auth.admin.from("private_profile_data").select("phone").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("user_entitlements").select("noir_until,source").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("profile_presence").select("last_seen_at").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("matches").select("id", { count: "exact", head: true }).eq("user_a", profileId),
    auth.admin.from("matches").select("id", { count: "exact", head: true }).eq("user_b", profileId),
    auth.admin.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", profileId),
    auth.admin.from("reports").select("id", { count: "exact", head: true }).eq("reported_id", profileId),
    auth.admin.from("profile_voice_prompts").select("prompt,audio_path").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("swipes").select("target_id,super_like_note,created_at").eq("swiper_id", profileId).eq("direction", "super").not("super_like_note", "is", null).order("created_at", { ascending: false }).limit(10),
    auth.admin.from("swipes").select("swiper_id,super_like_note,created_at").eq("target_id", profileId).eq("direction", "super").not("super_like_note", "is", null).order("created_at", { ascending: false }).limit(10),
    auth.admin.from("hidden_conversations").select("match_id", { count: "exact", head: true }).eq("profile_id", profileId),
  ]);
  const { data: signedVoice } = voice.data?.audio_path ? await auth.admin.storage.from("voice-messages").createSignedUrl(voice.data.audio_path, 3600) : { data: null };
  const canSeeContact = auth.role === "owner" || auth.role === "support";
  const authUser = canSeeContact && profile.user_id ? await auth.admin.auth.admin.getUserById(profile.user_id) : null;
  await auth.session.rpc("write_admin_audit", { event_action: "user.detail.viewed", event_target_type: "profile", event_target_id: profileId, event_metadata: { role: auth.role } });
  return NextResponse.json({ user: { ...profile, email: authUser?.data.user?.email ?? null, phone: canSeeContact ? privateData.data?.phone ?? null : null, noirUntil: entitlement.data?.noir_until ?? null, entitlementSource: entitlement.data?.source ?? null, lastSeenAt: presence.data?.last_seen_at ?? null, matchCount: (matchA.count ?? 0) + (matchB.count ?? 0), messageCount: messages.count ?? 0, reportCount: reports.count ?? 0, voicePrompt: voice.data?.prompt ?? null, voiceUrl: signedVoice?.signedUrl ?? null, canManageNoir: auth.role === "owner", superLikes: { sent: sentSuperLikes.data ?? [], received: receivedSuperLikes.data ?? [] }, hiddenConversationCount: hiddenConvs.count ?? 0, user_id: undefined } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const parsed = entitlementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Noir üyelik işlemi geçersiz." }, { status: 400 });
  const { data: profile } = await auth.admin.from("profiles").select("id").eq("id", profileId).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  if (parsed.data.action === "remove_voice") {
    const { data: voice } = await auth.admin.from("profile_voice_prompts").select("audio_path").eq("profile_id", profileId).maybeSingle();
    const { error } = await auth.admin.from("profile_voice_prompts").delete().eq("profile_id", profileId);
    if (error) return NextResponse.json({ error: "Sesli biyografi kaldırılamadı." }, { status: 503 });
    if (voice?.audio_path) await auth.admin.storage.from("voice-messages").remove([voice.audio_path]);
    await auth.session.rpc("write_admin_audit", { event_action: "profile.voice.removed", event_target_type: "profile", event_target_id: profileId, event_metadata: {} });
    return NextResponse.json({ updated: true });
  }

  let noirUntil: string | null = null;
  const now = new Date();
  if (parsed.data.action === "grant_noir") {
    const { data: current } = await auth.admin.from("user_entitlements").select("noir_until").eq("profile_id", profileId).maybeSingle();
    const currentUntil = current?.noir_until ? new Date(current.noir_until) : null;
    const base = currentUntil && currentUntil > now ? currentUntil : now;
    noirUntil = new Date(base.getTime() + parsed.data.days * 86_400_000).toISOString();
    const { error } = await auth.admin.from("user_entitlements").upsert({ profile_id: profileId, noir_until: noirUntil, source: `manual:${auth.user.id}`, updated_at: now.toISOString() }, { onConflict: "profile_id" });
    if (error) return NextResponse.json({ error: "Noir üyeliği güncellenemedi." }, { status: 500 });
  } else {
    const { error } = await auth.admin.from("user_entitlements").upsert({ profile_id: profileId, noir_until: null, source: `manual-revoke:${auth.user.id}`, updated_at: now.toISOString() }, { onConflict: "profile_id" });
    if (error) return NextResponse.json({ error: "Noir üyeliği kaldırılamadı." }, { status: 500 });
  }

  await auth.session.rpc("write_admin_audit", {
    event_action: parsed.data.action === "grant_noir" ? "user.noir.granted" : "user.noir.revoked",
    event_target_type: "profile",
    event_target_id: profileId,
    event_metadata: parsed.data.action === "grant_noir" ? { days: parsed.data.days, noirUntil } : { noirUntil: null },
  });
  return NextResponse.json({ updated: true, noirUntil }, { headers: { "Cache-Control": "private, no-store" } });
}
