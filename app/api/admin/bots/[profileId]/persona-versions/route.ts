import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { generateBotReply, type AiProvider } from "@/lib/ai/provider";

const uuid = z.string().uuid();
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), persona: z.string().trim().min(20).max(8000), provider: z.enum(["inherit","openai","openrouter","deepseek","gemini"]), model: z.string().trim().min(1).max(160) }),
  z.object({ action: z.literal("publish"), versionId: z.string().uuid() }),
  z.object({ action: z.literal("test"), versionId: z.string().uuid(), message: z.string().trim().min(1).max(1200) }),
  z.object({ action: z.literal("duplicate"), versionId: z.string().uuid() }),
]);
type Context = { params: Promise<{ profileId: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireAdmin(["owner","bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params;
  if (!uuid.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const [{ data: current }, { data: versions }] = await Promise.all([
    auth.admin.from("bot_personas").select("persona,provider,model,updated_at").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("bot_persona_versions").select("id,version_number,status,persona,provider,model,created_at,published_at").eq("profile_id", profileId).order("version_number", { ascending: false }),
  ]);
  return NextResponse.json({ current, versions: versions ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: Context) {
  const auth = await requireAdmin(["owner","bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params;
  if (!uuid.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Persona işlemi geçersiz." }, { status: 400 });
  if (parsed.data.action === "draft") {
    const { data: latest } = await auth.admin.from("bot_persona_versions").select("version_number").eq("profile_id", profileId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await auth.admin.from("bot_persona_versions").insert({ profile_id: profileId, version_number: (latest?.version_number ?? 0) + 1, status: "draft", persona: parsed.data.persona, provider: parsed.data.provider, model: parsed.data.model, created_by: auth.user.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 503 });
    await audit(auth, "bot.persona.draft.created", profileId, { versionId: data.id, version: data.version_number });
    return NextResponse.json({ version: data }, { status: 201 });
  }
  const { data: version } = await auth.admin.from("bot_persona_versions").select("*").eq("id", parsed.data.versionId).eq("profile_id", profileId).maybeSingle();
  if (!version) return NextResponse.json({ error: "Persona sürümü bulunamadı." }, { status: 404 });
  if (parsed.data.action === "duplicate") {
    const { data: latest } = await auth.admin.from("bot_persona_versions").select("version_number").eq("profile_id", profileId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await auth.admin.from("bot_persona_versions").insert({ profile_id: profileId, version_number: (latest?.version_number ?? 0) + 1, status: "draft", persona: version.persona, provider: version.provider, model: version.model, created_by: auth.user.id }).select().single();
    if (error) return NextResponse.json({ error: "Sürüm taslağa kopyalanamadı." }, { status: 503 });
    await audit(auth, "bot.persona.version.duplicated", profileId, { sourceVersionId: version.id, versionId: data.id });
    return NextResponse.json({ version: data }, { status: 201 });
  }
  if (parsed.data.action === "test") {
    const generated = await generateBotReply({ admin: auth.admin, persona: version.persona, history: [{ role: "user", content: parsed.data.message }], userId: auth.user.id, closing: false, preferredProvider: version.provider as AiProvider | "inherit", modelOverride: version.model });
    return NextResponse.json({ reply: generated.text, provider: generated.provider, model: generated.model });
  }
  const { error } = await auth.admin.rpc("publish_bot_persona_version", { version_uuid: version.id, actor_uuid: auth.user.id });
  if (error) return NextResponse.json({ error: "Persona atomik olarak yayınlanamadı." }, { status: 503 });
  await audit(auth, "bot.persona.published", profileId, { versionId: version.id, version: version.version_number });
  return NextResponse.json({ published: true });
}

async function audit(auth: Exclude<Awaited<ReturnType<typeof requireAdmin>>, NextResponse>, action: string, targetId: string, metadata: Record<string, unknown>) {
  await auth.session.rpc("write_admin_audit", { event_action: action, event_target_type: "bot_profile", event_target_id: targetId, event_metadata: metadata });
}
