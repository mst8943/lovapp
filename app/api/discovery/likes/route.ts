import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveStoragePhotosBatch } from "@/lib/discovery";
import { botPresences } from "@/lib/ai/automation";

export async function GET() {
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!member) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const activeSince = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: entitlement }, { data: swipes, count }] = await Promise.all([
    admin.from("user_entitlements").select("noir_until").eq("profile_id", member.id).maybeSingle(),
    admin.from("swipes").select("swiper_id,direction,super_like_note,created_at", { count: "exact" }).eq("target_id", member.id).in("direction", ["right", "super"])
      .gt("created_at", activeSince).order("created_at", { ascending: false }).limit(100),
  ]);
  const premium = Boolean(entitlement?.noir_until && new Date(entitlement.noir_until) > new Date());
  if (!premium) return NextResponse.json({ premium: false, count: 0, profiles: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const ids = (swipes ?? []).map((item) => item.swiper_id);
  const [{ data: profiles }, { data: photos }, { data: intentions }, { data: answers }, { data: presences }] = await Promise.all([
    ids.length ? admin.from("profiles").select("id,display_name,birth_date,city,is_verified,kind").in("id", ids).eq("is_discoverable", true) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("profile_photos").select("profile_id,storage_path,variants,sort_order,is_primary").in("profile_id", ids).eq("processing_status", "ready").neq("moderation_status", "rejected").order("sort_order") : Promise.resolve({ data: [] }),
    ids.length ? admin.from("profile_intentions").select("profile_id,intent_badges(label)").in("profile_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("profile_answers").select("profile_id,answer,icebreaker_prompts(prompt)").in("profile_id", ids).order("sort_order") : Promise.resolve({ data: [] }),
    ids.length ? admin.from("profile_presence").select("profile_id,last_seen_at").in("profile_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const presenceMap = new Map((presences ?? []).map((row) => [row.profile_id, row.last_seen_at]));
  const botPresenceMap = await botPresences(admin, (profiles ?? []).filter((profile) => profile.kind === "bot").map((profile) => profile.id));
  const swipeMap = new Map((swipes ?? []).map((item) => [item.swiper_id, item]));
  const photoPaths = (photos ?? []).map((photo) => {
    const variants = photo.variants as Record<string, string> | null;
    return variants?.["960"] ?? variants?.["480"] ?? photo.storage_path;
  });
  const resolvedPhotos = await resolveStoragePhotosBatch(photoPaths, admin);
  const result = (profiles ?? []).map((profile) => {
    const signed = (photos ?? []).filter((photo) => photo.profile_id === profile.id).flatMap((photo) => {
      const variants = photo.variants as Record<string, string> | null;
      const url = resolvedPhotos.get(variants?.["960"] ?? variants?.["480"] ?? photo.storage_path);
      return url ? [url] : [];
    });
    const birth = new Date(`${profile.birth_date}T00:00:00Z`);
    const age = new Date().getUTCFullYear() - birth.getUTCFullYear();
    const badges = (intentions ?? []).filter((row) => row.profile_id === profile.id).flatMap((row) => {
      const badge = row.intent_badges as unknown as { label: string } | null;
      return badge?.label ? [badge.label] : [];
    });
    const answer = (answers ?? []).find((row) => row.profile_id === profile.id);
    const prompt = answer?.icebreaker_prompts as unknown as { prompt: string } | null;
    const swipe = swipeMap.get(profile.id);
    const lastSeenAt = profile.kind === "bot" ? botPresenceMap.get(profile.id)?.last_seen_at ?? null : presenceMap.get(profile.id) ?? null;
    const isOnline = profile.kind === "bot" ? botPresenceMap.get(profile.id)?.is_online : lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000 : undefined;
    return { id: profile.id, name: profile.display_name, age, city: profile.city ?? undefined, distance: profile.city ?? "Şehir belirtilmemiş", image: signed[0] ?? "/icon.svg", photos: signed, verified: profile.is_verified, isBot: profile.kind === "bot", badges, prompt: prompt?.prompt ?? "", answer: answer?.answer ?? "", likedYou: true, superLikedYou: swipe?.direction === "super", superLikeNote: swipe?.super_like_note ?? undefined, isOnline, lastSeenAt };
  });
  return NextResponse.json({ premium: true, count: count ?? 0, profiles: result }, { headers: { "Cache-Control": "private, no-store" } });
}
