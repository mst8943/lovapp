import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const auth = await requireAdmin(["owner", "support", "moderator"]);
  if (auth instanceof NextResponse) return auth;
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  let profilesQuery = auth.admin.from("profiles").select("id,user_id,display_name,birth_date,created_at,xp,level,is_discoverable,onboarding_completed").eq("kind", "human").order("created_at", { ascending: false }).limit(100);
  if (query) profilesQuery = profilesQuery.ilike("display_name", `%${query.replace(/[%_]/g, "")}%`);
  const { data: profiles, error } = await profilesQuery;
  if (error) return NextResponse.json({ error: "Kullanıcılar yüklenemedi." }, { status: 500 });
  const ids = (profiles ?? []).map((profile) => profile.id);
  const userIds = (profiles ?? []).flatMap((profile) => profile.user_id ? [profile.user_id] : []);
  const [privateRows, entitlements, presence, photos, authUsers] = await Promise.all([
    ids.length ? auth.admin.from("private_profile_data").select("profile_id,phone").in("profile_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? auth.admin.from("user_entitlements").select("profile_id,noir_until").in("profile_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? auth.admin.from("profile_presence").select("profile_id,last_seen_at").in("profile_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? auth.admin.from("profile_photos").select("profile_id,variants,storage_path").in("profile_id", ids).eq("is_primary", true) : Promise.resolve({ data: [] }),
    auth.admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const canSeeContact = auth.role === "owner" || auth.role === "support";
  const authMap = new Map(authUsers.data.users.filter((item) => userIds.includes(item.id)).map((item) => [item.id, item.email ?? null]));
  const privateMap = new Map((privateRows.data ?? []).map((item) => [item.profile_id, item.phone]));
  const entitlementMap = new Map((entitlements.data ?? []).map((item) => [item.profile_id, item.noir_until]));
  const presenceMap = new Map((presence.data ?? []).map((item) => [item.profile_id, item.last_seen_at]));
  const photoMap = new Map((photos.data ?? []).map((item) => [item.profile_id, item]));
  const rows = await Promise.all((profiles ?? []).map(async (profile) => {
    const photo = photoMap.get(profile.id); const variants = photo?.variants as Record<string,string> | null;
    const path = variants?.["480"] ?? photo?.storage_path; const signed = path ? await auth.admin.storage.from("profiles").createSignedUrl(path, 600) : null;
    return { ...profile, email: canSeeContact && profile.user_id ? authMap.get(profile.user_id) ?? null : null, phone: canSeeContact ? privateMap.get(profile.id) ?? null : null, noirUntil: entitlementMap.get(profile.id) ?? null, lastSeenAt: presenceMap.get(profile.id) ?? null, image: signed?.data?.signedUrl ?? null, birth_date: undefined, user_id: undefined };
  }));
  return NextResponse.json({ users: rows, canSeeContact }, { headers: { "Cache-Control": "private, no-store" } });
}
