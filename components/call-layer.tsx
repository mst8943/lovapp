"use client";

import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CallEngine, type CallPhase, type SignalKind } from "@/lib/call-engine";
import type { CallKind, CallStatus } from "@/lib/calls";
import "./call-layer.css";

type StartDetail = { matchId: string; peerName: string; kind: CallKind };
type View =
  | { stage: "idle" }
  | { stage: "incoming"; id: string; peerName: string; kind: CallKind }
  | { stage: "call"; id: string; role: "caller" | "callee"; kind: CallKind; peerName: string; phase: CallPhase; detail?: string; connectedAt?: number }
  | { stage: "notice"; text: string };

type SessionPayload = { session: { id: string; status: CallStatus; kind: CallKind; created_at: string }; role: "caller" | "callee"; peerName: string; signals: { id: number; kind: SignalKind; payload: Record<string, unknown> }[] };

const PHASE_TEXT: Record<CallPhase, string> = { preparing: "Hazırlanıyor…", waiting: "Aranıyor…", connecting: "Bağlanıyor…", connected: "", reconnecting: "Bağlantı koptu, yeniden deneniyor…", ended: "Arama sona erdi", failed: "Arama kurulamadı" };
const END_TEXT: Partial<Record<CallStatus, string>> = { declined: "Arama reddedildi.", missed: "Cevap verilmedi.", cancelled: "Arama iptal edildi.", ended: "Arama sona erdi." };

const api = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) };
};

