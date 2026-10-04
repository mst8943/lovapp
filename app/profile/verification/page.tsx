"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type State = { verified: boolean; selfie: { status: string } | null; emailEnabled: boolean; smsEnabled: boolean; emailVerified: boolean; smsVerified: boolean };

export default function VerificationPage() {
  const [state, setState] = useState<State | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [selfie, contact] = await Promise.all([
      fetch("/api/profile/verification", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/profile/contact-verification", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setState({ ...selfie, ...contact });
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(() => setNote("Doğrulama durumu yüklenemedi.")), 0); return () => window.clearTimeout(timer); }, [load]);
  const upload = async (file: File) => {
    setBusy(true); setNote("");
    const form = new FormData(); form.set("selfie", file);
    const response = await fetch("/api/profile/verification", { method: "POST", body: form });
    const result = await response.json();
    setNote(response.ok ? "Selfie incelemeye gönderildi." : result.error ?? "Selfie gönderilemedi.");
    if (response.ok) await load();
    setBusy(false);
  };
  const contact = async (channel: "email" | "sms", action: "send" | "confirm") => {
    setBusy(true); setNote("");
    const response = await fetch("/api/profile/contact-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, action, code: action === "confirm" ? code : undefined }) });
    const result = await response.json();
    setNote(response.ok ? action === "send" ? "Kod gönderildi." : "İletişim bilgisi doğrulandı." : result.error ?? "İşlem tamamlanamadı.");
    if (response.ok && action === "confirm") await load();
    setBusy(false);
  };
  return <main style={{ maxWidth: 540, margin: "60px auto", padding: 24 }}>
    <Link href="/">← Profilime dön</Link><h1>Hesabını doğrula</h1>
    <p>Selfie yalnızca inceleme ekibi tarafından profil fotoğrafınla karşılaştırılır. Onaylanınca doğrulama rozeti görünür.</p>
    <section><h2>Selfie</h2><p>{state?.verified ? "Doğrulandı ✓" : state?.selfie?.status === "pending" ? "İncelemede" : state?.selfie?.status === "rejected" ? "Önceki istek reddedildi; yeniden gönderebilirsin." : "Henüz gönderilmedi"}</p>
      {!state?.verified && state?.selfie?.status !== "pending" ? <label>Selfie seç <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); }} /></label> : null}
    </section>
    {(["email", "sms"] as const).map((channel) => state?.[channel === "email" ? "emailEnabled" : "smsEnabled"] ? <section key={channel}><h2>{channel === "email" ? "E-posta" : "SMS"} doğrulama</h2><p>{state[channel === "email" ? "emailVerified" : "smsVerified"] ? "Doğrulandı ✓" : "Doğrulanmadı"}</p>{!state[channel === "email" ? "emailVerified" : "smsVerified"] ? <><button disabled={busy} onClick={() => void contact(channel, "send")}>Kod gönder</button><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} aria-label="Altı haneli kod" /><button disabled={busy || code.length !== 6} onClick={() => void contact(channel, "confirm")}>Kodu doğrula</button></> : null}</section> : null)}
    {note ? <p role="status">{note}</p> : null}
  </main>;
}
