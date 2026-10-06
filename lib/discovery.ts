import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/demo-data";
import { botPresences } from "@/lib/ai/automation";

type DiscoveryRow = {
  match_id?: string;
  matched_at?: string;
  id: string;
  kind: "human" | "bot";
  display_name: string;
  age: number;
  city: string | null;
  gender?: string | null;
  is_verified: boolean;
  photo_path: string | null;
  badges: string[] | null;
  prompt: string | null;
  answer: string | null;
  distance_km?: number | null;
};

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_CACHE_LIMIT = 2_000;

function readSignedUrlCache(path: string, now = Date.now()) {
  const cached = signedUrlCache.get(path);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    signedUrlCache.delete(path);
    return null;
  }
  signedUrlCache.delete(path);
  signedUrlCache.set(path, cached);
  return cached.url;
}

function writeSignedUrlCache(path: string, url: string, expiresAt: number) {
  signedUrlCache.delete(path);
  while (signedUrlCache.size >= SIGNED_URL_CACHE_LIMIT) {
    const oldest = signedUrlCache.keys().next().value as string | undefined;
    if (!oldest) break;
    signedUrlCache.delete(oldest);
  }
  signedUrlCache.set(path, { url, expiresAt });
}

export async function loadDiscoveryProfiles(session: SupabaseClient, admin: SupabaseClient, limit = 40) {
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) throw new Error("authentication_required");
  const [{ data: viewer, error: viewerError }, { data, error }] = await Promise.all([
    admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").single(),
    session.rpc("get_discovery_candidates", { candidate_limit: limit }),
  ]);
  if (viewerError || !viewer) throw new Error("profile_required");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DiscoveryRow[];
  if (!rows.length) return [];
  return hydrateProfiles(rows, admin, viewer.id);
}

export function selectDailyPick(profiles: Profile[], viewer: { id: string; relationship_goal: string | null; city: string | null }, day: string) {
  const hash = (value: string) => value.split("").reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7);
  const scored = profiles.map((profile) => ({
    profile,
    sameGoal: Boolean(viewer.relationship_goal && profile.relationshipGoal === viewer.relationship_goal),
    sameCity: Boolean(viewer.city && profile.city?.toLocaleLowerCase("tr-TR") === viewer.city.toLocaleLowerCase("tr-TR")),
  })).filter((candidate) => candidate.sameGoal || candidate.sameCity);
  scored.sort((a, b) => Number(b.sameGoal) * 2 + Number(b.sameCity) - Number(a.sameGoal) * 2 - Number(a.sameCity)
    || hash(`${viewer.id}:${day}:${b.profile.id}`) - hash(`${viewer.id}:${day}:${a.profile.id}`));
  const selected = scored[0];
  if (!selected) return null;
  const goals: Record<string, string> = {
    marriage: "evlilik",
    serious: "ciddi ilişki",
    dating: "flört",
    short_term: "kısa süreli ilişki",
    friendship: "arkadaşlık",
  };
  const reason = selected.sameGoal
    ? selected.profile.relationshipGoal === "unsure"
      ? "İkiniz de ilişki hedefiniz konusunda henüz karar vermemişsiniz."
      : `İkiniz de ${goals[selected.profile.relationshipGoal ?? ""] ?? "benzer bir ilişki"} arıyorsunuz.`
    : `İkiniz de ${selected.profile.city} şehrindesiniz.`;
  return { profileId: selected.profile.id, reason, day, viewerId: viewer.id };
}

export async function loadMatchProfiles(session: SupabaseClient, admin: SupabaseClient) {
  const { rows, viewerId } = await loadMatchRows(session, admin);
  return hydrateProfiles(rows, admin, viewerId);
}

export async function loadMeetingProfiles(session: SupabaseClient, admin: SupabaseClient, viewerId: string) {
  const { data, error } = await session.rpc("get_meeting_candidates");
  if (error) throw new Error(error.message);
  return hydrateProfiles((data ?? []) as DiscoveryRow[], admin, viewerId);
}

export async function loadMatchCount(session: SupabaseClient, admin: SupabaseClient) {
  const { rows } = await loadMatchRows(session, admin);
  return rows.length;
}

