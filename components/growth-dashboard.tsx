"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, LoaderCircle, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { useAdminRole } from "@/components/admin-role-context";

type Data = {
  productFunnel: Array<{ event_name: string; total: number }>;
  totals: { views: number; applications: number; approved: number; activated: number; referralActivations: number; rewardDays: number; androidDownloads: number; androidOpens: number; androidRegistrations: number; androidGifts: number };
  campaigns: Array<{ id: string; name: string; slug: string; city: string | null; member_limit: number; members: number; applications: number; is_active: boolean }>;
  sources: Array<{ source: string; applications: number; approved: number; invited: number }>;
  codes: Array<{ id: string; code: string; kind: string; label: string | null; is_active: boolean; activations: number }>;
};

export function GrowthDashboard() {
  const role = useAdminRole();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ start: "", end: "", source: "" });
  const load = useCallback(async () => { setBusy(true); setNotice(""); try { const params = new URLSearchParams(); if (filters.start) params.set("start", filters.start); if (filters.end) params.set("end", filters.end); if (filters.source) params.set("source", filters.source); const response = await fetch(`/api/admin/growth?${params}`, { cache: "no-store" }); const body = await response.json().catch(() => ({})); if (response.ok) setData(body); else { setData(null); setNotice(body.error ?? "Büyüme verileri yüklenemedi."); } } catch { setData(null); setNotice("Büyüme verileri yüklenemedi."); } finally { setBusy(false); } }, [filters]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const createCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice(""); const values = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: values.get("code"), label: values.get("label"), kind: values.get("kind") }) });
    const body = await response.json().catch(() => ({})); if (response.ok) { event.currentTarget.reset(); await load(); } else { setNotice(body.error ?? "Kod oluşturulamadı."); setBusy(false); }
  };
  const toggle = async (id: string, isActive: boolean) => { setBusy(true); try { const response = await fetch("/api/admin/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive }) }); const body = await response.json().catch(() => ({})); if (!response.ok) { setNotice(body.error ?? "Kod güncellenemedi."); return; } await load(); } catch { setNotice("Kod güncellenemedi."); } finally { setBusy(false); } };
  const funnel = data ? [{ label: "Görüntüleme", value: data.totals.views }, { label: "Başvuru", value: data.totals.applications }, { label: "Onay", value: data.totals.approved }, { label: "Aktivasyon", value: data.totals.activated }] : [];
  return <section className="growth-desk">
    <header><div><small>Organik üye kazanımı</small><h1>Büyüme masası</h1><p>Kaynak, başvuru, aktivasyon ve ödül verileri tek yerde.</p></div><button type="button" onClick={() => void load()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <RefreshCw size={16}/>} Yenile</button></header>
    <form className="growth-filters" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); setFilters({ start: String(values.get("start") ?? ""), end: String(values.get("end") ?? ""), source: String(values.get("source") ?? "").trim() }); }}><label>Başlangıç <input name="start" type="date"/></label><label>Bitiş <input name="end" type="date"/></label><label>Kaynak <input name="source" maxLength={80} placeholder="Tüm kaynaklar"/></label><button disabled={busy}>Filtrele</button></form>
    {notice ? <p className="growth-notice" role="alert">{notice}</p> : null}
    {data ? <>
    {data ? <section className="growth-codes"><header><div><small>Android kampanyası · seçili dönem</small><h2>Uygulama edinimi</h2><p>İndirme başlatma APK bağlantısına istektir. İlk açılış anonim kurulum kimliğiyle tekildir; yeniden kurulum yeni sayılabilir.</p></div></header><div className="growth-funnel"><article><small>İndirme başlatma</small><strong>{data.totals.androidDownloads.toLocaleString("tr-TR")}</strong></article><article><small>Ölçülen ilk açılış</small><strong>{data.totals.androidOpens.toLocaleString("tr-TR")}</strong></article><article><small>Android kaydı</small><strong>{data.totals.androidRegistrations.toLocaleString("tr-TR")}</strong></article><article><small>3 gün Noir hediyesi</small><strong>{data.totals.androidGifts.toLocaleString("tr-TR")}</strong></article></div></section> : null}
    <div className="growth-funnel">{funnel.map((item, index) => <article key={item.label}><small>{item.label}</small><strong>{item.value.toLocaleString("tr-TR")}</strong>{index ? <span>{funnel[index - 1].value ? "%" + Math.round(item.value / funnel[index - 1].value * 100) : "%0"}</span> : <TrendingUp size={18}/>}</article>)}</div>
    <section className="growth-codes"><header><div><small>Son 30 gün</small><h2>Tanışma döngüsü</h2><p>Olay sayıları; beğeni ve mesaj sayıları kullanıcı sayısı değildir.</p></div></header><div className="growth-funnel">{([ ["signup_completed","Kayıt"], ["profile_completed","Profil"], ["like_sent","Beğeni"], ["match_created","Eşleşme"], ["first_message_sent","İlk mesaj"], ["reply_received","Yanıt"] ] as const).map(([key,label]) => <article key={key}><small>{label}</small><strong>{Number(data?.productFunnel?.find((item) => item.event_name === key)?.total ?? 0).toLocaleString("tr-TR")}</strong></article>)}</div></section>
    <section className="growth-codes"><header><div><small>Son 30 gün</small><h2>Güven ve güvenlik</h2><p>Başvurular ve işlemler olay olarak sayılır; tekil kişi sayısı değildir.</p></div></header><div className="growth-funnel">{([ ["photo_uploaded","Fotoğraf"], ["verification_started","Selfie başvurusu"], ["verification_passed","Selfie onayı"], ["block_created","Engelleme"], ["report_created","Şikâyet"] ] as const).map(([key,label]) => <article key={key}><small>{label}</small><strong>{Number(data?.productFunnel?.find((item) => item.event_name === key)?.total ?? 0).toLocaleString("tr-TR")}</strong></article>)}</div></section>
    <div className="growth-grid">
      <section><header><div><small>Kampanya</small><h2>Kurucu kontenjanı</h2></div></header>{data?.campaigns.map((campaign) => <article className="campaign-row" key={campaign.id}><div><strong>{campaign.name}</strong><small>{campaign.city} · {campaign.applications} başvuru</small></div><b>{campaign.members} / {campaign.member_limit}</b><progress max={campaign.member_limit} value={campaign.members}/></article>)}</section>
      <section><header><div><small>Atıf</small><h2>Başvuru kaynakları</h2></div></header><div className="source-table"><b>Kaynak</b><b>Başvuru</b><b>Onay</b>{data?.sources.map((source) => <span key={source.source} className="source-row"><span>{source.source}</span><span>{source.applications}</span><span>{source.approved}</span></span>)}</div></section>
    </div>
    <section className="growth-codes"><header><div><small>Davet altyapısı</small><h2>Kodlar</h2><p>{data?.totals.referralActivations ?? 0} referans aktivasyonu · toplam {data?.totals.rewardDays ?? 0} gün ödül</p></div>{role === "owner" ? <form onSubmit={createCode}><input name="code" required minLength={4} maxLength={32} pattern="[A-Za-z0-9-]+" placeholder="KOD" onInput={(event) => event.currentTarget.value = event.currentTarget.value.toUpperCase()}/><input name="label" required minLength={2} maxLength={120} placeholder="Kanal / kişi etiketi"/><select name="kind"><option value="community">Topluluk</option><option value="ambassador">Elçi</option><option value="campaign">Kampanya</option></select><button disabled={busy}><Plus size={15}/> Oluştur</button></form> : null}</header><div className="code-list">{data?.codes.map((code) => <article key={code.id}><button className="copy-code" type="button" onClick={() => void navigator.clipboard.writeText(location.origin + "/kurucu-uye?ref=" + code.code + "&utm_source=" + code.kind + "&utm_medium=referral&utm_campaign=kurucu200")}><Copy size={14}/><code>{code.code}</code></button><span>{code.label || code.kind}</span><b>{code.activations} aktivasyon</b>{role === "owner" ? <button className={code.is_active ? "active" : ""} type="button" disabled={busy} onClick={() => void toggle(code.id, !code.is_active)}>{code.is_active ? "Aktif" : "Kapalı"}</button> : <em>{code.is_active ? "Aktif" : "Kapalı"}</em>}</article>)}</div></section>
    </> : null}
  </section>;
}
