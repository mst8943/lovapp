import { NextResponse } from "next/server";
import { z } from "zod";
import { ENDORSEMENT_BADGES, ENDORSEMENT_KEYS, MIN_ENDORSEMENTS_TO_SHOW } from "@/lib/endorsements";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const postSchema = z.object({ toProfileId: z.string().uuid(), badge: z.enum(ENDORSEMENT_KEYS) });

async function context() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle();
  return profile ? { admin, profileId: profile.id as string } : null;
}

// Only counts are returned, never who left a badge, and a badge needs at least two endorsements to show.
export async function GET(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  const target = new URL(request.url).searchParams.get("profileId") ?? ctx.profileId;
  if (!z.string().uuid().safeParse(target).success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const { data, error } = await ctx.admin.from("member_endorsements").select("badge").eq("to_profile_id", target).limit(2000);
  if (error) return NextResponse.json({ badges: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.badge as string, (counts.get(row.badge as string) ?? 0) + 1);
  const badges = ENDORSEMENT_BADGES.filter((badge) => (counts.get(badge.key) ?? 0) >= MIN_ENDORSEMENTS_TO_SHOW).map((badge) => ({ key: badge.key, label: badge.label, count: counts.get(badge.key) ?? 0 }));
  const { data: given } = target === ctx.profileId ? { data: [] } : await ctx.admin.from("member_endorsements").select("badge").eq("from_profile_id", ctx.profileId).eq("to_profile_id", target);
  return NextResponse.json({ badges, given: (given ?? []).map((row) => row.badge) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçerli bir rozet seç." }, { status: 400 });
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  const { toProfileId, badge } = parsed.data;
  if (toProfileId === ctx.profileId) return NextResponse.json({ error: "Kendine rozet bırakamazsın." }, { status: 400 });
  const [a, b] = [ctx.profileId, toProfileId].sort();
  const { data: match } = await ctx.admin.from("matches").select("id").eq("user_a", a).eq("user_b", b).eq("status", "active").maybeSingle();
  if (!match) return NextResponse.json({ error: "Rozet yalnızca eşleştiğin kişilere bırakılabilir." }, { status: 403 });
  const { count } = await ctx.admin.from("messages").select("id", { count: "exact", head: true }).eq("match_id", match.id).eq("sender_id", ctx.profileId);
  if ((count ?? 0) < 3) return NextResponse.json({ error: "Rozet bırakmak için önce biraz sohbet etmelisin." }, { status: 403 });
  const { error } = await ctx.admin.from("member_endorsements").insert({ from_profile_id: ctx.profileId, to_profile_id: toProfileId, badge });
  if (error?.code === "23505") return NextResponse.json({ error: "Bu rozeti zaten bıraktın." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Rozet kaydedilemedi." }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
