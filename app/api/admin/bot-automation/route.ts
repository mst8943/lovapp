import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const schema = z.object({
  automationEnabled: z.boolean(),
  minReplyDelaySeconds: z.number().int().min(3).max(3600),
  maxReplyDelaySeconds: z.number().int().min(3).max(7200),
  typingMinSeconds: z.number().int().min(1).max(60),
  typingMaxSeconds: z.number().int().min(1).max(120),
  bundleWindowSeconds: z.number().int().min(1).max(60),
  bundleMaxSeconds: z.number().int().min(5).max(180),
  firstMessageEnabled: z.boolean(),
  firstMessageMinSeconds: z.number().int().min(15).max(86400),
  firstMessageMaxSeconds: z.number().int().min(15).max(172800),
  followUpEnabled: z.boolean(),
  followUpMinSeconds: z.number().int().min(3600).max(604800),
  followUpMaxSeconds: z.number().int().min(3600).max(1209600),
  phase1TimingEnabled: z.boolean(),
  phase2BehaviorEnabled: z.boolean(),
  phase3SafetyEnabled: z.boolean(),
  memoryEnabled: z.boolean(),
  dailyStateEnabled: z.boolean(),
}).refine((value) => value.minReplyDelaySeconds <= value.maxReplyDelaySeconds, { message: "Yanıt aralığı geçersiz." })
  .refine((value) => value.typingMinSeconds <= value.typingMaxSeconds, { message: "Yazma aralığı geçersiz." })
  .refine((value) => value.bundleWindowSeconds <= value.bundleMaxSeconds, { message: "Birleştirme aralığı geçersiz." })
  .refine((value) => value.firstMessageMinSeconds <= value.firstMessageMaxSeconds, { message: "İlk mesaj aralığı geçersiz." })
  .refine((value) => value.followUpMinSeconds <= value.followUpMaxSeconds, { message: "Takip mesajı aralığı geçersiz." });

export async function GET() {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("bot_automation_settings").select("*").eq("id", true).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ settings: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ayarlar geçersiz." }, { status: 400 });
  const value = parsed.data;
  const payload = {
    automation_enabled: value.automationEnabled,
    min_reply_delay_seconds: value.minReplyDelaySeconds,
    max_reply_delay_seconds: value.maxReplyDelaySeconds,
    typing_min_seconds: value.typingMinSeconds,
    typing_max_seconds: value.typingMaxSeconds,
    bundle_window_seconds: value.bundleWindowSeconds,
    bundle_max_seconds: value.bundleMaxSeconds,
    first_message_enabled: value.firstMessageEnabled,
    first_message_min_seconds: value.firstMessageMinSeconds,
    first_message_max_seconds: value.firstMessageMaxSeconds,
    follow_up_enabled: value.followUpEnabled,
    follow_up_min_seconds: value.followUpMinSeconds,
    follow_up_max_seconds: value.followUpMaxSeconds,
    phase1_timing_enabled: value.phase1TimingEnabled,
    phase2_behavior_enabled: value.phase2BehaviorEnabled,
    phase3_safety_enabled: value.phase3SafetyEnabled,
    memory_enabled: value.memoryEnabled,
    daily_state_enabled: value.dailyStateEnabled,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await auth.admin.from("bot_automation_settings").update(payload).eq("id", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.automation.global.updated", event_target_type: "bot_automation", event_target_id: "global", event_metadata: payload });
  return NextResponse.json({ saved: true });
}
