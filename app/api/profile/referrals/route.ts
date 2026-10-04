import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function context() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  const admin = createAdminClient();
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id,onboarding_completed").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile?.onboarding_completed ? { admin, profile } : null;
}

export async function GET() {
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Tamamlanmış üyelik gerekli." }, { status: 401 });
  let { data: code } = await auth.admin.from("referral_codes").select("id,code,is_active").eq("owner_profile_id", auth.profile.id).eq("kind", "member").maybeSingle();
  if (!code) {
    const generated = `LVK-${randomBytes(5).toString("hex").toUpperCase()}`;
    const result = await auth.admin.from("referral_codes").insert({ code: generated, kind: "member", owner_profile_id: auth.profile.id, label: "Üye davet kodu" }).select("id,code,is_active").single();
    code = result.data;
  }
  if (!code) return NextResponse.json({ error: "Davet kodu hazırlanamadı." }, { status: 503 });
  const [{ count: activations }, { data: rewards }] = await Promise.all([
    auth.admin.from("referral_activations").select("id", { count: "exact", head: true }).eq("referrer_profile_id", auth.profile.id),
    auth.admin.from("growth_rewards").select("days").eq("profile_id", auth.profile.id).eq("reward_type", "referrer"),
  ]);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr";
  return NextResponse.json({ code: code.code, shareUrl: `${siteUrl}/kurucu-uye?ref=${encodeURIComponent(code.code)}&utm_source=member&utm_medium=referral&utm_campaign=kurucu200`, activations: activations ?? 0, earnedDays: (rewards ?? []).reduce((sum, reward) => sum + reward.days, 0) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Üyelik gerekli." }, { status: 401 });
  const { data: code } = await auth.admin.from("referral_codes").select("id,campaign_id").eq("owner_profile_id", auth.profile.id).eq("kind", "member").maybeSingle();
  if (code) await auth.admin.from("growth_events").insert({ event_name: "referral_shared", profile_id: auth.profile.id, referral_code_id: code.id, campaign_id: code.campaign_id });
  return NextResponse.json({ ok: true });
}
