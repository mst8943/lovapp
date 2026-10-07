"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import "../admin-page.css";
import "./audit.css";

type Entry = { id: number; actor: string; action: string; target_type: string; target_id: string | null; metadata: Record<string, unknown>; created_at: string };

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("Yükleniyor…");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async (q: string, before?: number) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (before) params.set("before", String(before));
      const response = await fetch(`/api/admin/audit?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus(body.error ?? "İşlem günlüğü yüklenemedi.");
      setEntries((current) => (before ? [...current, ...body.entries] : body.entries));
      setHasMore(Boolean(body.hasMore));
      setStatus(body.entries.length || before ? "" : "Kayıt bulunamadı.");
    } catch { setStatus("İşlem günlüğü yüklenemedi. Bağlantını kontrol et."); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(applied), 0); return () => window.clearTimeout(timer); }, [applied, load]);

  return (
    <main className="ops-stage">
      <AdminResourceNav />
      <section className="ops-content audit-desk">
        <header>
          <div><small>Güvenlik</small><h1>İşlem günlüğü</h1><p>Yöneticilerin yaptığı hassas işlemler değiştirilemez şekilde kaydedilir: kim, ne zaman, neyi yaptı.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); setStatus("Yükleniyor…"); setApplied(query.trim()); }}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İşlem ara (ör. conversation, export)" aria-label="İşlem ara" />
            <button className="admin-primary">Ara</button>
          </form>
        </header>
        {status ? <p className="audit-status" role="status">{status}</p> : null}
        <div className="audit-list">
          {entries.map((entry) => (
            <article key={entry.id} className={open === entry.id ? "audit-row open" : "audit-row"}>
              <button type="button" onClick={() => setOpen(open === entry.id ? null : entry.id)} aria-expanded={open === entry.id}>
                <time>{new Date(entry.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "medium" })}</time>
                <strong>{entry.action}</strong>
                <span>{entry.actor}</span>
                <small>{entry.target_type}{entry.target_id ? ` · ${entry.target_id.slice(0, 8)}` : ""}</small>
              </button>
              {open === entry.id ? <pre>{JSON.stringify(entry.metadata, null, 2)}</pre> : null}
            </article>
          ))}
        </div>
        {hasMore ? <button className="audit-more" onClick={() => void load(applied, entries.at(-1)?.id)}>Daha fazla yükle</button> : null}
      </section>
    </main>
  );
}