export function CallLayer() {
  const [view, setView] = useState<View>({ stage: "idle" });
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const viewRef = useRef<View>(view);
  const engine = useRef<CallEngine | null>(null);
  const seenSignals = useRef(new Set<number>());
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const streams = useRef<{ local: MediaStream | null; remote: MediaStream | null }>({ local: null, remote: null });

  const show = useCallback((next: View) => { viewRef.current = next; setView(next); }, []);
  const attach = useCallback(() => {
    if (localVideo.current && streams.current.local) localVideo.current.srcObject = streams.current.local;
    if (remoteVideo.current && streams.current.remote) remoteVideo.current.srcObject = streams.current.remote;
    if (remoteAudio.current && streams.current.remote) remoteAudio.current.srcObject = streams.current.remote;
  }, []);

  const cleanup = useCallback(() => {
    if (poll.current) clearInterval(poll.current);
    if (ringTimeout.current) clearTimeout(ringTimeout.current);
    poll.current = null; ringTimeout.current = null;
    engine.current?.close(); engine.current = null;
    streams.current = { local: null, remote: null };
    seenSignals.current.clear();
    setMuted(false); setCameraOff(false);
  }, []);

  const finish = useCallback((text?: string) => {
    cleanup();
    if (text) { show({ stage: "notice", text }); window.setTimeout(() => { if (viewRef.current.stage === "notice") show({ stage: "idle" }); }, 4000); }
    else show({ stage: "idle" });
  }, [cleanup, show]);

  const pull = useCallback(async (id: string) => {
    const { ok, body } = await api(`/api/calls/${id}`);
    if (!ok) return;
    const data = body as SessionPayload;
    const current = viewRef.current;
    if (current.stage === "incoming" && current.id === id && data.session.status !== "ringing") { finish(); return; }
    if (current.stage !== "call" || current.id !== id) return;
    for (const signal of data.signals) {
      if (seenSignals.current.has(signal.id)) continue;
      seenSignals.current.add(signal.id);
      void engine.current?.handleSignal(signal.kind, signal.payload);
    }
    if (["declined", "missed", "cancelled", "ended"].includes(data.session.status)) finish(END_TEXT[data.session.status]);
  }, [finish]);

  const beginCall = useCallback(async (id: string, role: "caller" | "callee", kind: CallKind, peerName: string) => {
    show({ stage: "call", id, role, kind, peerName, phase: "preparing" });
    const ice = await api("/api/calls/ice");
    const callEngine = new CallEngine({
      role, media: kind, iceServers: ice.ok ? ice.body.iceServers : [{ urls: ["stun:stun.l.google.com:19302"] }],
      sendSignal: async (signalKind, payload) => { await api(`/api/calls/${id}/signal`, { method: "POST", body: JSON.stringify({ kind: signalKind, payload }) }); },
      onLocalStream: (stream) => { streams.current.local = stream; attach(); },
      onRemoteStream: (stream) => { streams.current.remote = stream; attach(); },
      onPhase: (phase, detail) => {
        const current = viewRef.current;
        if (current.stage !== "call" || current.id !== id) return;
        if (phase === "failed") { void api(`/api/calls/${id}`, { method: "PATCH", body: JSON.stringify({ action: "end" }) }); finish(detail ?? "Arama kurulamadı."); return; }
        show({ ...current, phase, detail, connectedAt: phase === "connected" ? current.connectedAt ?? Date.now() : current.connectedAt });
      },
    });
    engine.current = callEngine;
    const started = await callEngine.start();
    if (!started) return;
    poll.current = setInterval(() => void pull(id), 2000);
    if (role === "caller") ringTimeout.current = setTimeout(() => { const current = viewRef.current; if (current.stage === "call" && current.id === id && current.phase !== "connected" && current.phase !== "connecting") { void api(`/api/calls/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }); finish("Cevap verilmedi."); } }, 47_000);
    void pull(id);
  }, [attach, finish, pull, show]);

  const startOutgoing = useCallback(async (detail: StartDetail) => {
    if (viewRef.current.stage === "call" || viewRef.current.stage === "incoming") return;
    show({ stage: "call", id: "", role: "caller", kind: detail.kind, peerName: detail.peerName, phase: "preparing" });
    const { ok, body } = await api("/api/calls", { method: "POST", body: JSON.stringify({ matchId: detail.matchId, kind: detail.kind }) });
    if (!ok) { finish(body.error ?? "Arama başlatılamadı."); return; }
    await beginCall(body.id, "caller", detail.kind, detail.peerName);
  }, [beginCall, finish, show]);

  const accept = async () => {
    const current = viewRef.current;
    if (current.stage !== "incoming") return;
    const { ok, body } = await api(`/api/calls/${current.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) });
    if (!ok) { finish(body.error ?? "Arama sona erdi."); return; }
    await beginCall(current.id, "callee", current.kind, current.peerName);
  };
  const decline = async () => {
    const current = viewRef.current;
    if (current.stage !== "incoming") return;
    await api(`/api/calls/${current.id}`, { method: "PATCH", body: JSON.stringify({ action: "decline" }) });
    finish();
  };
  const hangUp = async () => {
    const current = viewRef.current;
    if (current.stage !== "call") return;
    if (current.id) await api(`/api/calls/${current.id}`, { method: "PATCH", body: JSON.stringify({ action: current.role === "caller" && current.phase !== "connected" ? "cancel" : "end" }) });
    finish();
  };

  // Chat screens ask for a call through a window event, so the call layer stays independent of them.
  useEffect(() => {
    const onStart = (event: Event) => void startOutgoing((event as CustomEvent<StartDetail>).detail);
    window.addEventListener("lovask:start-call", onStart);
    return () => window.removeEventListener("lovask:start-call", onStart);
  }, [startOutgoing]);

  // Incoming calls: realtime for speed, a light poll as the safety net (also covers opening the app from a push).
  const checkIncoming = useCallback(async () => {
    if (viewRef.current.stage !== "idle" || document.visibilityState !== "visible") return;
    const { ok, body } = await api("/api/calls");
    const incoming = ok ? body.incoming : null;
    if (incoming && viewRef.current.stage === "idle") show({ stage: "incoming", id: incoming.id, peerName: incoming.callerName, kind: incoming.kind });
  }, [show]);
  useEffect(() => {
    let disposed = false; let disconnect: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase || disposed) return;
      const channel = supabase.channel("lovask-calls")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_sessions" }, () => void checkIncoming())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_sessions" }, (payload) => { const row = payload.new as { id: string }; const current = viewRef.current; if ((current.stage === "call" || current.stage === "incoming") && current.id === row.id) void pull(row.id); })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals" }, (payload) => { const row = payload.new as { session_id: string }; const current = viewRef.current; if (current.stage === "call" && current.id === row.session_id) void pull(row.session_id); })
        .subscribe();
      disconnect = () => { void supabase.removeChannel(channel); };
    });
    const timer = setInterval(() => void checkIncoming(), 8000);
    const onVisible = () => void checkIncoming();
    document.addEventListener("visibilitychange", onVisible);
    const first = window.setTimeout(() => void checkIncoming(), 1500);
    return () => { disposed = true; disconnect?.(); clearInterval(timer); clearTimeout(first); document.removeEventListener("visibilitychange", onVisible); };
  }, [checkIncoming, pull]);
  useEffect(() => () => cleanup(), [cleanup]);
  // While a call rings, keep checking that the caller has not hung up (covers a missed realtime event).
  const incomingId = view.stage === "incoming" ? view.id : null;
  useEffect(() => {
    if (!incomingId) return;
    const timer = setInterval(() => void pull(incomingId), 2000);
    return () => clearInterval(timer);
  }, [incomingId, pull]);

  // A running clock for connected calls, and a ringtone while a call rings.
  useEffect(() => {
    if (view.stage !== "call" || view.phase !== "connected") return;
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view]);
  useEffect(() => { attach(); }, [view, attach]);
  const ringing = view.stage === "incoming" || (view.stage === "call" && view.phase === "waiting");
  useEffect(() => {
    if (!ringing) return;
    let context: AudioContext | null = null; let timer: ReturnType<typeof setInterval> | null = null;
    try {
      context = new AudioContext();
      const beep = () => { if (!context) return; const osc = context.createOscillator(); const gain = context.createGain(); osc.frequency.value = view.stage === "incoming" ? 523 : 440; gain.gain.value = 0.06; osc.connect(gain).connect(context.destination); osc.start(); osc.stop(context.currentTime + 0.35); };
      beep(); timer = setInterval(beep, 1800);
      if (view.stage === "incoming") navigator.vibrate?.([300, 200, 300]);
    } catch { /* Audio can be blocked until the first interaction; ringing then stays silent. */ }
    return () => { if (timer) clearInterval(timer); void context?.close(); };
  }, [ringing, view.stage]);

  if (view.stage === "idle") return null;
  if (view.stage === "notice") return <div className="call-notice" role="status">{view.text}</div>;
  if (view.stage === "incoming") return (
    <div className="call-overlay incoming" role="alertdialog" aria-label="Gelen arama">
      <div className="call-card">
        <span className="call-avatar" aria-hidden="true">{view.kind === "video" ? <Video size={30} /> : <Phone size={30} />}</span>
        <small>{view.kind === "video" ? "Görüntülü arama" : "Sesli arama"}</small>
        <h2>{view.peerName}</h2>
        <p>seni arıyor</p>
        <div className="call-actions"><button type="button" className="call-btn decline" onClick={() => void decline()} aria-label="Reddet"><PhoneOff size={24} /></button><button type="button" className="call-btn accept" onClick={() => void accept()} aria-label="Cevapla">{view.kind === "video" ? <Video size={24} /> : <Phone size={24} />}</button></div>
      </div>
    </div>
  );
  const seconds = view.connectedAt ? Math.max(0, Math.floor((clockNow - view.connectedAt) / 1000)) : 0;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className={`call-overlay active ${view.kind}`} role="dialog" aria-label="Arama">
      <audio ref={remoteAudio} autoPlay playsInline />
      {view.kind === "video" ? <video ref={remoteVideo} className="call-remote" autoPlay playsInline /> : null}
      <div className="call-status"><strong>{view.peerName}</strong><span aria-live="polite">{view.phase === "connected" ? clock : view.detail ?? PHASE_TEXT[view.phase]}</span><small>Aramalar kaydedilmez.</small></div>
      {view.kind === "video" ? <video ref={localVideo} className={`call-local${cameraOff ? " off" : ""}`} autoPlay muted playsInline /> : null}
      <div className="call-actions">
        <button type="button" className={`call-btn${muted ? " on" : ""}`} aria-pressed={muted} aria-label={muted ? "Mikrofonu aç" : "Sessize al"} onClick={() => { engine.current?.setMuted(!muted); setMuted(!muted); }}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</button>
        {view.kind === "video" ? <button type="button" className={`call-btn${cameraOff ? " on" : ""}`} aria-pressed={cameraOff} aria-label={cameraOff ? "Kamerayı aç" : "Kamerayı kapat"} onClick={() => { engine.current?.setCameraOff(!cameraOff); setCameraOff(!cameraOff); }}>{cameraOff ? <VideoOff size={22} /> : <Video size={22} />}</button> : null}
        <button type="button" className="call-btn decline" aria-label="Aramayı bitir" onClick={() => void hangUp()}><PhoneOff size={24} /></button>
      </div>
    </div>
  );
}
