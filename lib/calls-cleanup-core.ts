import type { SupabaseClient } from "@supabase/supabase-js";

const RING_MS = 60_000;
const MAX_CALL_MS = 3 * 3_600_000;
const SIGNAL_TTL_MS = 24 * 3_600_000;

export type CallCleanupDeps = { sendPush: (profileId: string, payload: { title: string; body: string; url?: string; tag?: string }) => Promise<unknown> };

// Rings that nobody answered become missed calls, calls that never got hung up are closed,
// and old signaling messages are deleted so no call metadata lingers.
export async function cleanupCalls(admin: SupabaseClient, deps: CallCleanupDeps, now = new Date()) {
  const iso = now.toISOString();
  const { data: missed } = await admin.from("call_sessions").update({ status: "missed", ended_at: iso }).eq("status", "ringing").lt("created_at", new Date(now.getTime() - RING_MS).toISOString()).select("id,match_id,caller_id,callee_id,kind");
  for (const call of missed ?? []) {
    const { data: caller } = await admin.from("profiles").select("display_name").eq("id", call.caller_id).maybeSingle();
    await deps.sendPush(call.callee_id as string, { title: "Cevapsız arama", body: `${caller?.display_name ?? "Bir üye"} seni ${call.kind === "video" ? "görüntülü" : "sesli"} aradı.`, url: `/?open=chat&match=${call.match_id}`, tag: `missed-${call.id}` }).catch(() => undefined);
  }
  const { data: stale } = await admin.from("call_sessions").update({ status: "ended", ended_at: iso }).eq("status", "accepted").lt("answered_at", new Date(now.getTime() - MAX_CALL_MS).toISOString()).select("id");
  await admin.from("call_signals").delete().lt("created_at", new Date(now.getTime() - SIGNAL_TTL_MS).toISOString());
  return { missed: missed?.length ?? 0, closed: stale?.length ?? 0 };
}
