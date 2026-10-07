"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import "./profile-coach.css";

type Check = { key: string; label: string; ok: boolean; hint: string };
type Report = { score: number; checks: Check[]; tips: string[] | null; source: "ai" | "rules" };

export function ProfileCoach({ liveMode }: { liveMode: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!liveMode) return null;

  const run = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile/coach", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? "Analiz yapılamadı."); return; }
      setReport(body);
    } catch { setError("Bağlantı kurulamadı."); } finally { setBusy(false); }
  };

  return (
    <section className="profile-coach" aria-labelledby="profile-coach-title">
      <div className="profile-coach-head">
        <span><Sparkles size={18} /></span>
        <div><h2 id="profile-coach-title">Profil koçu</h2><p>Profilini tara, eksikleri gör ve eşleşme şansını artıracak öneriler al.</p></div>
        <button type="button" onClick={() => void run()} disabled={busy}>{busy ? "Bakılıyor…" : report ? "Yeniden analiz et" : "Profilimi analiz et"}</button>
      </div>
      {error ? <p className="profile-coach-error" role="alert">{error}</p> : null}
      {report ? <div className="profile-coach-body">
        <div className="profile-coach-score" role="img" aria-label={`Profil puanı ${report.score} / 100`}><strong>{report.score}</strong><span>/ 100</span><i style={{ width: `${report.score}%` }} /></div>
        <ul>{report.checks.map((check) => <li key={check.key} className={check.ok ? "ok" : ""}><b>{check.ok ? "✓" : "!"}</b><span><strong>{check.label}</strong><small>{check.hint}</small></span></li>)}</ul>
        {report.tips?.length ? <div className="profile-coach-tips"><h3>Kişisel öneriler</h3><ol>{report.tips.map((tip) => <li key={tip}>{tip}</li>)}</ol></div> : null}
        <small className="profile-coach-note">Biyografin ve soru yanıtların öneri üretmek için yapay zekâ sağlayıcısına gönderilir. Fotoğrafların analiz edilmez veya paylaşılmaz.</small>
      </div> : null}
    </section>
  );
}