async function loadMatchRows(session: SupabaseClient, admin: SupabaseClient) {
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) throw new Error("authentication_required");
  const [{ data, error }, { data: viewer, error: viewerError }] = await Promise.all([
    session.rpc("get_active_match_profiles"),
    admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").single(),
  ]);
  if (error || viewerError) throw new Error((error ?? viewerError)?.message);
  const rows = (data ?? []) as DiscoveryRow[];
  if (!viewer?.id || !rows.length) return { rows, viewerId: viewer?.id };
  const matchIds = rows.flatMap((row) => row.match_id ? [row.match_id] : []);
  const { data: connections, error: connectionError } = matchIds.length
    ? await admin.from("matches").select("id").in("id", matchIds).eq("status", "active").eq("connection_type", "matched")
    : { data: [], error: null };
  if (connectionError) throw new Error(connectionError.message);
  const actualMatchIds = new Set((connections ?? []).map((match) => match.id));
  const actualMatches = rows.filter((row) => row.match_id && actualMatchIds.has(row.match_id));
  return { rows: actualMatches, viewerId: viewer.id };
}

async function hydrateProfiles(rows: DiscoveryRow[], admin: SupabaseClient, viewerId?: string): Promise<Profile[]> {
  const ids = rows.map((row) => row.id);
  const [{ data: photoRows }, { data: incomingLikes }, { data: details }, { data: entitlement }, { data: voiceRows }, { data: presences }] = await Promise.all([
    ids.length ? admin.from("profile_photos").select("profile_id,storage_path,variants,sort_order,is_primary").in("profile_id", ids).eq("processing_status", "ready").neq("moderation_status", "rejected").order("sort_order") : Promise.resolve({ data: [] }),
    viewerId && ids.length ? admin.from("swipes").select("swiper_id,direction").eq("target_id", viewerId).in("swiper_id", ids).in("direction", ["right", "super"])
      .gt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()) : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id,relationship_goal,marital_status,has_children,children_preference,alcohol_use,smoking_use,pet_preference,sports_habit,birth_date,height_cm,education_level,languages").in("id", ids),
    viewerId ? admin.from("user_entitlements").select("noir_until").eq("profile_id", viewerId).gt("noir_until", new Date().toISOString()).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("profile_voice_prompts").select("profile_id,prompt,audio_path,duration_ms").in("profile_id", ids),
    ids.length ? admin.from("profile_presence").select("profile_id,last_seen_at").in("profile_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const presenceMap = new Map((presences ?? []).map((row) => [row.profile_id, row]));
  const botPresenceMap = await botPresences(admin, rows.filter((row) => row.kind === "bot").map((row) => row.id));
  const { data: signedVoice } = voiceRows?.length ? await admin.storage.from("voice-messages").createSignedUrls(voiceRows.map((item) => item.audio_path), 3600) : { data: [] };
  const voiceUrls = new Map((signedVoice ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  const voices = new Map((voiceRows ?? []).map((item) => [item.profile_id, item]));

  const pathsByProfile = new Map<string, string[]>();
  const allPathsToResolve: string[] = [];

  for (const photo of photoRows ?? []) {
    const variants = photo.variants as Record<string, string> | null;
    const path = variants?.["960"] ?? variants?.["480"] ?? photo.storage_path;
    if (path) {
      pathsByProfile.set(photo.profile_id, [...(pathsByProfile.get(photo.profile_id) ?? []), path]);
      allPathsToResolve.push(path);
    }
  }

  for (const row of rows) {
    if (row.photo_path) {
      allPathsToResolve.push(row.photo_path);
    }
  }

  const resolvedMap = await resolveStoragePhotosBatch(allPathsToResolve, admin);
  const likeMap = new Map((incomingLikes ?? []).map((like) => [like.swiper_id, like.direction]));
  const detailMap = new Map((details ?? []).map((detail) => [detail.id, detail]));

  const profiles: Profile[] = [];
  for (const row of rows) {
    const paths = pathsByProfile.get(row.id) ?? (row.photo_path ? [row.photo_path] : []);
    const photos = paths.map((path) => resolvedMap.get(path)).filter((photo): photo is string => Boolean(photo));
    const image = photos[0] ?? (row.photo_path ? resolvedMap.get(row.photo_path) : null);
    if (!image) continue;

    const incoming = likeMap.get(row.id);
    const detail = detailMap.get(row.id);
    const voice = voices.get(row.id);
    profiles.push({
      id: row.id,
      name: row.display_name,
      age: row.age,
      gender: row.gender ?? undefined,
      image,
      photos: photos.length ? photos : [image],
      city: row.city ?? undefined,
      // Distances are city-centre based, so same-city members would read as "≈ 0 km".
      distance: row.distance_km === null || row.distance_km === undefined ? "Mesafe bilgisi yok" : row.distance_km < 5 ? "Yakınında" : `≈ ${row.distance_km} km`,
      verified: row.is_verified,
      isBot: row.kind === "bot",
      badges: row.badges ?? [],
      prompt: row.prompt ?? "Beni etkilemenin en kısa yolu…",
      answer: row.answer ?? "İyi bir soru ve gerçekten dinlemek.",
      voicePrompt: voice?.prompt,
      voiceUrl: voice?.audio_path ? voiceUrls.get(voice.audio_path) : undefined,
      voiceDurationMs: voice?.duration_ms,
      likedYou: Boolean(incoming),
      superLikedYou: incoming === "super",
      isOnline: row.kind === "bot" ? botPresenceMap.get(row.id)?.is_online : presenceMap.get(row.id)?.last_seen_at
        ? Date.now() - new Date(presenceMap.get(row.id)!.last_seen_at).getTime() < 5 * 60 * 1000
        : undefined,
      lastSeenAt: row.kind === "bot" ? botPresenceMap.get(row.id)?.last_seen_at ?? null : presenceMap.get(row.id)?.last_seen_at ?? null,
      relationshipGoal: detail?.relationship_goal ?? undefined,
      maritalStatus: detail?.marital_status ?? undefined,
      hasChildren: detail?.has_children ?? undefined,
      childrenPreference: detail?.children_preference ?? undefined,
      alcoholUse: detail?.alcohol_use ?? undefined,
      smokingUse: detail?.smoking_use ?? undefined,
      petPreference: detail?.pet_preference ?? undefined,
      sportsHabit: detail?.sports_habit ?? undefined,
      zodiac: zodiacForBirthDate(detail?.birth_date),
      heightCm: detail?.height_cm ?? undefined,
      educationLevel: detail?.education_level ?? undefined,
      languages: detail?.languages ?? [],
    });
  }

  return profiles;
}

function zodiacForBirthDate(value?: string | null) {
  if (!value) return undefined;
  const [, month, day] = value.split("-").map(Number);
  const cutoffs = [20,19,21,20,21,21,23,23,23,23,22,22];
  const signs = ["capricorn","aquarius","pisces","aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn"];
  return signs[month - 1 + (day >= cutoffs[month - 1] ? 1 : 0)];
}

export async function resolveStoragePhotosBatch(
  paths: (string | null | undefined)[],
  admin: SupabaseClient
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const needed: string[] = [];
  const now = Date.now();

  for (const rawPath of paths) {
    if (!rawPath) continue;
    if (rawPath.startsWith("/") || rawPath.startsWith("https://")) {
      result.set(rawPath, rawPath);
      continue;
    }
    const cachedUrl = readSignedUrlCache(rawPath, now);
    if (cachedUrl) {
      result.set(rawPath, cachedUrl);
    } else {
      needed.push(rawPath);
    }
  }

  if (needed.length > 0) {
    const uniqueNeeded = Array.from(new Set(needed));
    try {
      const { data } = await admin.storage.from("profiles").createSignedUrls(uniqueNeeded, 900);
      if (data) {
        for (const item of data) {
          if (item.signedUrl && item.path) {
            const exp = now + 800_000;
            writeSignedUrlCache(item.path, item.signedUrl, exp);
            result.set(item.path, item.signedUrl);
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  return result;
}

export async function resolveStoragePhoto(path: string | null, admin: SupabaseClient) {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("https://")) return path;
  const cachedUrl = readSignedUrlCache(path);
  if (cachedUrl) return cachedUrl;
  const { data } = await admin.storage.from("profiles").createSignedUrl(path, 900);
  if (data?.signedUrl) {
    writeSignedUrlCache(path, data.signedUrl, Date.now() + 800_000);
  }
  return data?.signedUrl ?? null;
}
