import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const uuid = z.string().uuid();
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const schema = z.object({
  automationEnabled: z.boolean().nullable(),
  minReplyDelaySeconds: nullableInt(3, 3600),
  maxReplyDelaySeconds: nullableInt(3, 7200),
  typingMinSeconds: nullableInt(1, 60),
  typingMaxSeconds: nullableInt(1, 120),
  bundleWindowSeconds: nullableInt(1, 60),
  bundleMaxSeconds: nullableInt(5, 180),
  timezone: z.string().trim().min(1).max(80).nullable(),
  weeklySchedule: z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))).nullable(),
  presenceOverride: z.enum(["auto", "online", "offline"]),
  firstMessageEnabled: z.boolean().nullable(),
  firstMessageMinSeconds: nullableInt(15, 86400),
  firstMessageMaxSeconds: nullableInt(15, 172800),
  followUpEnabled: z.boolean().nullable(),
  followUpMinSeconds: nullableInt(3600, 604800),
  followUpMaxSeconds: nullableInt(3600, 1209600),
  memoryEnabled: z.boolean().nullable(),
  dailyStateEnabled: z.boolean().nullable(),
  phase1TimingEnabled: z.boolean().nullable(),
  phase2BehaviorEnabled: z.boolean().nullable(),
  phase3SafetyEnabled: z.boolean().nullable(),
}).superRefine((value, context) => {
  const pairs = [
    [value.minReplyDelaySeconds, value.maxReplyDelaySeconds, "Yanıt gecikmesi"],
    [value.typingMinSeconds, value.typingMaxSeconds, "Yazma süresi"],
    [value.bundleWindowSeconds, value.bundleMaxSeconds, "Birleştirme süresi"],
    [value.firstMessageMinSeconds, value.firstMessageMaxSeconds, "İlk mesaj süresi"],
    [value.followUpMinSeconds, value.followUpMaxSeconds, "Takip mesajı süresi"],
  ] as const;
  for (const [min, max, label] of pairs) if (min !== null && max !== null && min > max) context.addIssue({ code: "custom", message: `${label} aralığı geçersiz.` });
  if (value.timezone) try { new Intl.DateTimeFormat("tr-TR", { timeZone: value.timezone }); } catch { context.addIssue({ code: "custom", message: "Saat dilimi geçersiz." }); }
  if (value.weeklySchedule && Object.entries(value.weeklySchedule).some(([day, ranges]) => !/^[0-6]$/.test(day) || ranges.some(([start, end]) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start > end))) context.addIssue({ code: "custom", message: "Haftalık çalışma saatleri geçersiz." });
});

type Context = { params: Promise<{ profileId: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireAdmin(["owner", "bot_editor", "support"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params;
  if (!uuid.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const [{ data: profile }, { data: settings }, { data: global }, { data: jobs }, { data: experiments }] = await Promise.all([
    auth.admin.from("profiles").select("id,display_name,is_discoverable").eq("id", profileId).eq("kind", "bot").maybeSingle(),
    auth.admin.from("bot_automation_overrides").select("*").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("bot_automation_settings").select("*").eq("id", true).single(),
    auth.admin.from("bot_reply_jobs").select("id,status,job_type,scheduled_for,created_at,completed_at,last_error").eq("bot_profile_id", profileId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    auth.admin.from("bot_experiments").select("id,name,status,traffic_percent,created_at,winner_variant,published_at").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!profile) return NextResponse.json({ error: "Bot bulunamadı." }, { status: 404 });
  const rows = jobs ?? [];
  const sent = rows.filter((job) => job.status === "sent");
  const delays = sent.flatMap((job) => job.completed_at ? [new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()] : []);
  const metrics = {
    queued: rows.filter((job) => ["queued","typing","processing"].includes(job.status)).length,
    sent: sent.length,
    failed: rows.filter((job) => job.status === "failed").length,
    firstMessages: sent.filter((job) => job.job_type === "first_message").length,
    followUps: sent.filter((job) => job.job_type === "follow_up").length,
    averageDelaySeconds: delays.length ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length / 1000) : 0,
  };
  const measuredExperiment = (experiments ?? []).find((experiment) => ["running", "paused"].includes(experiment.status)) ?? (experiments ?? []).find((experiment) => experiment.status === "completed" && !experiment.published_at);
  const experimentIds = measuredExperiment ? [measuredExperiment.id] : [];
  const { data: assignments } = experimentIds.length ? await auth.admin.from("bot_experiment_assignments").select("experiment_id,variant,sent_at,replied_at,blocked_at,reported_at").in("experiment_id", experimentIds) : { data: [] };
  const groups = ["control", "variant"].map((variant) => {
    const group = (assignments ?? []).filter((item) => item.variant === variant && item.sent_at);
    return { variant, sent: group.length, replied: group.filter((item) => item.replied_at).length, replyRate: group.length ? Math.round(group.filter((item) => item.replied_at).length / group.length * 100) : 0, safetyEvents: group.filter((item) => item.blocked_at || item.reported_at).length };
  });
  return NextResponse.json({ profile, settings, global, jobs: rows.slice(0, 12), experiments: experiments ?? [], experimentMetrics: groups, metrics }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params;
  if (!uuid.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ayarlar geçersiz." }, { status: 400 });
  const value = parsed.data;
  const payload = {
    profile_id: profileId,
    automation_enabled: value.automationEnabled,
    min_reply_delay_seconds: value.minReplyDelaySeconds,
    max_reply_delay_seconds: value.maxReplyDelaySeconds,
    typing_min_seconds: value.typingMinSeconds,
    typing_max_seconds: value.typingMaxSeconds,
    bundle_window_seconds: value.bundleWindowSeconds,
    bundle_max_seconds: value.bundleMaxSeconds,
    timezone: value.timezone,
    weekly_schedule: value.weeklySchedule,
    presence_override: value.presenceOverride,
    first_message_enabled: value.firstMessageEnabled,
    first_message_min_seconds: value.firstMessageMinSeconds,
    first_message_max_seconds: value.firstMessageMaxSeconds,
    follow_up_enabled: value.followUpEnabled,
    follow_up_min_seconds: value.followUpMinSeconds,
    follow_up_max_seconds: value.followUpMaxSeconds,
    memory_enabled: value.memoryEnabled,
    daily_state_enabled: value.dailyStateEnabled,
    phase1_timing_enabled: value.phase1TimingEnabled,
    phase2_behavior_enabled: value.phase2BehaviorEnabled,
    phase3_safety_enabled: value.phase3SafetyEnabled,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await auth.admin.from("bot_automation_overrides").upsert(payload, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.automation.override.updated", event_target_type: "bot_profile", event_target_id: profileId, event_metadata: payload });
  return NextResponse.json({ saved: true });
}
