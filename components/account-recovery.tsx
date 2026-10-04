"use client";

import { useRouter } from "next/navigation";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function AccountRecovery({ scheduledFor }: { scheduledFor: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const restore = async () => {
    setBusy(true); setError("");
    const response = await fetch("/api/profile/account", { method: "POST" });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setError(body.error ?? "Hesap kurtarılamadı."); setBusy(false); return; }
    router.replace("/"); router.refresh();
  };
  return <main className="recovery-stage">
    <section className="recovery-card">
      <ShieldCheck size={32} aria-hidden="true" />
      <small>30 günlük güvenlik süresi</small>
      <h1>Hesabın hâlâ kurtarılabilir.</h1>
      <p>Profilin keşiften kaldırıldı. Verilerin <strong>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(scheduledFor))}</strong> tarihinden sonra kalıcı olarak silinecek.</p>
      <button onClick={() => void restore()} disabled={busy}><RotateCcw size={17}/>{busy ? "Kurtarılıyor…" : "Hesabımı kurtar"}</button>
      {error ? <p className="recovery-error" role="alert">{error}</p> : null}
    </section>
  </main>;
}
