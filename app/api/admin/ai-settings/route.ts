import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateBotReply, type AiProvider } from "@/lib/ai/provider";
import { toneGuideInfo } from "@/lib/ai/tone-guide";

const schema = z.object({
  defaultProvider: z.enum(["openai", "openrouter", "deepseek", "gemini"]),
  fallbackOrder: z.array(z.enum(["openai", "openrouter", "deepseek", "gemini"])).max(4),
  openaiModel: z.string().trim().min(1).max(100),
  openrouterModel: z.string().trim().min(1).max(160),
  deepseekModel: z.string().trim().min(1).max(100),
  geminiModel: z.string().trim().min(1).max(100),
  globalSystemPrompt: z.string().trim().min(20).max(12000),
  globalKnowledge: z.string().trim().max(20000),
});

export async function GET() {
  if (!createAdminClient()) return NextResponse.json({ settings: demoSettings(), configured: configuredProviders(), demo: true });
  const auth = await ownerContext();
  if (auth instanceof NextResponse) return auth;
  const { data } = await auth.admin.from("ai_runtime_settings").select("*").eq("id", true).single();
  return NextResponse.json({ settings: data, configured: configuredProviders(), toneGuide: toneGuideInfo });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "AI ayarlarını kontrol et." }, { status: 400 });
  if (!createAdminClient()) return NextResponse.json({ saved: true, configured: configuredProviders(), demo: true });
  const auth = await ownerContext();
  if (auth instanceof NextResponse) return auth;
  const { error } = await auth.admin.from("ai_runtime_settings").upsert({
    id: true,
    default_provider: parsed.data.defaultProvider,
    fallback_order: parsed.data.fallbackOrder,
    openai_model: parsed.data.openaiModel,
    openrouter_model: parsed.data.openrouterModel,
    deepseek_model: parsed.data.deepseekModel,
    gemini_model: parsed.data.geminiModel,
    global_system_prompt: parsed.data.globalSystemPrompt,
    global_knowledge: parsed.data.globalKnowledge,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "AI ayarları kaydedilemedi." }, { status: 500 });
  await auth.session.rpc("write_admin_audit", { event_action: "ai.settings.updated", event_target_type: "ai_runtime", event_target_id: "global", event_metadata: { defaultProvider: parsed.data.defaultProvider } });
  return NextResponse.json({ saved: true, configured: configuredProviders() });
}

export async function POST() {
  const auth = await ownerContext(); if (auth instanceof NextResponse) return auth;
  const { data: settings } = await auth.admin.from("ai_runtime_settings").select("openai_model,openrouter_model,deepseek_model,gemini_model").eq("id", true).single();
  const configured = configuredProviders();
  const providers = (["openai","openrouter","deepseek","gemini"] as AiProvider[]).filter((provider) => configured[provider]);
  const tests = await Promise.all(providers.map(async (provider) => {
    const started = Date.now();
    try {
      const result = await generateBotReply({ admin: auth.admin, persona: "Sen Lovask test botusun. Kısa ve doğal cevap ver.", history: [{ role: "user", content: "Bugün nasılsın? Tek kısa cümleyle cevap ver." }], userId: auth.userId, closing: false, preferredProvider: provider, modelOverride: settings?.[`${provider}_model`], allowFallback: false });
      return { provider, ok: true, model: result.model, latencyMs: Date.now() - started, sample: result.text.slice(0, 180) };
    } catch (error) { return { provider, ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message.slice(0, 180) : "Bağlantı başarısız" }; }
  }));
  return NextResponse.json({ tests, configured });
}

async function ownerContext() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: role } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "owner") return NextResponse.json({ error: "Yalnızca kurucu değiştirebilir." }, { status: 403 });
  return { session, admin, userId: user.id };
}

function configuredProviders() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };
}

function demoSettings() {
  return { default_provider: process.env.AI_DEFAULT_PROVIDER ?? "deepseek", fallback_order: ["openrouter","gemini","openai"], openai_model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna", openrouter_model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash", deepseek_model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash", gemini_model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash", global_system_prompt: "Türkçe konuşma dilini kullan. Resmî ve robotik cümlelerden kaçın; bağlama göre sıcak, kısa ve doğal cevap ver.", global_knowledge: "" };
}
