"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminRole } from "./admin-role-context";
import { communityRequest, type MeetingOption } from "./community";
import "./admin-community.css";

type CommunityData = { stories: { id: string; url?: string; profiles: { display_name: string }; expires_at: string }[]; options: MeetingOption[]; intents: { profile_id: string; option_id: string; profiles: { display_name: string }; expires_at: string }[] };
export function AdminCommunity() {
  const role = useAdminRole(); const [data, setData] = useState<CommunityData | null>(null); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await communityRequest("/api/admin/community")); } catch (e) { setNotice((e as Error).message); } }, []);
  useEffect(() => { const start = setTimeout(() => void load(), 0); return () => clearTimeout(start); }, [load]);
  const mutate = async (body: unknown) => { setBusy(true); setNotice(""); try { await communityRequest("/api/admin/community", "POST", body); await load(); setNotice("İşlem kaydedildi."); return true; } catch (e) { setNotice((e as Error).message); return false; } finally { setBusy(false); } };
  const remove = (action: string, id: string) => { const reason = window.prompt("Kaldırma nedeni (en az 3 karakter):"); if (reason) void mutate({ action, id, reason }); };
  return <section className="ops-content community-admin"><header><div><small>Ortak içerik yönetimi</small><h1>Hikayeler ve Buluşma</h1></div><button onClick={() => void load()}>Yenile</button></header>
    <p>Değişiklikler web ve Android uygulamasında geçerlidir. Son 200 aktif içerik gösterilir.</p><Link href="/admin/lovask-control/reports">Hikaye ve profil şikâyetlerini incele →</Link>
    {notice ? <p className="ops-notice" role="status">{notice}</p> : null}
    {!data ? <p>Veriler yükleniyor…</p> : <>
      <h2>Buluşma seçenekleri</h2>
      {role === "owner" ? <><div className="admin-meeting-options">{data.options.map((option) => <OptionForm key={`${option.id}-${option.label}-${option.active}-${option.sort_order}`} option={option} busy={busy} save={mutate}/>)}</div><h3>Yeni seçenek</h3><OptionForm busy={busy} save={mutate}/></> : <p>Seçenekleri yalnızca yönetici düzenleyebilir.</p>}
      <h2>Aktif hikayeler ({data.stories.length})</h2><div className="admin-story-grid">{data.stories.map((story) => <article key={story.id}>{story.url ? <a href={story.url} target="_blank" rel="noreferrer"><img src={story.url} alt={`${story.profiles?.display_name ?? "Üye"} hikayesi`}/></a> : <p>Görsel yüklenemedi.</p>}<strong>{story.profiles?.display_name ?? "Üye"}</strong><small>Bitiş: {new Date(story.expires_at).toLocaleString("tr-TR")}</small><button disabled={busy} onClick={() => remove("removeStory", story.id)}>Hikayeyi kaldır</button></article>)}</div>{data.stories.length === 0 ? <p>Aktif hikaye yok.</p> : null}
      <h2>Aktif buluşma planları ({data.intents.length})</h2>{data.intents.map((intent) => <div className="admin-intent" key={intent.profile_id}><strong>{intent.profiles?.display_name ?? "Üye"}</strong><span>{data.options.find((o) => o.id === intent.option_id)?.label}</span><small>{new Date(intent.expires_at).toLocaleString("tr-TR")}</small><button disabled={busy} onClick={() => remove("removeIntent", intent.profile_id)}>Planı kaldır</button></div>)}{data.intents.length === 0 ? <p>Aktif plan yok.</p> : null}
    </>}
  </section>;
}
function OptionForm({ option, busy, save }: { option?: MeetingOption; busy: boolean; save: (body: unknown) => Promise<boolean> }) {
  const [label, setLabel] = useState(option?.label ?? ""); const [icon, setIcon] = useState(option?.icon ?? "coffee"); const [active, setActive] = useState(option?.active ?? true); const [order, setOrder] = useState(option?.sort_order ?? 0);
  return <form className="admin-option-form" onSubmit={async (e) => { e.preventDefault(); if (await save({ action: "saveOption", ...(option ? { id: option.id } : {}), label, icon, active, sort_order: order }) && !option) setLabel(""); }}>
    <label>Plan adı<input value={label} onChange={(e) => setLabel(e.target.value)} minLength={2} maxLength={60} required/></label>
    <label>İkon<select value={icon} onChange={(e) => setIcon(e.target.value)}><option value="coffee">Kahve</option><option value="walk">Yürüyüş</option><option value="event">Etkinlik</option></select></label>
    <label>Sıra<input type="number" min={0} max={100} value={order} onChange={(e) => setOrder(Number(e.target.value))} required/></label>
    <label><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Aktif</label><button disabled={busy}>Kaydet</button>
  </form>;
}
