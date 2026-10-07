"use client";

import { useEffect, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import "../admin-page.css";
import "./deletions.css";

type Request = { profileId: string; name: string; requestedAt: string; scheduledFor: string; status: "pending" | "due" | "completed" | "cancelled"; attempts: number; lastError: string | null };
const LABELS: Record<Request["status"], string> = { pending: "Bekliyor", due: "Silinmeyi bekliyor", completed: "Silindi", cancelled: "Geri alındı" };
const FILTERS: [string, string][] = [["open", "Açık"], ["completed", "Silinenler"], ["cancelled", "Geri alınanlar"], ["all", "Tümü"]];
const date = (value: string) => new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default function DeletionsPage() {
  const [rows, setRows] = useState<Request[] | null>(null);
  const [status, setStatus] = useState("Yükleniyor…");
  const [filter, setFilter] = useState("open");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/deletions", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => ({})) })).then(({ ok, body }) => {
      if (cancelled) return;
      if (!ok) return setStatus(body.error ?? "Silme talepleri yüklenemedi.");
      setRows(body.requests ?? []); setStatus("");
    }).catch(() => { if (!cancelled) setStatus("Silme talepleri yüklenemedi."); });
    return () => { cancelled = true; };
  }, []);

  const visible = (rows ?? []).filter((row) => filter === "all" || (filter === "open" ? row.status === "pending" || row.status === "due" : row.status === filter));
  return (
    <main className="ops-stage">
      <AdminResourceNav />
      <section className="ops-content deletions-desk">
        <header><div><small>KVKK</small><h1>Hesap silme talepleri</h1><p>Üyeler hesabını silince 30 gün geri alma süresi başlar. Süre dolunca hesap ve verileri kalıcı olarak kaldırılır.</p></div></header>
        <div className="ops-segments" role="group" aria-label="Talep filtresi">{FILTERS.map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}<span>{visible.length} kayıt</span></div>
        {status ? <p className="deletions-status" role="status">{status}</p> : null}
        {rows && !visible.length ? <p className="deletions-status">Bu görünümde talep yok.</p> : null}
        <div className="deletions-list">
          {visible.map((row) => {
            const days = Math.ceil((new Date(row.scheduledFor).getTime() - now) / 86_400_000);
            return (
              <article key={`${row.profileId}-${row.requestedAt}`} className={`deletion-row ${row.status}`}>
                <div><strong>{row.name}</strong><small>Talep: {date(row.requestedAt)}</small></div>
                <div><span className="deletion-badge">{LABELS[row.status]}</span>{row.status === "pending" ? <small>{days > 0 ? `${days} gün sonra silinecek` : "Bugün silinecek"} · {date(row.scheduledFor)}</small> : row.status === "due" ? <small>Planlanan tarih: {date(row.scheduledFor)}</small> : null}</div>
                {row.lastError ? <p className="deletion-error">Son hata ({row.attempts} deneme): {row.lastError}</p> : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
