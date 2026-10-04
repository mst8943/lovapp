import { redirect } from "next/navigation";
import { LovaskApp, type ViewerProfile } from "@/components/lovask-app";
import { LandingPage } from "@/components/landing-page";
import {
  loadDiscoveryProfiles,
  loadMatchCount,
  resolveStoragePhoto,
} from "@/lib/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[];
    code?: string;
    state?: string;
    scope?: string;
  }>;
}) {
  const params = await searchParams;
  if (typeof params.code === "string" && typeof params.state === "string") {
    const callback = new URLSearchParams({
      code: params.code,
      state: params.state,
    });
    if (typeof params.scope === "string") callback.set("scope", params.scope);
    redirect(`/api/admin/shopier/callback?${callback}`);
  }
  const requestedTab = params.tab;
  const initialTab =
    typeof requestedTab === "string" &&
    ["swipe", "discover", "likes", "messages", "profile", "meetings"].includes(
      requestedTab,
    )
      ? (requestedTab as
          "swipe" | "discover" | "likes" | "messages" | "profile" | "meetings")
      : "swipe";
  const session = await createClient();
  if (!session) return <LovaskApp initialTab={initialTab} />;
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return <LandingPage />;

  const admin = createAdminClient();
  if (!admin) redirect("/onboarding");
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id,onboarding_completed,display_name,birth_date,city,xp,level,is_discoverable",
    )
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  const needsDiscovery =
    initialTab === "swipe" ||
    initialTab === "discover" ||
    initialTab === "likes";
  const [
    candidates,
    matchCount,
    quest,
    ownPhoto,
    intentions,
    answers,
    receivedLikes,
    notificationState,
    adminRole,
    entitlement,
    superLikeAllowance,
  ] = await Promise.all([
    needsDiscovery
      ? loadDiscoveryProfiles(session, admin).catch(() => [])
      : Promise.resolve([]),
    initialTab === "profile"
      ? loadMatchCount(session, admin).catch(() => 0)
      : Promise.resolve(0),
    admin
      .from("user_quest_progress")
      .select("progress,daily_quests!inner(slug)")
      .eq("user_id", profile.id)
      .eq("quest_date", today)
      .in("daily_quests.slug", ["three-profile-decisions", "start-chat"]),
    admin
      .from("profile_photos")
      .select("storage_path,variants")
      .eq("profile_id", profile.id)
      .eq("processing_status", "ready")
      .neq("moderation_status", "rejected")
      .order("is_primary", { ascending: false })
      .order("sort_order")
      .limit(1)
      .maybeSingle(),
    admin
      .from("profile_intentions")
      .select("intent_badges(label)")
      .eq("profile_id", profile.id),
    admin
      .from("profile_answers")
      .select("answer,icebreaker_prompts(prompt)")
      .eq("profile_id", profile.id)
      .order("sort_order")
      .limit(1)
      .maybeSingle(),
    admin
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", profile.id)
      .in("direction", ["right", "super"]),
    admin
      .from("notification_read_state")
      .select("likes_seen_at")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    admin
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("user_entitlements")
      .select("noir_until")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    initialTab === "swipe"
      ? session.rpc("get_super_like_allowance")
      : Promise.resolve({ data: null }),
  ]);
  const variants = ownPhoto.data?.variants as Record<string, string> | null;
  const viewerImage =
    (await resolveStoragePhoto(
      variants?.["960"] ??
        variants?.["480"] ??
        ownPhoto.data?.storage_path ??
        null,
      admin,
    )) ?? "/icon.svg";
  const birthDate = new Date(`${profile.birth_date}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() &&
      now.getUTCDate() < birthDate.getUTCDate())
  )
    age--;
  const answer = answers.data;
  const likesSeenAt =
    notificationState.data?.likes_seen_at ?? "1970-01-01T00:00:00.000Z";
  const [unreadLikes, unreadSuperLikes] = await Promise.all([
    admin
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", profile.id)
      .in("direction", ["right", "super"])
      .gt("created_at", likesSeenAt),
    admin
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("target_id", profile.id)
      .eq("direction", "super")
      .gt("created_at", likesSeenAt),
  ]);
  const isNoir = Boolean(
    entitlement.data?.noir_until &&
    new Date(entitlement.data.noir_until) > new Date(),
  );
  const viewer: ViewerProfile = {
    name: profile.display_name,
    age,
    city: profile.city ?? "",
    image: viewerImage,
    xp: profile.xp,
    level: profile.level,
    matchCount,
    likeCount: receivedLikes.count ?? 0,
    unreadLikeCount: isNoir ? (unreadLikes.count ?? 0) : 0,
    unreadSuperLikeCount: isNoir ? (unreadSuperLikes.count ?? 0) : 0,
    badges: (intentions.data ?? []).flatMap((row) => {
      const badge = row.intent_badges as unknown as { label: string } | null;
      return badge?.label ? [badge.label] : [];
    }),
    prompt:
      (answer?.icebreaker_prompts as unknown as { prompt: string } | null)
        ?.prompt ?? "",
    answer: answer?.answer ?? "",
    isAdmin: Boolean(adminRole.data),
    isNoir,
    discoverable: profile.is_discoverable,
  };
  const questRows = quest.data ?? [];
  const swipeQuest = questRows.find(
    (row) =>
      (row.daily_quests as unknown as { slug: string }).slug ===
      "three-profile-decisions",
  );
  const chatQuest = questRows.find(
    (row) =>
      (row.daily_quests as unknown as { slug: string }).slug === "start-chat",
  );
  return (
    <LovaskApp
      initialTab={initialTab}
      initialProfiles={candidates}
      initialProfilesReady={needsDiscovery}
      initialQuestProgress={swipeQuest?.progress ?? 0}
      initialChatQuestComplete={(chatQuest?.progress ?? 0) >= 1}
      initialSuperLike={superLikeAllowance.data ?? undefined}
      viewer={viewer}
      liveMode
    />
  );
}
