import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWingmanSuggestions } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ profileId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Profil geçersiz." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı gerekli." }, { status: 503 });
  const { data: viewer } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!viewer) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
  const [{ data: match }, { data: target }] = await Promise.all([
    admin.from("matches").select("id").eq("status", "active").eq("connection_type", "matched")
      .or(`and(user_a.eq.${viewer.id},user_b.eq.${parsed.data.profileId}),and(user_a.eq.${parsed.data.profileId},user_b.eq.${viewer.id})`).maybeSingle(),
    admin.from("profiles").select("id,display_name").eq("id", parsed.data.profileId).eq("kind", "human").maybeSingle(),
  ]);
  if (!match || !target) return NextResponse.json({ error: "Aktif eşleşme gerekli." }, { status: 403 });
  const { data: answers } = await admin.from("profile_answers").select("answer,icebreaker_prompts(prompt)").eq("profile_id", target.id).order("sort_order").limit(3);
  const context = { name: target.display_name, answers: (answers ?? []).map((entry) => {
    const prompt = entry.icebreaker_prompts as { prompt?: string } | { prompt?: string }[] | null;
    return { prompt: Array.isArray(prompt) ? prompt[0]?.prompt : prompt?.prompt, answer: entry.answer };
  }) };
  const configured = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY);
  if (configured) {
    const { data: reserved, error: reserveError } = await session.rpc("reserve_wingman_request");
    if (reserveError) return NextResponse.json({ error: "Danışman hakkı kontrol edilemedi." }, { status: 503 });
    if (!reserved) return NextResponse.json({ error: "Bugünkü 3 öneri hakkın doldu." }, { status: 429 });
    const suggestions = await generateWingmanSuggestions(admin, context, user.id);
    if (suggestions) return NextResponse.json({ suggestions, source: "ai" }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const topic = String(context.answers.find((item) => item.answer)?.answer ?? "").replace(/[“”"\n\r]/g, " ").trim().slice(0, 62);
  const suggestions = topic ? [
    `Profilindeki “${topic}” kısmını merak ettim. Hikâyesi nedir?`,
    `“${topic}” deyince aklına gelen ilk anı hangisi?`,
    `Bu konuda aynı fikirde miyiz merak ettim: ${topic}?`,
  ] : [
    "Burada seni tanımaya nereden başlasam? Son zamanlarda seni ne heyecanlandırdı?",
    "Güzel bir sohbet için tek bir konu seçsen hangisi olurdu?",
    "Bu hafta seni gülümseten en küçük şey neydi?",
  ];
  return NextResponse.json({ suggestions: suggestions.map((item) => item.slice(0, 140)), source: "profile" }, { headers: { "Cache-Control": "private, no-store" } });
}
