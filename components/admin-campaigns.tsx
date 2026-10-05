"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";

type Campaign = { id: string; title: string; body: string; cta_label: string; cta_path: string; starts_at: string; ends_at: string; is_active: boolean; uniqueDailyClicks: number };
function localDate(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export function AdminCampaigns() {
  const role = useAdminRole();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { const response = await fetch("/api/admin/campaigns", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Kampanyalar yüklenemedi."); setCampaigns(body.campaigns ?? []); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Kampanyalar yüklenemedi."); }
  }, []);
  useEffect(() => { if (role !== "owner") return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load, role]);
  if (role !== "owner") return null;
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const payload = { ...(editing ? { id: editing.id } : {}), title: form.get("title"), body: form.get("body"), ctaLabel: form.get("ctaLabel"), ctaPath: form.get("ctaPath"), startsAt: new Date(String(form.get("startsAt"))).toISOString(), endsAt: new Date(String(form.get("endsAt"))).toISOString(), isActive: form.get("active") === "on" };
      const response = await fetch("/api/admin/campaigns", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Kampanya kaydedilemedi.");
      setEditing(null); formElement.reset(); await load(); setNotice("Kampanya kaydedildi.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Kampanya kaydedilemedi."); }
    finally { setBusy(false); }
  };
  return <section className="admin-campaigns" aria-labelledby="campaign-center-title">
    <header><div><small>ÜRÜN İÇİ DUYURU</small><h2 id="campaign-center-title">Kampanya merkezi</h2><p>Zamanlanmış kartı web ve Android keşfinde göster; günlük tekil tıklamaları izle.</p></div><button onClick={() => void load()}>Yenile</button></header>
    {notice ? <p role="status">{notice}</p> : null}
    <form key={editing?.id ?? "new"} onSubmit={(event) => void save(event)}>
      <h3>{editing ? "Kampanyayı düzenle" : "Yeni kampanya"}</h3>
      <label>Başlık<input name="title" required minLength={4} maxLength={100} defaultValue={editing?.title}/></label>
      <label>Mesaj<textarea name="body" required minLength={10} maxLength={280} defaultValue={editing?.body}/></label>
      <div><label>Düğme yazısı<input name="ctaLabel" required minLength={2} maxLength={40} defaultValue={editing?.cta_label ?? "İncele"}/></label><label>Site içi bağlantı<input name="ctaPath" required pattern="/[A-Za-z0-9/_?=&%.-]+" defaultValue={editing?.cta_path ?? "/noir"}/></label></div>
      <div><label>Başlangıç<input name="startsAt" type="datetime-local" required defaultValue={editing ? localDate(editing.starts_at) : undefined}/></label><label>Bitiş<input name="endsAt" type="datetime-local" required defaultValue={editing ? localDate(editing.ends_at) : undefined}/></label></div>
      <label><input name="active" type="checkbox" defaultChecked={editing?.is_active}/> Etkin</label>
      <button disabled={busy}>Kaydet</button>{editing ? <button type="button" onClick={() => setEditing(null)}>Vazgeç</button> : null}
    </form>
    <div className="admin-campaign-list">{campaigns.map((campaign) => <article key={campaign.id}><div><strong>{campaign.title}</strong><small>{campaign.is_active ? "Etkin" : "Kapalı"} · {new Date(campaign.starts_at).toLocaleDateString("tr-TR")}–{new Date(campaign.ends_at).toLocaleDateString("tr-TR")} · {campaign.uniqueDailyClicks} günlük tekil tıklama</small></div><button onClick={() => setEditing(campaign)}>Düzenle</button></article>)}</div>
  </section>;
}
