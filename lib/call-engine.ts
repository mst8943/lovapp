// Browser-side WebRTC call logic. It knows nothing about the app or the server: signaling goes through
// the injected sendSignal, and incoming signals are pushed in with handleSignal, in order.

export type CallRole = "caller" | "callee";
export type CallMedia = "audio" | "video";
export type CallPhase = "preparing" | "waiting" | "connecting" | "connected" | "reconnecting" | "ended" | "failed";
export type SignalKind = "offer" | "answer" | "ice";

export type CallEngineOptions = {
  role: CallRole;
  media: CallMedia;
  iceServers: RTCIceServer[];
  sendSignal: (kind: SignalKind, payload: Record<string, unknown>) => Promise<void>;
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onPhase: (phase: CallPhase, detail?: string) => void;
};

const messageFor = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Mikrofon veya kamera izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Mikrofon veya kamera bulunamadı.";
  if (name === "NotReadableError") return "Mikrofon veya kamera başka bir uygulama tarafından kullanılıyor.";
  return "Arama başlatılamadı.";
};

export class CallEngine {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteReady = false;
  private closed = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: CallEngineOptions) {}

  async start() {
    const { role, media, iceServers, onLocalStream, onRemoteStream } = this.options;
    this.options.onPhase("preparing");
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: media === "video" ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
      });
    } catch (error) {
      this.fail(messageFor(error));
      return false;
    }
    if (this.closed) { this.stopLocal(); return false; }
    onLocalStream(this.local);
    const pc = new RTCPeerConnection({ iceServers });
    this.pc = pc;
    for (const track of this.local.getTracks()) pc.addTrack(track, this.local);
    const remote = new MediaStream();
    pc.ontrack = (event) => { for (const track of event.streams[0]?.getTracks() ?? [event.track]) if (!remote.getTracks().includes(track)) remote.addTrack(track); onRemoteStream(remote); };
    pc.onicecandidate = (event) => { if (event.candidate) void this.options.sendSignal("ice", event.candidate.toJSON() as Record<string, unknown>).catch(() => undefined); };
    pc.onconnectionstatechange = () => this.onConnectionState();
    this.options.onPhase(role === "caller" ? "waiting" : "connecting");
    if (role === "caller") {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.options.sendSignal("offer", { type: offer.type, sdp: offer.sdp });
      } catch { this.fail("Arama başlatılamadı."); return false; }
    }
    return true;
  }

  // Incoming signals are applied strictly one after another.
  handleSignal(kind: SignalKind, payload: Record<string, unknown>) {
    this.queue = this.queue.then(() => this.apply(kind, payload)).catch(() => undefined);
    return this.queue;
  }

  private async apply(kind: SignalKind, payload: Record<string, unknown>) {
    const pc = this.pc;
    if (!pc || this.closed) return;
    if (kind === "ice") {
      if (this.remoteReady) await pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => undefined);
      else this.pendingIce.push(payload as RTCIceCandidateInit);
      return;
    }
    if (kind === "offer" && this.options.role === "callee") {
      await pc.setRemoteDescription({ type: "offer", sdp: String(payload.sdp ?? "") });
      await this.flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.options.onPhase("connecting");
      await this.options.sendSignal("answer", { type: answer.type, sdp: answer.sdp });
    } else if (kind === "answer" && this.options.role === "caller") {
      await pc.setRemoteDescription({ type: "answer", sdp: String(payload.sdp ?? "") });
      await this.flushIce();
      this.options.onPhase("connecting");
    }
  }

  private async flushIce() {
    this.remoteReady = true;
    for (const candidate of this.pendingIce.splice(0)) await this.pc?.addIceCandidate(candidate).catch(() => undefined);
  }

  private onConnectionState() {
    const state = this.pc?.connectionState;
    if (this.closed || !state) return;
    if (state === "connected") { if (this.disconnectTimer) clearTimeout(this.disconnectTimer); this.disconnectTimer = null; this.options.onPhase("connected"); }
    else if (state === "disconnected") {
      this.options.onPhase("reconnecting");
      this.disconnectTimer ??= setTimeout(() => { if (this.pc?.connectionState !== "connected") this.fail("Bağlantı koptu."); }, 12_000);
    } else if (state === "failed") this.fail("Bağlantı kurulamadı. Ağ ayarların doğrudan bağlantıya izin vermiyor olabilir.");
  }

  setMuted(muted: boolean) { for (const track of this.local?.getAudioTracks() ?? []) track.enabled = !muted; }
  setCameraOff(off: boolean) { for (const track of this.local?.getVideoTracks() ?? []) track.enabled = !off; }

  private fail(detail: string) {
    if (this.closed) return;
    this.close();
    this.options.onPhase("failed", detail);
  }

  private stopLocal() { for (const track of this.local?.getTracks() ?? []) track.stop(); this.local = null; }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.stopLocal();
    this.pc?.close();
    this.pc = null;
  }
}
