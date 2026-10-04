import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMeetingProfiles } from "@/lib/discovery";

async function context() {
  const session = await createClient();
  const admin = createAdminClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  if (!session || !admin || !user) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile ? { session, admin, profileId: profile.id } : null;
}
const unavailable = () => NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
export async function GET() {
  const ctx = await context(); if (!ctx) return unavailable();
  try {
    const [options, mine] = await Promise.all([
      ctx.admin.from("meeting_options").select("id,label,icon").eq("active", true).order("sort_order").order("id"),
      ctx.admin.from("meeting_intents").select("option_id,expires_at").eq("profile_id", ctx.profileId).gt("expires_at", new Date().toISOString()).maybeSingle(),
    ]);
    if (options.error || mine.error) throw new Error();
    const selected = options.data.some((option) => option.id === mine.data?.option_id) ? mine.data : null;
    let profiles: Awaited<ReturnType<typeof loadMeetingProfiles>> = [];
    if (selected) {
      profiles = await loadMeetingProfiles(ctx.session, ctx.admin, ctx.profileId);
    }
    return NextResponse.json({ options: options.data, selected, profiles }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Buluşma alanı yüklenemedi." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const ctx = await context(); if (!ctx) return unavailable();
  const parsed = z.object({ optionId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bir plan seç." }, { status: 400 });
  const { data: option, error: optionError } = await ctx.admin.from("meeting_options").select("id").eq("id", parsed.data.optionId).eq("active", true).maybeSingle();
  if (optionError) return NextResponse.json({ error: "Plan kontrol edilemedi." }, { status: 503 });
  if (!option) return NextResponse.json({ error: "Bu plan artık kullanılamıyor." }, { status: 409 });
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const { error } = await ctx.admin.from("meeting_intents").upsert({ profile_id: ctx.profileId, option_id: option.id, expires_at: expiresAt });
  return error ? NextResponse.json({ error: "Plan kaydedilemedi." }, { status: 503 }) : NextResponse.json({ expiresAt });
}
export async function DELETE() {
  const ctx = await context(); if (!ctx) return unavailable();
  const { error } = await ctx.admin.from("meeting_intents").delete().eq("profile_id", ctx.profileId);
  return error ? NextResponse.json({ error: "Plan kaldırılamadı." }, { status: 503 }) : NextResponse.json({ removed: true });
}
