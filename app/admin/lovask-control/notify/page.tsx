"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import "../admin-page.css";
import "./notify.css";

const SEGMENTS: [string, string][] = [
  ["all", "Tüm üyeler"],
  ["noir_active", "Aktif Noir üyeleri"],
  ["noir_expiring", "Noir'u 7 gün içinde bitenler"],
  ["inactive_7", "7 gündür girmeyenler"],
  ["inactive_30", "30 gündür girmeyenler"],
  ["new_7", "Son 7 günde katılanlar"],
];

export default function NotifyPage() {
  const [segment, setSegment] = useState("inactive_7");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (mode: "preview" | "test" | "send") => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, segment, title, body, url, confirmCount: count ?? undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setNotice(data.error ?? "İşlem yapılamadı."); return; }
      if (mode === "preview") setCount(data.count); else setNotice(data.message ?? "Tamam.");
    } catch { setNotice("Bağlantı kurulamadı."); } finally { setBusy(false); }
  };
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "preview", segment, title: "x", body: "x" }) });
        const data = await response.json().catch(() => ({}));
        if (!cancelled) setCount(response.ok ? data.count : null);
      } catch { if (!cancelled) setCount(null); }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [segment]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (count === null) return setNotice("Önce alıcı sayısı hesaplanmalı.");
    if (!window.confirm(`"${title}" bildirimi ${count} kişiye gönderilsin mi? Bu işlem geri alınamaz.`)) return;
    await call("send");
  };
  const ready = title.trim() && body.trim();

  return (
    <main className="ops-stage">
      <AdminResourceNav />
      <section className="ops-content notify-desk">
        <header><div><small>Büyüme</small><h1>Bildirim gönder</h1><p>Hedef kitleyi seç, mesajı yaz, önce kendine test et, sonra gönder. Sessiz saatlerdeki üyelere bildirim sabah iletilir.</p></div></header>
        <div className="notify-grid">
          <form className="notify-card" onSubmit={send}>
            <label>Kime<select value={segment} onChange={(event) => { setSegment(event.target.value); setCount(null); }}>{SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className="notify-count" aria-live="polite">{count === null ? "Alıcı sayısı hesaplanıyor…" : `${count.toLocaleString("tr-TR")} alıcı`}</p>
            <label>Başlık<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} placeholder="Seni özledik" /><small>{title.length}/60</small></label>
            <label>Mesaj<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={160} rows={3} placeholder="Yeni eşleşmeler seni bekliyor." /><small>{body.length}/160</small></label>
            <label>Açılacak sayfa (isteğe bağlı)<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/noir" /></label>
            {notice ? <p className="notify-notice" role="status">{notice}</p> : null}
            <div className="notify-actions">
              <button type="button" className="notify-secondary" disabled={busy || !ready} onClick={() => void call("test")}>Bana test gönder</button>
              <button className="admin-primary" disabled={busy || !ready || !count}>Gönder</button>
            </div>
          </form>
          <aside className="notify-preview" aria-label="Bildirim önizlemesi">
            <small>Önizleme</small>
            <div className="notify-phone"><strong>{title || "Başlık"}</strong><span>{body || "Mesaj metni burada görünür."}</span></div>
            <p>Alıcıların cihazında bildirim izni açıksa iletilir. İzin vermeyenlere gönderilmez.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
