"use client";

import { useEffect, useRef, useState } from "react";

const prompts = ["Bir akşam yemeğine çıksak…", "Beni güldürmenin yolu…", "Benimle ilgili şaşıracağın şey…"];

export function VoiceBioEditor({ liveMode }: { liveMode: boolean }) {
  const [prompt, setPrompt] = useState(prompts[0]);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!liveMode) return;
    void fetch("/api/profile/voice", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (data.voice) { setPrompt(data.voice.prompt); setUrl(data.voice.audioUrl); }
    }).catch(() => undefined);
    return () => { if (timer.current) window.clearInterval(timer.current); stream.current?.getTracks().forEach((track) => track.stop()); };
  }, [liveMode]);

  const start = async () => {
    if (!liveMode || !("MediaRecorder" in window)) { setNotice("Bu tarayıcıda ses kaydı kullanılamıyor."); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        if (timer.current) window.clearInterval(timer.current);
        media.getTracks().forEach((track) => track.stop());
        const duration = Math.round((Date.now() - started.current) / 1000);
        setRecording(false);
        if (duration < 15) { setNotice("En az 15 saniye konuşmalısın."); return; }
        const file = new Blob(chunks, { type: next.mimeType || "audio/webm" });
        setBlob(file);
        setUrl(URL.createObjectURL(file));
        setSeconds(Math.min(duration, 30));
        setNotice("Kaydın hazır. Dinleyip kaydet.");
      };
      recorder.current = next;
      started.current = Date.now();
      setSeconds(0); setNotice(""); setRecording(true);
      next.start(500);
      timer.current = window.setInterval(() => { const elapsed = Math.floor((Date.now() - started.current) / 1000); setSeconds(elapsed); if (elapsed >= 30 && next.state === "recording") next.stop(); }, 250);
    } catch { setNotice("Mikrofon izni gerekli."); }
  };

  const save = async () => {
    if (!blob || seconds < 15 || seconds > 30) return;
    setBusy(true); setNotice("");
    const form = new FormData(); form.set("audio", blob, "bio"); form.set("prompt", prompt); form.set("durationMs", String(seconds * 1000));
    try {
      const response = await fetch("/api/profile/voice", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Kaydedilemedi.");
      setBlob(null); setNotice("Sesli biyografin yayınlandı.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Kaydedilemedi."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/profile/voice", { method: "DELETE" });
      if (!response.ok) throw new Error("Silinemedi.");
      setBlob(null); setUrl(null); setNotice("Sesli biyografi silindi.");
    } catch { setNotice("Sesli biyografi silinemedi."); }
    finally { setBusy(false); }
  };

  return <section className="voice-bio-editor"><h2>Sesli biyografi</h2><p>Bir soruyu sesinle yanıtla · 15–30 saniye</p>
    <div className="voice-bio-prompts" role="group" aria-label="Sesli biyografi sorusu">
      {prompts.map((item) => <button key={item} type="button" disabled={recording || busy} className={prompt === item ? "selected" : ""} aria-pressed={prompt === item} onClick={() => setPrompt(item)}>{item}</button>)}
    </div>
    {url ? <audio controls preload="none" src={url} aria-label="Sesli biyografin" /> : null}
    <div><button type="button" disabled={busy} onClick={() => recording ? recorder.current?.stop() : void start()}>{recording ? `Kaydı bitir · ${seconds} sn` : "Ses kaydet"}</button>{blob ? <button type="button" disabled={busy} onClick={() => void save()}>Yayınla</button> : null}{url && !blob ? <button type="button" disabled={busy} onClick={() => void remove()}>Sil</button> : null}</div>
    {notice ? <small role="status">{notice}</small> : null}
  </section>;
}
