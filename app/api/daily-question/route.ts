import { NextResponse } from "next/server";
import { z } from "zod";
import { istanbulDate, questionForDate } from "@/lib/daily-question";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const answerSchema = z.object({ optionIndex: z.number().int().min(0).max(3) });

async function context() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle();
  return profile ? { admin, profileId: profile.id as string } : null;
}

async function state(ctx: NonNullable<Awaited<ReturnType<typeof context>>>) {
  const date = istanbulDate();
  const question = questionForDate(date);
  const { data: mine } = await ctx.admin.from("daily_question_answers").select("option_index").eq("profile_id", ctx.profileId).eq("question_date", date).maybeSingle();
  let sameCount = 0;
  if (mine) {
    const { count } = await ctx.admin.from("daily_question_answers").select("profile_id", { count: "exact", head: true })
      .eq("question_date", date).eq("question_key", question.key).eq("option_index", mine.option_index).neq("profile_id", ctx.profileId);
    sameCount = count ?? 0;
  }
  return { date, question: { key: question.key, text: question.text, options: question.options }, answer: mine?.option_index ?? null, sameCount };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  try { return NextResponse.json(await state(ctx), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Günün sorusu yüklenemedi." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz şık." }, { status: 400 });
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  const date = istanbulDate();
  const question = questionForDate(date);
  if (parsed.data.optionIndex >= question.options.length) return NextResponse.json({ error: "Geçersiz şık." }, { status: 400 });
  const { error } = await ctx.admin.from("daily_question_answers").insert({ profile_id: ctx.profileId, question_date: date, question_key: question.key, option_index: parsed.data.optionIndex });
  if (error?.code === "23505") return NextResponse.json({ error: "Bugünkü soruyu zaten yanıtladın." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Yanıt kaydedilemedi." }, { status: 503 });
  return NextResponse.json(await state(ctx), { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
