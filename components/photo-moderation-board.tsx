"use client";

import Image from "next/image";
import { Check, ChevronRight, ExternalLink, ImageOff, LoaderCircle, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import "./photo-moderation.css";

type PhotoStatus = "pending" | "approved" | "rejected";
type Photo = {
  id: string;
  profile_id: string;
  url: string | null;
  created_at: string;
  moderation_status: PhotoStatus;
  moderation_reason: string | null;
  moderated_at: string | null;
  is_primary: boolean;
  sort_order: number;
  width: number | null;
  height: number | null;
  profilePhotoCount: number;
  usablePhotoCount: number;
  profiles: { display_name?: string; kind?: string; city?: string | null } | null;
};
type Stats = Record<PhotoStatus, number>;
const emptyStats: Stats = { pending: 0, approved: 0, rejected: 0 };
const rejectionReasons = ["Uygunsuz veya çıplak içerik", "18 yaş altı şüphesi", "Yüz görünmüyor veya yanıltıcı", "Başkasına ait veya sahte görsel", "Düşük kalite veya teknik sorun"];

export function PhotoModerationBoard() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [filter, setFilter] = useState<PhotoStatus>("pending");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Photo | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try {
      const response = await fetch("/api/admin/photos", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Fotoğraf kuyruğu yüklenemedi.");
      setPhotos(body.photos ?? []); setStats(body.stats ?? emptyStats);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Fotoğraf kuyruğu yüklenemedi."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const visible = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase("tr-TR");
    return photos.filter((photo) => photo.moderation_status === filter && (!clean || (photo.profiles?.display_name ?? "").toLocaleLowerCase("tr-TR").includes(clean)));
  }, [filter, photos, query]);
  const selected = visible.find((photo) => photo.id === selectedId) ?? visible[0] ?? null;

  const decide = async (photo: Photo, status: PhotoStatus, reason?: string) => {
    if (busyId) return;
    setBusyId(photo.id); setNotice("");
    const response = await fetch("/api/admin/photos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: photo.id, status, reason }) });
    const body = await response.json().catch(() => ({})); setBusyId(null);
    if (!response.ok) { setNotice(body.error ?? "Karar kaydedilemedi."); return; }
    setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, moderation_status: status, moderation_reason: status === "rejected" ? reason ?? null : null, moderated_at: status === "pending" ? null : new Date().toISOString() } : item));
    setStats((current) => ({ ...current, [photo.moderation_status]: Math.max(0, current[photo.moderation_status] - 1), [status]: current[status] + 1 }));
    setSelectedId(null); setRejecting(null);
    setNotice(status === "approved" ? "Fotoğraf onaylandı; sıradaki incelemeye geçildi." : status === "rejected" ? body.profilePaused ? "Fotoğraf reddedildi. Yeterli güvenli fotoğraf kalmadığı için profil keşfetten kaldırıldı." : "Fotoğraf reddedildi; karar denetim kaydına işlendi." : "Fotoğraf yeniden inceleme kuyruğuna alındı.");
  };

  return <section className="photo-desk">
    <header className="photo-desk-head"><div><small>Görsel güvenlik</small><h1>Fotoğraf inceleme</h1><p>Önce bekleyenleri değerlendir; geçmiş kararları gerektiğinde yeniden kuyruğa al.</p></div><button onClick={() => void load()} disabled={loading}><RotateCcw size={15}/>{loading ? "Yenileniyor" : "Kuyruğu yenile"}</button></header>
    <div className="photo-stats">{(["pending","approved","rejected"] as const).map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => { setFilter(status); setSelectedId(null); }}><small>{status === "pending" ? "Bekleyen" : status === "approved" ? "Onaylanan" : "Reddedilen"}</small><b>{stats[status]}</b></button>)}</div>
    <label className="photo-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Profil adına göre ara" /></label>
    {notice ? <p className="photo-notice" role="status">{notice}</p> : null}
    {loading ? <div className="photo-desk-empty"><LoaderCircle className="spin"/> İnceleme kuyruğu yükleniyor</div> : !selected ? <div className="photo-desk-empty"><ShieldCheck/> {query ? "Aramana uyan fotoğraf yok." : filter === "pending" ? "Bekleyen fotoğraf kalmadı." : "Bu bölümde kayıt yok."}</div> : <div className="photo-workspace">
      <aside className="photo-queue" aria-label="Fotoğraf kuyruğu">{visible.map((photo) => <button key={photo.id} className={selected.id === photo.id ? "active" : ""} onClick={() => setSelectedId(photo.id)}>{photo.url ? <span><Image src={photo.url} alt="" fill sizes="72px" unoptimized /></span> : <span><ImageOff/></span>}<div><strong>{photo.profiles?.display_name ?? "Profil"}</strong><small>{photo.is_primary ? "Ana fotoğraf" : `${photo.sort_order + 1}. fotoğraf`} · {formatDate(photo.created_at)}</small></div><ChevronRight size={15}/></button>)}</aside>
      <article className="photo-focus">
        <div className="photo-canvas">{selected.url ? <Image src={selected.url} alt={`${selected.profiles?.display_name ?? "Profil"} tarafından yüklenen fotoğraf`} fill sizes="(max-width:900px) 100vw, 620px" unoptimized /> : <ImageOff/>}{selected.url ? <a href={selected.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Tam boy aç</a> : null}</div>
        <div className="photo-context"><div><small>İncelenen profil</small><h2>{selected.profiles?.display_name ?? "Profil"}</h2><p>{selected.profiles?.city || "Şehir belirtilmemiş"} · {selected.profiles?.kind === "bot" ? "Bot profil" : "Kullanıcı profili"}</p></div><span className={`photo-status ${selected.moderation_status}`}>{statusLabel(selected.moderation_status)}</span></div>
        <dl className="photo-facts"><div><dt>Profildeki fotoğraf</dt><dd>{selected.profilePhotoCount}</dd></div><div><dt>Kullanılabilir</dt><dd>{selected.usablePhotoCount}</dd></div><div><dt>Konum</dt><dd>{selected.is_primary ? "Ana fotoğraf" : `${selected.sort_order + 1}. sıra`}</dd></div><div><dt>Boyut</dt><dd>{selected.width && selected.height ? `${selected.width}×${selected.height}` : "Bilinmiyor"}</dd></div></dl>
        <section className="review-guide"><small>Karardan önce kontrol et</small><ul><li>Yüz veya kişi yeterince anlaşılır mı?</li><li>Çıplaklık, şiddet veya rahatsız edici içerik var mı?</li><li>18 yaş altı, sahte profil veya başkasına ait görsel şüphesi var mı?</li></ul></section>
        {selected.moderation_reason ? <p className="previous-reason"><b>Önceki ret nedeni</b>{selected.moderation_reason}</p> : null}
        {selected.moderation_status === "pending" ? <div className="photo-decisions"><button disabled={busyId === selected.id} onClick={() => void decide(selected,"approved")}><Check/> Onayla</button><button className="danger" disabled={busyId === selected.id} onClick={() => setRejecting(selected)}><X/> Reddet</button></div> : <div className="photo-decisions single"><button disabled={busyId === selected.id} onClick={() => void decide(selected,"pending")}><RotateCcw/> Yeniden incelemeye al</button></div>}
      </article>
    </div>}
    {rejecting ? <RejectDialog photo={rejecting} busy={busyId === rejecting.id} onClose={() => setRejecting(null)} onConfirm={(reason) => void decide(rejecting,"rejected",reason)} /> : null}
  </section>;
}

