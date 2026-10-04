import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyBotConversationRisk, generateBotReply, summarizeBotMemory, type AiProvider } from "@/lib/ai/provider";
import { buildConversationBehaviorContext } from "@/lib/ai/conversation-style";
import { sendPushToProfile } from "@/lib/push";

export type WeeklySchedule = Record<string, [string, string][]>;
export type AutomationSettings = {
  automation_enabled: boolean;
  min_reply_delay_seconds: number;
  max_reply_delay_seconds: number;
  typing_min_seconds: number;
  typing_max_seconds: number;
  bundle_window_seconds: number;
  bundle_max_seconds: number;
  timezone: string;
  weekly_schedule: WeeklySchedule;
  presence_override: "auto" | "online" | "offline";
  first_message_enabled: boolean;
  first_message_min_seconds: number;
  first_message_max_seconds: number;
  follow_up_enabled: boolean;
  follow_up_min_seconds: number;
  follow_up_max_seconds: number;
  memory_enabled: boolean;
  daily_state_enabled: boolean;
  phase1_timing_enabled: boolean;
  phase2_behavior_enabled: boolean;
  phase3_safety_enabled: boolean;
  experiment_id: string | null;
  experiment_variant: "control" | "variant" | null;
};

const DEFAULT_SCHEDULE: WeeklySchedule = {
  "0": [["10:00", "23:30"]], "1": [["09:00", "23:30"]],
  "2": [["09:00", "23:30"]], "3": [["09:00", "23:30"]],
  "4": [["09:00", "23:30"]], "5": [["09:00", "23:59"]],
  "6": [["10:00", "23:59"]],
};

const DEFAULTS: AutomationSettings = {
  automation_enabled: true,
  min_reply_delay_seconds: 20,
  max_reply_delay_seconds: 90,
  typing_min_seconds: 3,
  typing_max_seconds: 12,
  bundle_window_seconds: 12,
  bundle_max_seconds: 45,
  timezone: "Europe/Istanbul",
  weekly_schedule: DEFAULT_SCHEDULE,
  presence_override: "auto",
  first_message_enabled: true,
  first_message_min_seconds: 120,
  first_message_max_seconds: 900,
  follow_up_enabled: true,
  follow_up_min_seconds: 43_200,
  follow_up_max_seconds: 129_600,
  memory_enabled: true,
  daily_state_enabled: true,
  phase1_timing_enabled: true,
  phase2_behavior_enabled: true,
  phase3_safety_enabled: true,
  experiment_id: null,
  experiment_variant: null,
};

type AdminClient = SupabaseClient;

export async function resolveAutomationSettings(admin: AdminClient, botProfileId: string, matchId?: string) {
  const [{ data: global }, { data: override }] = await Promise.all([
    admin.from("bot_automation_settings").select("*").eq("id", true).maybeSingle(),
    admin.from("bot_automation_overrides").select("*").eq("profile_id", botProfileId).maybeSingle(),
  ]);
  const merged = mergeAutomationSettings(global, override);
  if (matchId && merged.phase3_safety_enabled) {
    const { data: experiment } = await admin.from("bot_experiments").select("id,traffic_percent,control_config,variant_config").eq("profile_id", botProfileId).eq("status", "running").limit(1).maybeSingle();
    if (experiment) {
      const { data: existingAssignment } = await admin.from("bot_experiment_assignments").select("variant").eq("experiment_id", experiment.id).eq("match_id", matchId).maybeSingle();
      const variantName = (existingAssignment?.variant ?? (stableBucket(`${matchId}:${botProfileId}`) < experiment.traffic_percent ? "variant" : "control")) as "control" | "variant";
      merged.experiment_id = experiment.id;
      merged.experiment_variant = variantName;
      await admin.from("bot_experiment_assignments").upsert({ experiment_id: experiment.id, match_id: matchId, variant: variantName }, { onConflict: "experiment_id,match_id", ignoreDuplicates: true });
      const selectedConfig = (variantName === "variant" ? experiment.variant_config : experiment.control_config) as Record<string, unknown>;
      const minDelay = Number(selectedConfig.min_reply_delay_seconds);
      const maxDelay = Number(selectedConfig.max_reply_delay_seconds);
      if (Number.isInteger(minDelay) && Number.isInteger(maxDelay) && minDelay >= 3 && minDelay <= 3600 && maxDelay >= minDelay && maxDelay <= 7200) {
        merged.min_reply_delay_seconds = minDelay;
        merged.max_reply_delay_seconds = maxDelay;
      }
    }
  }
  return merged;
}

