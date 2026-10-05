"use client";

import { useCallback, useEffect, useState } from "react";

type Event = {
  id: string;
  title: string;
  description: string;
  city: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: "published" | "cancelled";
  goingCount: number;
  attending: boolean;
};

export function CommunityEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Etkinlikler yüklenemedi.");
      setEvents(body.events ?? []);
      setNow(Date.now());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Etkinlikler yüklenemedi.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); const clock = window.setInterval(() => setNow(Date.now()), 60_000); return () => { window.clearTimeout(timer); window.clearInterval(clock); }; }, [load]);
  const respond = async (event: Event) => {
    setBusy(event.id);
    setError("");
    try {
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, attend: !event.attending }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Katılım kaydedilemedi.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Katılım kaydedilemedi.");
    } finally { setBusy(null); }
  };
  return <section className="community-events" aria-labelledby="community-events-title">
    <div className="community-events-head"><div><small>YÜZ YÜZE TANIŞMA</small><h2 id="community-events-title">Yaklaşan etkinlikler</h2></div><button type="button" onClick={() => void load()}>Yenile</button></div>
    {error ? <p role="alert">{error}</p> : null}
    {loading ? <p>Etkinlikler yükleniyor…</p> : null}
    {!loading && events.length === 0 ? <p>Şu anda planlanmış bir etkinlik yok. Yeni buluşmalar burada duyurulacak.</p> : null}
    <div className="community-event-list">{events.map((event) => <article key={event.id} className="community-event-card">
      <small>{new Date(event.starts_at).toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "short" })} · {event.city}</small>
      <h3>{event.title}</h3><p>{event.description}</p><span>{event.venue}</span>
      <footer><small>{event.status === "cancelled" ? "Etkinlik iptal edildi" : `${event.goingCount}/${event.capacity} katılımcı`}</small>
        {event.status === "published" ? <button type="button" disabled={busy === event.id || (!event.attending && (event.goingCount >= event.capacity || Date.parse(event.starts_at) <= now))} onClick={() => void respond(event)}>{event.attending ? "Katılımımı iptal et" : Date.parse(event.starts_at) <= now ? "Etkinlik başladı" : event.goingCount >= event.capacity ? "Kontenjan doldu" : "Katılacağım"}</button> : null}
      </footer>
    </article>)}</div>
  </section>;
}
