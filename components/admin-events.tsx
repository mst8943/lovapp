"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";

type EventRow = {
  id: string; title: string; description: string; city: string; venue: string;
  starts_at: string; ends_at: string; capacity: number;
  status: "draft" | "published" | "cancelled";
};

function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AdminEvents() {
  const role = useAdminRole();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Etkinlikler yüklenemedi.");
      setEvents(body.events ?? []);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Etkinlikler yüklenemedi."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""),
        city: String(form.get("city") ?? ""), venue: String(form.get("venue") ?? ""),
        startsAt: new Date(String(form.get("startsAt"))).toISOString(),
        endsAt: new Date(String(form.get("endsAt"))).toISOString(),
        capacity: Number(form.get("capacity")), status: String(form.get("status")),
      };
      const response = await fetch("/api/admin/events", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Etkinlik kaydedilemedi.");
      setEditing(null); formElement.reset(); await load(); setNotice("Etkinlik kaydedildi.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Etkinlik kaydedilemedi."); }
    finally { setBusy(false); }
  };
  const cancel = async (row: EventRow) => {
    if (!window.confirm(`${row.title} etkinliğini iptal etmek istiyor musunuz? Katılımcılar iptal durumunu görecek.`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, title: row.title, description: row.description, city: row.city, venue: row.venue, startsAt: row.starts_at, endsAt: row.ends_at, capacity: row.capacity, status: "cancelled" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Etkinlik iptal edilemedi.");
      await load(); setNotice("Etkinlik iptal edildi.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Etkinlik iptal edilemedi."); }
    finally { setBusy(false); }
  };
  return <section className="admin-events" aria-labelledby="admin-events-title">
    <header><div><small>TOPLULUK TAKVİMİ</small><h2 id="admin-events-title">Etkinlikler</h2><p>Yayımlanan etkinlikler web ve Android Buluşma alanında görünür.</p></div><button type="button" onClick={() => void load()}>Yenile</button></header>
    {notice ? <p role="status">{notice}</p> : null}
    {role === "owner" ? <form key={editing?.id ?? "new"} onSubmit={(event) => void save(event)}>
      <h3>{editing ? "Etkinliği düzenle" : "Yeni etkinlik"}</h3>
      <label>Başlık<input name="title" required minLength={4} maxLength={100} defaultValue={editing?.title}/></label>
      <label>Açıklama<textarea name="description" required minLength={10} maxLength={1000} defaultValue={editing?.description}/></label>
      <div><label>Şehir<input name="city" required maxLength={80} defaultValue={editing?.city}/></label><label>Mekân<input name="venue" required maxLength={160} defaultValue={editing?.venue}/></label></div>
      <div><label>Başlangıç<input name="startsAt" type="datetime-local" required defaultValue={editing ? localDate(editing.starts_at) : undefined}/></label><label>Bitiş<input name="endsAt" type="datetime-local" required defaultValue={editing ? localDate(editing.ends_at) : undefined}/></label></div>
      <div><label>Kontenjan<input name="capacity" type="number" min={2} max={500} required defaultValue={editing?.capacity ?? 20}/></label><label>Durum<select name="status" defaultValue={editing?.status === "published" ? "published" : "draft"}><option value="draft">Taslak</option><option value="published">Yayımla</option></select></label></div>
      <button disabled={busy}>Kaydet</button>{editing ? <button type="button" onClick={() => setEditing(null)}>Vazgeç</button> : null}
    </form> : null}
    <div className="admin-events-list">{events.map((row) => <article key={row.id}>
      <div><strong>{row.title}</strong><small>{new Date(row.starts_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} · {row.city} · {row.capacity} kişilik · {row.status === "published" ? "Yayında" : row.status === "cancelled" ? "İptal" : "Taslak"}</small></div>
      {role === "owner" && row.status !== "cancelled" ? <div><button type="button" disabled={busy} onClick={() => setEditing(row)}>Düzenle</button><button type="button" disabled={busy} onClick={() => void cancel(row)}>İptal et</button></div> : null}
    </article>)}</div>
  </section>;
}