function mergeAutomationSettings(global: Record<string, unknown> | null, override: Record<string, unknown> | null) {
  const merged = { ...DEFAULTS, ...(global ?? {}) } as AutomationSettings;
  if (override) for (const key of Object.keys(DEFAULTS) as (keyof AutomationSettings)[]) {
    const value = override[key];
    if (value !== null && value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

export async function botPresences(admin: AdminClient, profileIds: string[]) {
  if (!profileIds.length) return new Map<string, ReturnType<typeof botPresence>>();
  const [{ data: global }, { data: overrides }] = await Promise.all([
    admin.from("bot_automation_settings").select("*").eq("id", true).maybeSingle(),
    admin.from("bot_automation_overrides").select("*").in("profile_id", profileIds),
  ]);
  const byId = new Map((overrides ?? []).map((row) => [row.profile_id, row]));
  const now = new Date();
  return new Map(profileIds.map((id) => [id, botPresence(mergeAutomationSettings(global, byId.get(id) ?? null), now)]));
}

export async function scheduleBotReply(input: {
  admin: AdminClient;
  matchId: string;
  botProfileId: string;
  memberProfileId: string;
  sourceMessageId?: string;
}) {
  const settings = await resolveAutomationSettings(input.admin, input.botProfileId, input.matchId);
  if (!settings.automation_enabled || !settings.phase1_timing_enabled) return null;
  const now = new Date();
  const source = input.sourceMessageId
    ? (await input.admin.from("messages").select("body,transcript").eq("id", input.sourceMessageId).maybeSingle()).data
    : null;
  const sourceText = source?.body ?? source?.transcript ?? "";
  const thoughtful = sourceText.length > 180 || /(?:üzgün|kötüyüm|ayrıld|kaybett|sence ne yap|ciddi)/i.test(sourceText);
  const delaySeconds = thoughtful
    ? randomBetween(Math.max(60, settings.min_reply_delay_seconds), Math.max(240, settings.max_reply_delay_seconds))
    : randomBetween(Math.max(15, settings.min_reply_delay_seconds), settings.max_reply_delay_seconds);
  const typingSeconds = Math.min(delaySeconds, randomBetween(settings.typing_min_seconds, settings.typing_max_seconds));
  const candidate = nextActiveDate(new Date(now.getTime() + Math.max(delaySeconds, settings.bundle_window_seconds) * 1000), settings);
  let { data: active } = await input.admin.from("bot_reply_jobs").select("id,first_input_at,status,scheduled_for,job_type")
    .eq("match_id", input.matchId).in("status", ["queued", "typing", "processing"]).maybeSingle();
  if (active && active.job_type !== "reply" && active.status !== "processing") {
    await cancelJob(input.admin, active.id, "user_replied");
    active = null;
  }
  if (active?.status === "processing") return active;
  const earliestAfterBundle = new Date(now.getTime() + settings.bundle_window_seconds * 1000);
  const originalDue = active?.scheduled_for ? new Date(active.scheduled_for) : candidate;
  const bundleCeiling = new Date(originalDue.getTime() + settings.bundle_max_seconds * 1000);
  const delayedForLatestInput = originalDue > earliestAfterBundle ? originalDue : earliestAfterBundle;
  const bounded = delayedForLatestInput > bundleCeiling ? bundleCeiling : delayedForLatestInput;
  const typingAt = new Date(Math.max(now.getTime(), bounded.getTime() - typingSeconds * 1000));
  const payload = {
    match_id: input.matchId, bot_profile_id: input.botProfileId, member_profile_id: input.memberProfileId,
    source_message_id: input.sourceMessageId ?? null, status: "queued", scheduled_for: bounded.toISOString(),
    typing_at: typingAt.toISOString(), last_input_at: now.toISOString(), updated_at: now.toISOString(),
    experiment_id: settings.experiment_id, experiment_variant: settings.experiment_variant,
  };
  if (active) {
    const { data } = await input.admin.from("bot_reply_jobs").update(payload).eq("id", active.id).in("status", ["queued", "typing"]).select().maybeSingle();
    return data ?? active;
  }
  const { data, error } = await input.admin.from("bot_reply_jobs").insert(payload).select().single();
  if (error?.code === "23505") {
    return (await input.admin.from("bot_reply_jobs").select("*").eq("match_id", input.matchId).in("status", ["queued", "typing", "processing"]).maybeSingle()).data;
  }
  if (error) throw error;
  return data;
}

export async function scheduleProactiveBotJob(input: {
  admin: AdminClient;
  matchId: string;
  botProfileId: string;
  memberProfileId: string;
  jobType: "first_message" | "follow_up";
}) {
  const settings = await resolveAutomationSettings(input.admin, input.botProfileId, input.matchId);
  const enabled = input.jobType === "first_message" ? settings.first_message_enabled : settings.follow_up_enabled;
  if (!settings.automation_enabled || !settings.phase1_timing_enabled || !settings.phase2_behavior_enabled || !enabled) return null;
  const { data: previous } = await input.admin.from("bot_reply_jobs").select("id").eq("match_id", input.matchId)
    .eq("job_type", input.jobType).limit(1).maybeSingle();
  if (previous) return null;
  const min = input.jobType === "first_message" ? settings.first_message_min_seconds : settings.follow_up_min_seconds;
  const max = input.jobType === "first_message" ? settings.first_message_max_seconds : settings.follow_up_max_seconds;
  const scheduledFor = nextActiveDate(new Date(Date.now() + randomBetween(min, max) * 1000), settings);
  const typingSeconds = randomBetween(settings.typing_min_seconds, settings.typing_max_seconds);
  const { data, error } = await input.admin.from("bot_reply_jobs").insert({
    match_id: input.matchId, bot_profile_id: input.botProfileId, member_profile_id: input.memberProfileId,
    job_type: input.jobType, status: "queued", scheduled_for: scheduledFor.toISOString(),
    typing_at: new Date(scheduledFor.getTime() - typingSeconds * 1000).toISOString(),
    experiment_id: settings.experiment_id, experiment_variant: settings.experiment_variant,
  }).select().single();
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data;
}

export async function processDueBotJobs(admin: AdminClient, options: { matchId?: string; limit?: number } = {}) {
  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  let staleQuery = admin.from("bot_reply_jobs").select("id,attempt_count,max_attempts").eq("status", "processing").lt("locked_at", staleBefore).limit(30);
  if (options.matchId) staleQuery = staleQuery.eq("match_id", options.matchId);
  const { data: staleJobs } = await staleQuery;
  await Promise.all((staleJobs ?? []).map((job) => {
    const attempts = Number(job.attempt_count ?? 0) + 1;
    return admin.from("bot_reply_jobs").update({ status: attempts >= Number(job.max_attempts ?? 3) ? "failed" : "queued", attempt_count: attempts, locked_at: null, last_error: "worker_lease_expired", updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "processing");
  }));
  let query = admin.from("bot_reply_jobs").select("*").in("status", ["queued", "typing"])
    .lte("scheduled_for", new Date().toISOString()).order("scheduled_for").limit(options.limit ?? 8);
  if (options.matchId) query = query.eq("match_id", options.matchId);
  const { data: jobs } = await query;
  const results: Record<string, unknown>[] = [];
  const pending = jobs ?? [];
  for (let index = 0; index < pending.length; index += 3) results.push(...await Promise.all(pending.slice(index, index + 3).map((job) => processJob(admin, job))));
  return results;
}

export async function advanceTypingState(admin: AdminClient, matchId: string) {
  const now = new Date().toISOString();
  await admin.from("bot_reply_jobs").update({ status: "typing", updated_at: now })
    .eq("match_id", matchId).eq("status", "queued").lte("typing_at", now).gt("scheduled_for", now);
  return getBotJobState(admin, matchId);
}

export async function getBotJobState(admin: AdminClient, matchId: string) {
  const { data } = await admin.from("bot_reply_jobs").select("id,status,typing_at,scheduled_for,updated_at")
    .eq("match_id", matchId).in("status", ["queued", "typing", "processing"]).maybeSingle();
  if (data) return { pending: true, typing: data.status === "typing" || data.status === "processing", status: data.status, scheduledFor: data.scheduled_for };
  const recentSince = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: latest } = await admin.from("bot_reply_jobs").select("cancellation_reason,updated_at").eq("match_id", matchId).gte("updated_at", recentSince).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return { pending: false, typing: false, quotaReached: latest?.cancellation_reason === "quota_reached" };
}

async function processJob(admin: AdminClient, job: Record<string, unknown>) {
  const id = String(job.id);
  const now = new Date().toISOString();
  const { data: claimed } = await admin.from("bot_reply_jobs").update({ status: "processing", locked_at: now, updated_at: now })
    .eq("id", id).in("status", ["queued", "typing"]).select().maybeSingle();
  if (!claimed) return { id, skipped: true };
  const matchId = String(claimed.match_id);
  const botId = String(claimed.bot_profile_id);
  const memberId = String(claimed.member_profile_id);
  const jobType = String(claimed.job_type) as "reply" | "first_message" | "follow_up";
  let settings = DEFAULTS;
  try {
    settings = await resolveAutomationSettings(admin, botId, matchId);
    if (!settings.automation_enabled || !settings.phase1_timing_enabled) {
      await cancelJob(admin, id, "feature_disabled");
      return { id, cancelled: true };
    }
    const [{ data: control }, { data: persona }, { data: match }, { data: latest }] = await Promise.all([
      admin.from("bot_conversation_controls").select("mode,takeover_expires_at,auto_return_to_ai").eq("match_id", matchId).maybeSingle(),
      admin.from("bot_personas").select("persona,provider,model").eq("profile_id", botId).eq("is_active", true).maybeSingle(),
      admin.from("matches").select("status").eq("id", matchId).maybeSingle(),
      admin.from("messages").select("id,sender_id,body,transcript,created_at").eq("match_id", matchId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    let controlMode = control?.mode ?? "ai";
    if (controlMode === "admin" && control?.auto_return_to_ai && control.takeover_expires_at && new Date(control.takeover_expires_at) <= new Date()) {
      await admin.from("bot_conversation_controls").update({ mode: "ai", takeover_expires_at: null, updated_at: now }).eq("match_id", matchId);
      controlMode = "ai";
    }
    if (controlMode !== "ai" || match?.status !== "active" || !persona) {
      await cancelJob(admin, id, controlMode !== "ai" ? `${controlMode}_takeover` : "conversation_unavailable");
      return { id, cancelled: true };
    }
    if (jobType === "first_message" && latest) {
      await cancelJob(admin, id, "conversation_already_started");
      return { id, cancelled: true };
    }
    if (jobType === "follow_up" && (!latest || latest.sender_id !== botId)) {
      await cancelJob(admin, id, "user_replied");
      return { id, cancelled: true };
    }
    if (settings.phase3_safety_enabled && jobType === "reply" && latest?.sender_id === memberId) {
      const risk = await classifyBotConversationRisk(latest.body ?? latest.transcript ?? "");
      if (risk.high) {
        const [{ data: safetyMessage }] = await Promise.all([
          admin.from("messages").insert({ match_id: matchId, sender_id: botId, kind: "text", body: "Bunu tek başına taşımana gerek yok. Şu an güvende değilsen lütfen yakınındaki güvendiğin birine ve yerel acil yardım hizmetine hemen ulaş; ben burada kalacağım." }).select("id,created_at").single(),
          admin.from("bot_risk_events").insert({ match_id: matchId, message_id: latest.id, category: risk.category, severity: "high", score: risk.score }),
          admin.from("bot_conversation_controls").upsert({ match_id: matchId, mode: "paused", pause_reason: `risk:${risk.category}`, updated_at: now }, { onConflict: "match_id" }),
        ]);
        if (safetyMessage) {
          await admin.from("matches").update({ last_message_at: safetyMessage.created_at }).eq("id", matchId);
          await sendPushToProfile(admin, memberId, { title: "Lovask", body: "Yeni bir mesajın var.", url: `/?open=chat&match=${matchId}`, tag: `match-${matchId}`, matchId }).catch(() => undefined);
        }
        await cancelJob(admin, id, "high_risk_review");
        return { id, riskReview: true };
      }
    }
    const [{ data: recent }, { data: memory }, { data: relationship }, dailyState] = await Promise.all([
      admin.from("messages").select("sender_id,body,transcript,kind").eq("match_id", matchId)
        .order("created_at", { ascending: false }).limit(20),
      admin.from("bot_conversation_memory").select("summary,facts").eq("match_id", matchId).maybeSingle(),
      admin.from("bot_relationship_state").select("stage,score").eq("match_id", matchId).maybeSingle(),
      settings.phase2_behavior_enabled && settings.daily_state_enabled ? loadDailyState(admin, botId) : Promise.resolve(null),
    ]);
    const history = (recent ?? []).toReversed().flatMap((item) => {
      const content = item.body ?? (item.transcript ? `[Sesli mesajın dökümü: ${item.transcript}]` : null);
      return content ? [{ role: item.sender_id === memberId ? "user" as const : "assistant" as const, content }] : [];
    });
    const context = [
      settings.phase2_behavior_enabled && memory?.summary ? `Bu konuşmaya ait hafıza özeti: ${memory.summary}` : "",
      settings.phase2_behavior_enabled && relationship?.stage ? `İlişki aşaması: ${relationship.stage}. Yakınlığı bu aşamaya uygun tut.` : settings.phase2_behavior_enabled ? "İlişki aşaması: new_match." : "",
      dailyState ? `Bugünkü durumun: enerji ${dailyState.energy}, müsaitlik ${dailyState.availability}, ruh hâli ${dailyState.mood}. Günlük bağlam: ${dailyState.context}` : "",
      jobType === "first_message" ? "Yeni eşleşmeye profilindeki karaktere uygun, özgün ve kısa bir ilk mesaj yaz. Sabit bir selamlama kalıbı kullanma." : "",
      jobType === "follow_up" ? "Karşı taraf son mesaja cevap vermedi. Önceki konuya bağlı, baskıcı olmayan tek bir kısa takip mesajı yaz." : "",
      settings.phase2_behavior_enabled ? buildConversationBehaviorContext(history, relationship?.stage ?? "new_match") : "",
    ].filter(Boolean).join("\n");
    const generated = await generateBotReply({
      admin, persona: `${persona.persona}\n\n${context}`, history, userId: memberId,
      closing: false,
      preferredProvider: persona.provider as AiProvider | "inherit", modelOverride: persona.model,
    });
    const { data: committed, error } = await admin.rpc("commit_bot_reply", { job_uuid: id, reply_body: generated.text, reply_provider: generated.provider, reply_model: generated.model });
    const commit = committed as { saved?: boolean; reason?: string; messageId?: string; createdAt?: string } | null;
    if (error) throw error;
    if (!commit?.saved) return { id, quotaReached: commit?.reason === "quota_reached", cancelled: true };
    const reply = { id: String(commit.messageId), created_at: String(commit.createdAt) };
    const [messageCount] = await Promise.all([
      settings.phase2_behavior_enabled ? updateRelationshipState(admin, matchId) : Promise.resolve(0),
    ]);
    if (jobType !== "follow_up") {
      await scheduleProactiveBotJob({ admin, matchId, botProfileId: botId, memberProfileId: memberId, jobType: "follow_up" });
    }
    if (settings.phase2_behavior_enabled && settings.memory_enabled && messageCount >= 8 && messageCount % 8 === 0) {
      await refreshConversationMemory(admin, { matchId, botId, memberId, existingSummary: memory?.summary ?? "", history, lastMessageId: reply.id }).catch(() => undefined);
    }
    await sendPushToProfile(admin, memberId, { title: "Lovask", body: "Yeni bir mesajın var.", url: `/?open=chat&match=${matchId}`, tag: `match-${matchId}`, matchId }).catch(() => undefined);
    return { id, sent: true, messageId: reply.id };
  } catch (error) {
    const attempts = Number(claimed.attempt_count ?? 0) + 1;
    const failed = attempts >= Number(claimed.max_attempts ?? 3);
    let fallbackSentAt = claimed.fallback_sent_at as string | null;
    if (settings.phase3_safety_enabled && jobType === "reply" && attempts === 1 && !fallbackSentAt) {
      fallbackSentAt = await sendFallbackMessage(admin, { matchId, botId, memberId });
    }
    const retrySeconds = randomBetween(15 * 60, 45 * 60);
    await admin.from("bot_reply_jobs").update({
      status: failed ? "failed" : "queued", attempt_count: attempts,
      scheduled_for: new Date(Date.now() + retrySeconds * 1000).toISOString(),
      typing_at: new Date(Date.now() + Math.max(1, retrySeconds - 8) * 1000).toISOString(),
      fallback_sent_at: fallbackSentAt,
      locked_at: null, last_error: error instanceof Error ? error.message.slice(0, 500) : "unknown_error", updated_at: new Date().toISOString(),
    }).eq("id", id);
    return { id, failed };
  }
}

async function sendFallbackMessage(admin: AdminClient, input: { matchId: string; botId: string; memberId: string }) {
  const { data: templates } = await admin.from("bot_fallback_templates").select("body").eq("is_active", true).or(`profile_id.eq.${input.botId},profile_id.is.null`);
  if (!templates?.length) return null;
  const body = templates[randomBetween(0, templates.length - 1)].body;
  const { data: message } = await admin.from("messages").insert({ match_id: input.matchId, sender_id: input.botId, kind: "text", body }).select("created_at").single();
  if (!message) return null;
  await admin.from("matches").update({ last_message_at: message.created_at }).eq("id", input.matchId);
  await sendPushToProfile(admin, input.memberId, { title: "Lovask", body: "Yeni bir mesajın var.", url: `/?open=chat&match=${input.matchId}`, tag: `match-${input.matchId}`, matchId: input.matchId }).catch(() => undefined);
  return message.created_at;
}

async function refreshConversationMemory(admin: AdminClient, input: { matchId: string; botId: string; memberId: string; existingSummary: string; history: { role: "user" | "assistant"; content: string }[]; lastMessageId: string }) {
  const result = await summarizeBotMemory({ history: input.history, existingSummary: input.existingSummary });
  if (!result) return;
  await admin.from("bot_conversation_memory").upsert({
    match_id: input.matchId, bot_profile_id: input.botId, member_profile_id: input.memberId,
    summary: result.summary, facts: result.facts, last_message_id: input.lastMessageId, updated_at: new Date().toISOString(),
  }, { onConflict: "match_id" });
}

async function loadDailyState(admin: AdminClient, botProfileId: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: existing } = await admin.from("bot_daily_states").select("energy,availability,mood,context").eq("bot_profile_id", botProfileId).eq("state_date", today).maybeSingle();
  if (existing) return existing;
  const choices = [
    { energy: "normal", availability: "relaxed", mood: "calm", context: "Günlük işlerini tamamlayıp sakin bir akşam geçiriyor." },
    { energy: "high", availability: "relaxed", mood: "cheerful", context: "Bugün keyfi yerinde ve sohbet etmeye açık." },
    { energy: "low", availability: "brief", mood: "thoughtful", context: "Yoğun bir günün ardından kısa ve sakin konuşuyor." },
    { energy: "normal", availability: "busy", mood: "calm", context: "Gün içinde işleri arasında fırsat buldukça telefona bakıyor." },
  ];
  const selected = choices[randomBetween(0, choices.length - 1)];
  await admin.from("bot_daily_states").upsert({ bot_profile_id: botProfileId, state_date: today, ...selected }, { onConflict: "bot_profile_id,state_date" });
  return selected;
}

async function updateRelationshipState(admin: AdminClient, matchId: string) {
  const { data: current } = await admin.from("bot_relationship_state").select("admin_override").eq("match_id", matchId).maybeSingle();
  if (current?.admin_override) {
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("match_id", matchId);
    return count ?? 0;
  }
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("match_id", matchId);
  const total = count ?? 0;
  const stage = total >= 80 ? "closer" : total >= 30 ? "comfortable" : total >= 8 ? "getting_to_know" : "new_match";
  await admin.from("bot_relationship_state").upsert({ match_id: matchId, stage, score: Math.min(100, total), updated_at: new Date().toISOString() }, { onConflict: "match_id", ignoreDuplicates: false });
  return total;
}

async function cancelJob(admin: AdminClient, id: string, reason: string) {
  await admin.from("bot_reply_jobs").update({ status: "cancelled", cancellation_reason: reason, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
}

export function botPresence(settings: AutomationSettings, now = new Date()) {
  if (!settings.automation_enabled) return { is_online: false, last_seen_at: null };
  if (settings.presence_override === "online") return { is_online: true, last_seen_at: now.toISOString() };
  if (settings.presence_override === "offline") return { is_online: false, last_seen_at: null };
  const online = isWithinSchedule(now, settings);
  return { is_online: online, last_seen_at: online ? now.toISOString() : null };
}

function isWithinSchedule(date: Date, settings: AutomationSettings) {
  const parts = zonedParts(date, settings.timezone);
  const minute = parts.hour * 60 + parts.minute;
  return (settings.weekly_schedule[String(parts.weekday)] ?? []).some(([start, end]) => minute >= toMinute(start) && minute <= toMinute(end));
}

function nextActiveDate(date: Date, settings: AutomationSettings) {
  if (settings.presence_override === "online" || isWithinSchedule(date, settings)) return date;
  if (settings.presence_override === "offline") return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  for (let offset = 1; offset <= 7 * 24 * 60; offset++) {
    const candidate = new Date(date.getTime() + offset * 60_000);
    if (isWithinSchedule(candidate, settings)) return candidate;
  }
  return date;
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdays[value("weekday")] ?? 0, hour: Number(value("hour")), minute: Number(value("minute")) };
}

function toMinute(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function randomBetween(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function stableBucket(value: string) { let hash = 0; for (let index = 0; index < value.length; index++) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0; return Math.abs(hash) % 100; }
