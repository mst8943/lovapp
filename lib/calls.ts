export const RING_SECONDS = 45;
export const RING_GRACE_SECONDS = 60;
export const MAX_CALL_HOURS = 3;
export const MIN_MESSAGES_TOTAL = 6;
export const MAX_CALLS_PER_HOUR = 10;
export const MAX_SIGNALS_PER_CALL = 300;
export const MAX_SIGNAL_BYTES = 16_000;

export type CallKind = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "cancelled" | "missed" | "ended";
export type CallSession = { id: string; match_id: string; caller_id: string; callee_id: string; kind: CallKind; status: CallStatus; created_at: string; answered_at: string | null; ended_at: string | null };
export type CallSignalKind = "offer" | "answer" | "ice";

export function isRingingFresh(session: Pick<CallSession, "status" | "created_at">, now = Date.now()) {
  return session.status === "ringing" && now - Date.parse(session.created_at) <= RING_GRACE_SECONDS * 1000;
}

// Both members must have chatted before they can call: enough messages overall and at least one from each side.
export function hasChatFoundation(counts: { fromCaller: number; fromCallee: number }) {
  return counts.fromCaller >= 1 && counts.fromCallee >= 1 && counts.fromCaller + counts.fromCallee >= MIN_MESSAGES_TOTAL;
}
