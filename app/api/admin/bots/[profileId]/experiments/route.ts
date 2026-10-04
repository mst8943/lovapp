import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const variantConfigSchema = z.object({
  min_reply_delay_seconds: z.number().int().min(3).max(3600),
  max_reply_delay_seconds: z.number().int().min(3).max(7200),
}).strict().refine((value) => value.min_reply_delay_seconds <= value.max_reply_delay_seconds);
const schema = z.object({ name: z.string().trim().min(3).max(120), trafficPercent: z.number().int().min(1).max(100), variantConfig: variantConfigSchema });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), experimentId: z.string().uuid() }),
  z.object({ action: z.literal("resume"), experimentId: z.string().uuid() }),
  z.object({ action: z.literal("complete"), experimentId: z.string().uuid() }),
  z.object({ action: z.literal("publish"), experimentId: z.string().uuid(), winner: z.enum(["control","variant"]) }),
]);
type Context = { params: Promise<{ profileId: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireAdmin(["owner","bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params;
  if (!z.string().uuid().safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Deney ayarları geçersiz." }, { status: 400 });
  const [{ data: override }, { data: global }] = await Promise.all([
    auth.admin.from("bot_automation_overrides").select("min_reply_delay_seconds,max_reply_delay_seconds").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("bot_automation_settings").select("min_reply_delay_seconds,max_reply_delay_seconds").eq("id", true).single(),
  ]);
  const controlConfig = { min_reply_delay_seconds: override?.min_reply_delay_seconds ?? global?.min_reply_delay_seconds ?? 20, max_reply_delay_seconds: override?.max_reply_delay_seconds ?? global?.max_reply_delay_seconds ?? 90 };
  await auth.admin.from("bot_experiments").update({ status: "paused", ended_at: new Date().toISOString() }).eq("profile_id", profileId).eq("status", "running");
  const { data, error } = await auth.admin.from("bot_experiments").insert({ profile_id: profileId, name: parsed.data.name, status: "running", traffic_percent: parsed.data.trafficPercent, variant_config: parsed.data.variantConfig, control_config: controlConfig, started_at: new Date().toISOString(), created_by: auth.user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.experiment.started", event_target_type: "bot_profile", event_target_id: profileId, event_metadata: { experimentId: data.id, trafficPercent: data.traffic_percent } });
  return NextResponse.json({ experiment: data }, { status: 201 });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin(["owner","bot_editor"]); if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params;
  if (!z.string().uuid().safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Deney işlemini kontrol et." }, { status: 400 });
  const { data: experiment } = await auth.admin.from("bot_experiments").select("id,status,control_config,variant_config").eq("id", parsed.data.experimentId).eq("profile_id", profileId).maybeSingle();
  if (!experiment) return NextResponse.json({ error: "Deney bulunamadı." }, { status: 404 });
  if (parsed.data.action === "publish") {
    const { data: assignments } = await auth.admin.from("bot_experiment_assignments").select("variant,sent_at").eq("experiment_id", experiment.id).not("sent_at", "is", null);
    const control = (assignments ?? []).filter((item) => item.variant === "control").length;
    const variant = (assignments ?? []).filter((item) => item.variant === "variant").length;
    if (control < 200 || variant < 200) return NextResponse.json({ error: `Yayın için her grupta 200 gönderim gerekli. Kontrol ${control}, varyant ${variant}.` }, { status: 409 });
    const config = (parsed.data.winner === "control" ? experiment.control_config : experiment.variant_config) as Record<string, unknown>;
    const allowed = ["min_reply_delay_seconds","max_reply_delay_seconds","typing_min_seconds","typing_max_seconds","bundle_window_seconds","bundle_max_seconds"];
    const payload = Object.fromEntries(Object.entries(config).filter(([key]) => allowed.includes(key)));
    const { error } = await auth.admin.from("bot_automation_overrides").upsert({ profile_id: profileId, ...payload, updated_by: auth.user.id, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Kazanan ayarlar yayınlanamadı." }, { status: 503 });
    await auth.admin.from("bot_experiments").update({ status: "completed", ended_at: new Date().toISOString(), winner_variant: parsed.data.winner, published_at: new Date().toISOString() }).eq("id", experiment.id);
    await auth.session.rpc("write_admin_audit", { event_action: "bot.experiment.winner_published", event_target_type: "bot_profile", event_target_id: profileId, event_metadata: { experimentId: experiment.id, winner: parsed.data.winner, control, variant } });
    return NextResponse.json({ published: true, winner: parsed.data.winner });
  }
  const status = parsed.data.action === "pause" ? "paused" : parsed.data.action === "resume" ? "running" : "completed";
  const { error } = await auth.admin.from("bot_experiments").update({ status, ended_at: status === "completed" ? new Date().toISOString() : null }).eq("id", experiment.id);
  if (error) return NextResponse.json({ error: "Deney durumu güncellenemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: `bot.experiment.${status}`, event_target_type: "bot_profile", event_target_id: profileId, event_metadata: { experimentId: experiment.id } });
  return NextResponse.json({ status });
}