function RejectDialog({ photo, busy, onClose, onConfirm }: { photo: Photo; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(rejectionReasons[0]); const [note, setNote] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); onConfirm(note.trim() ? `${reason}: ${note.trim()}` : reason); };
  return <div className="reject-backdrop" onClick={onClose}><form className="reject-dialog" onSubmit={submit} onClick={(event) => event.stopPropagation()}><button type="button" className="close" onClick={onClose} aria-label="Pencereyi kapat"><X/></button><small>Geri alınabilir karar</small><h2>Fotoğrafı reddet</h2><p>{photo.profiles?.display_name ?? "Bu profil"} için açık bir neden seç.</p>{photo.moderation_status === "approved" && photo.usablePhotoCount <= 1 ? <p className="reject-warning">Bu karardan sonra onaylı fotoğraf kalmayacağı için profil keşfetten kaldırılacak.</p> : null}<fieldset>{rejectionReasons.map((item) => <label key={item}><input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} />{item}</label>)}</fieldset><label className="reject-note">Ek not <textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Gerekliyse kısa açıklama ekle" /></label><footer><button type="button" onClick={onClose}>Vazgeç</button><button className="danger" disabled={busy}><X size={15}/>{busy ? "Kaydediliyor" : "Reddet"}</button></footer></form></div>;
}

function statusLabel(status: PhotoStatus) { return status === "pending" ? "İnceleme bekliyor" : status === "approved" ? "Onaylandı" : "Reddedildi"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
