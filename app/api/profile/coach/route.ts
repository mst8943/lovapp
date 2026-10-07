import { NextResponse } from "next/server";
import { generateProfileCoaching } from "@/lib/ai/provider";
import { scoreProfile } from "@/lib/profile-coach";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = 3;

export async function POST() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id,bio,city,gender,is_verified,birth_date").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

  const [photos, answers, voice] = await Promise.all([
    admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("moderation_status", "approved"),
    admin.from("profile_answers").select("answer,icebreaker_prompts(prompt)").eq("profile_id", profile.id).order("sort_order").limit(5),
    admin.from("profile_voice_prompts").select("profile_id").eq("profile_id", profile.id).maybeSingle(),
  ]);
  const answerRows = (answers.data ?? []).filter((row) => String(row.answer ?? "").trim());
  const report = scoreProfile({ photoCount: photos.count ?? 0, bio: profile.bio, answerCount: answerRows.length, verified: Boolean(profile.is_verified), hasVoice: Boolean(voice.data), hasCity: Boolean(profile.city) });

  let tips: string[] | null = null;
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY);
  if (aiConfigured) {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { count, error: countError } = await admin.from("profile_coach_runs").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).gte("created_at", since);
    if (!countError && (count ?? 0) >= DAILY_LIMIT) return NextResponse.json({ error: `Günde en fazla ${DAILY_LIMIT} kez koç analizi alabilirsin. Yarın tekrar dene.` }, { status: 429 });
    if (!countError) await admin.from("profile_coach_runs").insert({ profile_id: profile.id });
    const context = {
      bio: (profile.bio ?? "").slice(0, 600),
      city: profile.city ?? null,
      answers: answerRows.map((row) => { const prompt = row.icebreaker_prompts as { prompt?: string } | { prompt?: string }[] | null; return { prompt: Array.isArray(prompt) ? prompt[0]?.prompt : prompt?.prompt, answer: String(row.answer).slice(0, 300) }; }),
      photoCount: photos.count ?? 0,
      checklist: report.checks.map((check) => ({ item: check.label, done: check.ok })),
    };
    tips = await generateProfileCoaching(admin, context, user.id).catch(() => null);
  }
  return NextResponse.json({ score: report.score, checks: report.checks, tips, source: tips ? "ai" : "rules" }, { headers: { "Cache-Control": "private, no-store" } });
}
