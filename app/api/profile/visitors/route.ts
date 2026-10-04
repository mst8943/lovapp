import { NextResponse } from "next/server";
import { resolveStoragePhoto } from "@/lib/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "Yapılandırma eksik." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const body = await request.json().catch(() => null) as { profileId?: unknown } | null;
  if (typeof body?.profileId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.profileId)) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const { error } = await session.rpc("record_profile_visit", { target_profile: body.profileId });
  if (error) return NextResponse.json({ error: "Ziyaret kaydedilemedi." }, { status: 500 });
  return NextResponse.json({ recorded: true });
}

export async function GET() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Yapılandırma eksik." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

  const [{ count }, entitlement] = await Promise.all([
    admin.from("profile_visits").select("visitor_id", { count: "exact", head: true }).eq("visited_id", profile.id),
    admin.from("user_entitlements").select("noir_until").eq("profile_id", profile.id).maybeSingle(),
  ]);
  const premium = Boolean(entitlement.data?.noir_until && new Date(entitlement.data.noir_until) > new Date());
  if (!premium) return NextResponse.json({ premium: false, count: count ?? 0, visitors: [] }, { headers: { "Cache-Control": "private, no-store" } });

  const { data: visits } = await admin.from("profile_visits").select("visitor_id,last_visited_at").eq("visited_id", profile.id).order("last_visited_at", { ascending: false }).limit(30);
  const ids = (visits ?? []).map((visit) => visit.visitor_id);
  if (!ids.length) return NextResponse.json({ premium: true, count: 0, visitors: [] });
  const [{ data: profiles }, { data: photos }] = await Promise.all([
    admin.from("profiles").select("id,display_name,birth_date,city,is_verified").in("id", ids),
    admin.from("profile_photos").select("profile_id,storage_path,variants,is_primary,sort_order").in("profile_id", ids).eq("processing_status", "ready").neq("moderation_status", "rejected").order("is_primary", { ascending: false }).order("sort_order"),
  ]);
  const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
  const photoMap = new Map<string, NonNullable<typeof photos>[number]>();
  for (const photo of photos ?? []) if (!photoMap.has(photo.profile_id)) photoMap.set(photo.profile_id, photo);
  const visitors = (await Promise.all((visits ?? []).map(async (visit) => {
    const person = profileMap.get(visit.visitor_id);
    if (!person) return null;
    const photo = photoMap.get(visit.visitor_id);
    const variants = photo?.variants as Record<string, string> | null;
    const image = await resolveStoragePhoto(variants?.["480"] ?? variants?.["960"] ?? photo?.storage_path ?? null, admin);
    const birth = new Date(`${person.birth_date}T00:00:00Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
    return { id: person.id, name: person.display_name, age, city: person.city ?? "Türkiye", verified: person.is_verified, image: image ?? "/icon.svg", visitedAt: visit.last_visited_at };
  }))).filter((visitor): visitor is NonNullable<typeof visitor> => visitor !== null);
  return NextResponse.json({ premium: true, count: count ?? visitors.length, visitors });
}
