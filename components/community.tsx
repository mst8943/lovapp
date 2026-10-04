"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee, Footprints, Ticket, Plus, Check, SlidersHorizontal, X, ChevronLeft, ChevronRight, Trash2, Flag, Sparkles, List, Wand2, Zap } from "lucide-react";
import type { Profile } from "@/lib/demo-data";
import { resolvePresence } from "@/lib/presence";
import { useDialog } from "@/lib/use-dialog";
import "./community.css";

type Story = { id: string; profileId: string; name: string; url: string; own: boolean; seen: boolean };
export type MeetingOption = { id: string; label: string; icon: string; active?: boolean; sort_order?: number };
const icons = { coffee: Coffee, walk: Footprints, event: Ticket };
export async function communityRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, cache: "no-store", ...(body instanceof FormData ? { body } : body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "İşlem tamamlanamadı.");
  return data;
}
export function DiscoveryHeader({ list, onSwitch, onFilter, onRitual, onBoost }: { list: boolean; onSwitch?: () => void; onFilter: () => void; onRitual?: () => void; onBoost?: () => void }) {
  return (
    <div className="discovery-compact-header">
      <div className="discovery-mode-pill" aria-label="Keşfet görünümü">
        <button
          type="button"
          aria-pressed={!list}
          className={!list ? "active" : ""}
          onClick={!list ? undefined : onSwitch}
        >
          <Sparkles size={16} fill={!list ? "#ffffff" : "none"} strokeWidth={!list ? 1.5 : 2} />
          <span>Kaydır</span>
        </button>
        <button
          type="button"
          aria-pressed={list}
          className={list ? "active" : ""}
          onClick={list ? undefined : onSwitch}
        >
          <List size={16} strokeWidth={2.2} />
          <span>Liste</span>
        </button>
      </div>
      <div className="discovery-header-actions">
        {onBoost ? <button type="button" className="discovery-boost" aria-label="Boost ayarlarına git" onClick={onBoost}><Zap size={18} fill="currentColor" /><span>Boost</span></button> : null}
        {onRitual ? (
          <button
            type="button"
            className="icon-button ritual-button-embossed"
            aria-label="Günün ritüeli"
            onClick={onRitual}
          >
            <Wand2 size={20} strokeWidth={2.2} />
          </button>
        ) : null}
        <button
          type="button"
          className="icon-button filter-button-embossed"
          aria-label="Keşfet tercihleri"
          onClick={onFilter}
        >
          <SlidersHorizontal size={20} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
export function StoryStrip({ live = true }: { live?: boolean }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState<Story[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try { const data = await communityRequest("/api/stories"); setStories(data.stories); setError(""); }
    catch { setError("Hikayeleri yenile"); }
  }, []);
  useEffect(() => {
    // The demo has no session; /api/stories would only answer 401.
    if (!live) return;
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    const focus = () => { void load(); }; window.addEventListener("focus", focus);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [live, load]);
  const own = stories.filter((s) => s.own);
  const groups = new Map<string, Story[]>();
  stories.filter((s) => !s.own).forEach((s) => groups.set(s.profileId, [...(groups.get(s.profileId) ?? []), s]));
  const tile = (group: Story[], mine: boolean) => <div className="story-tile" key={mine ? "own" : group[0].profileId}>
    <button type="button" aria-label={mine ? (group.length ? "Hikayem" : "Hikaye ekle") : `${group[0].name} hikayeleri`} onClick={() => group.length ? setOpened(group) : input.current?.click()}>
      <span className="story-photo">{group.length ? <img src={group[group.length - 1].url} alt=""/> : <Plus size={24}/>}</span>
      {group.length ? <svg className="story-ring" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id={`ring-${group[0].id}`}><stop stopColor="#ff479e"/><stop offset="1" stopColor="#8b3ee8"/></linearGradient></defs>{group.map((story, index) => <circle key={story.id} cx="32" cy="32" r="29" fill="none" stroke={story.seen ? "#bdaacd" : `url(#ring-${group[0].id})`} strokeWidth={story.seen ? 1.5 : 3.5} pathLength="100" strokeDasharray={group.length === 1 ? undefined : `${100 / group.length - 2} ${100 - 100 / group.length + 2}`} strokeDashoffset={-index * 100 / group.length} transform="rotate(-90 32 32)" strokeLinecap="round"/>)}</svg> : null}
    </button>
    {mine && group.length ? <button type="button" className="story-add" aria-label="Hikaye ekle" onClick={() => input.current?.click()}><Plus size={14}/></button> : null}
    <small>{mine ? (group.length ? "Hikayem" : "Hikayen +") : group[0].name}</small>
  </div>;
  return <><div className="story-strip" aria-label="Hikayeler">{tile(own, true)}{[...groups.values()].map((group) => tile(group, false))}{error ? <button type="button" onClick={() => void load()}>{error}</button> : null}</div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }}/>
    {file ? <StoryComposer file={file} onClose={() => setFile(null)} onSaved={() => { setFile(null); void load(); }}/> : null}
    {opened ? <StoryViewer stories={opened} onClose={() => { setOpened(null); void load(); }}/> : null}
  </>;
}
function StoryComposer({ file, onClose, onSaved }: { file: File; onClose: () => void; onSaved: () => void }) {
  const preview = useRef<HTMLImageElement>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const dialog = useDialog(() => { if (!busy) onClose(); });
  useEffect(() => { const url = URL.createObjectURL(file); if (preview.current) preview.current.src = url; return () => URL.revokeObjectURL(url); }, [file]);
  const share = async () => {
    setBusy(true); setError("");
    try { const body = new FormData(); body.set("photo", file); await communityRequest("/api/stories", "POST", body); onSaved(); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  };
  return <div className="community-overlay" role="dialog" aria-modal="true" aria-label="Yeni hikaye" ref={dialog} tabIndex={-1}><div className="story-dialog">
    <header><strong>Yeni hikaye</strong><button disabled={busy} onClick={onClose} aria-label="Kapat"><X/></button></header>
    <img ref={preview} className="story-preview" alt="Hikaye önizlemesi"/>
    <p>Hikayen 24 saat boyunca eşleşmelerin tarafından görüntülenebilir.</p>
    {error ? <p role="alert">{error}</p> : null}<button className="primary-button" disabled={busy} onClick={() => void share()}>{busy ? "Paylaşılıyor…" : "Hikayeyi paylaş"}</button>
  </div></div>;
}
function StoryViewer({ stories, onClose }: { stories: Story[]; onClose: () => void }) {
  const [index, setIndex] = useState(0); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const dialog = useDialog(onClose); const story = stories[index];
  const action = async (report: boolean) => {
    if (!window.confirm(report ? "Bu hikayeyi uygunsuz içerik olarak bildirmek istiyor musun?" : "Hikayeyi silmek istiyor musun?")) return;
    setBusy(true);
    try {
      await communityRequest(report ? "/api/safety" : "/api/stories", report ? "POST" : "DELETE", report ? { action: "report", targetProfileId: story.profileId, reason: "inappropriate_content", details: `Hikaye: ${story.id}`, block: false } : { id: story.id });
      if (report) { setError("Şikâyetin inceleme ekibine iletildi."); } else onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="community-overlay" role="dialog" aria-modal="true" aria-label={`${story.name} hikayesi`} ref={dialog} tabIndex={-1}><div className="story-dialog story-viewer">
    <div className="story-progress">{stories.map((s, i) => <span key={s.id} className={i <= index ? "active" : ""}/>)}</div>
    <header><strong>{story.name}</strong><button disabled={busy} onClick={() => void action(!story.own)} aria-label={story.own ? "Hikayeyi sil" : "Hikayeyi şikâyet et"}>{story.own ? <Trash2/> : <Flag/>}</button><button onClick={onClose} aria-label="Kapat"><X/></button></header>
    <img className="story-preview" key={story.id} src={story.url} alt={`${story.name} hikayesi`} onLoad={() => { void communityRequest("/api/stories", "PATCH", { id: story.id }).catch(() => undefined); }} onError={() => setError("Hikaye görüntülenemedi. Kapatıp yeniden dene.")}/>
    <footer><button disabled={index === 0} aria-label="Önceki hikaye" onClick={() => { setIndex(index - 1); setError(""); }}><ChevronLeft/></button><button aria-label="Sonraki hikaye" onClick={() => { if (index + 1 < stories.length) { setIndex(index + 1); setError(""); } else onClose(); }}><ChevronRight/></button></footer>
    {error ? <p role="status">{error}</p> : null}
  </div></div>;
}
export function MeetingView({ onSelect }: { onSelect: (profile: Profile) => void }) {
  const [data, setData] = useState<{ options: MeetingOption[]; selected: { option_id: string; expires_at: string } | null; profiles: Profile[] } | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await communityRequest("/api/meetings")); setError(""); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => { const start = setTimeout(() => void load(), 0); const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000); return () => { clearTimeout(start); clearInterval(timer); }; }, [load]);
  const choose = async (id?: string) => { setBusy(true); try { await communityRequest("/api/meetings", id ? "POST" : "DELETE", id ? { optionId: id } : undefined); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <section className="screen meeting-screen"><header><img src="/logo_l_extra_thick.png" alt="" width="44" height="44"/><h1>Buluşma</h1></header><h2>Bugün ne yapmak istersin?</h2><p>Bir plan seç. Aynı planı seçen uygun üyelerle tanış. Seçimin 24 saat geçerli.</p>
    {error ? <p role="alert">{error} <button onClick={() => void load()}>Yeniden dene</button></p> : null}
    {!data && !error ? <p role="status">Planlar yükleniyor…</p> : null}
    {data?.options.length === 0 ? <p>Şu anda açık bir buluşma planı yok.</p> : null}
    <div className="meeting-options">{data?.options.map((option) => { const Icon = icons[option.icon as keyof typeof icons] ?? Coffee; const selected = data.selected?.option_id === option.id; return <button type="button" key={option.id} disabled={busy} aria-pressed={selected} className={selected ? "active" : ""} onClick={() => void choose(option.id)}><Icon size={28}/><strong>{option.label}</strong>{selected ? <Check/> : <ChevronRight/>}</button>; })}</div>
    {data?.selected ? <><button className="meeting-cancel" disabled={busy} onClick={() => void choose()}>Planımı kaldır</button><h2>Aynı planı seçenler</h2>{data.profiles.length ? <div className="meeting-people">{data.profiles.map((p) => { const presence = resolvePresence({ id: p.id, isOnline: p.isOnline, lastSeenAt: p.lastSeenAt }); return <button key={p.id} onClick={() => onSelect(p)}><span style={{ position: "relative" }}><img src={p.image} alt=""/><i className={`status-dot ${presence.isOnline ? "online" : "offline"}`} style={{ position: "absolute", right: -2, bottom: -2, width: 11, height: 11, borderRadius: "50%", background: presence.isOnline ? "#22c55e" : "#94a3b8", border: "2px solid #141018" }}/></span><span><strong>{p.name}, {p.age}</strong><small>{p.city ?? p.distance} · <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: presence.isOnline ? "#22c55e" : "#94a3b8", marginRight: 4 }}/>{presence.text}</small></span><ChevronRight/></button>; })}</div> : <p className="meeting-empty">Henüz bu planı seçen uygun bir üye yok. Yeni katılımlar burada görünecek.</p>}</> : null}
  </section>;
}
