"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, LoaderCircle, Search, X } from "lucide-react";

type Mode = "users" | "payments" | "reports" | "photos";
type Row = Record<string, unknown>;

const config = {
  users: { endpoint: "/api/admin/users", key: "users", title: "Kullanıcılar", eyebrow: "Üye dizini", empty: "Aramana uyan kullanıcı bulunamadı." },
  payments: { endpoint: "/api/admin/payments", key: "orders", title: "Ödemeler", eyebrow: "Noir kontrol masası", empty: "Henüz ödeme talebi yok." },
  reports: { endpoint: "/api/admin/reports", key: "reports", title: "Şikâyetler", eyebrow: "Güvenlik kuyruğu", empty: "İncelenecek şikâyet yok." },
  photos: { endpoint: "/api/admin/photos", key: "photos", title: "Fotoğraf inceleme", eyebrow: "Görsel güvenlik", empty: "İncelenecek fotoğraf yok." },
} as const;

export function AdminOperations({ mode }: { mode: Mode }) {
  const meta = config[mode]; const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(""); const [query, setQuery] = useState(""); const [selected, setSelected] = useState<Row | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try { const response = await fetch(`${meta.endpoint}${mode === "users" && query ? `?q=${encodeURIComponent(query)}` : ""}`, { cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error); setRows(body[meta.key] ?? []); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Veriler yüklenemedi."); }
    finally { setLoading(false); }
  }, [meta.endpoint, meta.key, mode, query]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const mutate = async (payload: Row) => {
    setNotice(""); const response = await fetch(meta.endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({}));
    if (!response.ok) return setNotice(body.error ?? "İşlem tamamlanamadı."); setSelected(null); setNotice("İşlem kaydedildi."); await load();
  };
  const search = (event: FormEvent) => { event.preventDefault(); void load(); };
  return <section className="ops-content">
    <header><div><small>{meta.eyebrow}</small><h1>{meta.title}</h1></div>{mode === "users" ? <form onSubmit={search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İsimle ara" /><button>Ara</button></form> : null}</header>
    {notice ? <p className="ops-notice" role="status">{notice}</p> : null}
    {loading ? <div className="ops-empty"><LoaderCircle className="spin" /> Yükleniyor</div> : rows.length === 0 ? <div className="ops-empty">{meta.empty}</div> : <div className={`ops-list ${mode}`}>{rows.map((row) => <OperationRow key={String(row.id)} mode={mode} row={row} onSelect={() => setSelected(row)} onMutate={mutate} />)}</div>}
    {selected && mode === "users" ? <UserDetail profileId={String(selected.id)} onClose={() => setSelected(null)} /> : null}
  </section>;
}

function OperationRow({ mode, row, onSelect, onMutate }: { mode: Mode; row: Row; onSelect: () => void; onMutate: (payload: Row) => Promise<void> }) {
  if (mode === "users") return <button className="ops-row user-row" onClick={onSelect}><Avatar src={row.image} /><span><strong>{String(row.display_name)}</strong><small>{String(row.email ?? row.phone ?? "İletişim bilgisi kısıtlı")}</small></span><span><b>Seviye {String(row.level)}</b><small>{formatDate(row.lastSeenAt)}</small></span><Status active={isNoir(row.noirUntil)} label={isNoir(row.noirUntil) ? "Noir" : "Ücretsiz"} /></button>;
  if (mode === "payments") { const profile = row.profiles as { display_name?: string } | null; const plan = row.premium_plans as { name?: string } | null; return <article className="ops-row payment-row"><span><strong>{profile?.display_name ?? "Kullanıcı"}</strong><small>{String(row.email ?? "")} · {String(row.payment_reference)}</small><small>{providerLabel(String(row.provider))}</small></span><span><b>{plan?.name ?? "Noir"}</b><small>{Number(row.amount).toLocaleString("tr-TR")} {String(row.currency)}</small>{row.sender_full_name ? <small>Gönderen: {String(row.sender_full_name)} · {formatShortDate(row.payment_date)}</small> : null}{row.external_reference ? <small>İşlem no: {String(row.external_reference)}</small> : null}</span><Status active={row.status === "approved"} label={statusLabel(String(row.status))} /><div className="row-actions">{row.proofUrl ? <a href={String(row.proofUrl)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Dekont</a> : <small>Dekont yok</small>}{row.status === "under_review" ? <><button onClick={() => void onMutate({ action: "approve", orderId: row.id })}><Check size={15} /> Onayla ve üyeliği aç</button><button className="danger" onClick={() => { const reason = window.prompt("Red nedeni"); if (reason) void onMutate({ action: "reject", orderId: row.id, reason }); }}><X size={15} /> Reddet</button></> : null}</div></article>; }
  if (mode === "reports") { const reporter = row.reporter as { display_name?: string } | null; const reported = row.reported as { display_name?: string } | null; return <article className="ops-row"><span><strong>{reported?.display_name ?? "Profil"}</strong><small>{reasonLabel(String(row.reason))} · Bildiren: {reporter?.display_name ?? "—"}</small></span><p>{String(row.details ?? "Açıklama eklenmedi.")}</p><Status active={row.status === "resolved"} label={statusLabel(String(row.status))} /><div className="row-actions">{row.status === "open" ? <button onClick={() => void onMutate({ reportId: row.id, status: "reviewing" })}>İncele</button> : null}<button onClick={() => void onMutate({ reportId: row.id, status: "resolved", resolution: "İnceleme tamamlandı." })}><Check size={15} /> Tamamla</button><button className="danger" onClick={() => void onMutate({ reportId: row.id, status: "rejected" })}><X size={15} /> Reddet</button></div></article>; }
  const profile = row.profiles as { display_name?: string } | null; return <article className="photo-review"><div>{row.url ? <Image src={String(row.url)} alt="İncelenen profil fotoğrafı" fill sizes="280px" unoptimized /> : null}</div><span><strong>{profile?.display_name ?? "Profil"}</strong><small>{formatDate(row.created_at)}</small><Status active={row.moderation_status === "approved"} label={statusLabel(String(row.moderation_status))} /></span><div className="row-actions"><button onClick={() => void onMutate({ photoId: row.id, status: "approved" })}><Check size={15} /> Onayla</button><button className="danger" onClick={() => { const reason = window.prompt("Red nedeni"); if (reason) void onMutate({ photoId: row.id, status: "rejected", reason }); }}><X size={15} /> Reddet</button></div></article>;
}

function UserDetail({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const [user, setUser] = useState<Row | null>(null); useEffect(() => { void fetch(`/api/admin/users/${profileId}`, { cache: "no-store" }).then((response) => response.json().catch(() => ({}))).then((body) => setUser(body.user ?? null)); }, [profileId]);
  return <div className="ops-modal" onClick={onClose}><article onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose}><X /></button>{!user ? <LoaderCircle className="spin" /> : <><small>Kullanıcı kaydı</small><h2>{String(user.display_name)}</h2><dl><dt>E-posta</dt><dd>{String(user.email ?? "Yetki nedeniyle gizli")}</dd><dt>Telefon</dt><dd>{String(user.phone ?? "Eklenmemiş veya gizli")}</dd><dt>Şehir</dt><dd>{String(user.city ?? "—")}</dd><dt>XP / Seviye</dt><dd>{String(user.xp)} / {String(user.level)}</dd><dt>Eşleşme / Mesaj</dt><dd>{String(user.matchCount)} / {String(user.messageCount)}</dd><dt>Şikâyet</dt><dd>{String(user.reportCount)}</dd><dt>Gizlenen Sohbet</dt><dd>{String(user.hiddenConversationCount ?? 0)}</dd><dt>Noir bitişi</dt><dd>{formatDate(user.noirUntil)}</dd><dt>Son görülme</dt><dd>{formatDate(user.lastSeenAt)}</dd></dl>{user.superLikes && (((user.superLikes as { sent?: unknown[] })?.sent?.length ?? 0) > 0 || ((user.superLikes as { received?: unknown[] })?.received?.length ?? 0) > 0) ? <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 10 }}><strong style={{ fontSize: 12, color: "#f59e0b", display: "block", marginBottom: 4 }}>⭐ Notlu Süper Beğeniler</strong>{((user.superLikes as { sent: { super_like_note: string; created_at: string }[] }).sent ?? []).map((s, idx) => <div key={`s-${idx}`} style={{ fontSize: 11, margin: "2px 0", color: "#ddd" }}>Gönderdiği Not: &quot;{s.super_like_note}&quot; <small style={{ opacity: 0.6 }}>({new Date(s.created_at).toLocaleDateString("tr-TR")})</small></div>)}{((user.superLikes as { received: { super_like_note: string; created_at: string }[] }).received ?? []).map((s, idx) => <div key={`r-${idx}`} style={{ fontSize: 11, margin: "2px 0", color: "#ddd" }}>Aldığı Not: &quot;{s.super_like_note}&quot; <small style={{ opacity: 0.6 }}>({new Date(s.created_at).toLocaleDateString("tr-TR")})</small></div>)}</div> : null}<AdminVoice profileId={profileId} prompt={user.voicePrompt} url={user.voiceUrl} enabled={user.canManageNoir === true} /><ManualNoirControls profileId={profileId} initialNoirUntil={user.noirUntil} enabled={user.canManageNoir === true} /></>}</article></div>;
}

function AdminVoice({ profileId, prompt, url, enabled }: { profileId: string; prompt: unknown; url: unknown; enabled: boolean }) {
  const [removed, setRemoved] = useState(false);
  const [notice, setNotice] = useState("");
  if (typeof url !== "string" || !url || removed) return null;
  const remove = async () => {
    const response = await fetch(`/api/admin/users/${profileId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_voice" }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setRemoved(true); else setNotice(body.error ?? "Sesli biyografi kaldırılamadı.");
  };
  return <section className="manual-noir"><small>Sesli biyografi</small><strong>{String(prompt ?? "Sesli yanıt")}</strong><audio controls preload="none" src={url} />{enabled ? <button type="button" className="revoke" onClick={() => void remove()}>Sesli biyografiyi kaldır</button> : null}{notice ? <p role="status">{notice}</p> : null}</section>;
}

function ManualNoirControls({ profileId, initialNoirUntil, enabled }: { profileId: string; initialNoirUntil: unknown; enabled: boolean }) {
  const [noirUntil, setNoirUntil] = useState(initialNoirUntil);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  if (!enabled) return null;
  const update = async (action: "grant_noir" | "revoke_noir", days?: 7 | 30 | 90 | 365) => {
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${profileId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "grant_noir" ? { action, days } : { action }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Noir üyeliği güncellenemedi.");
      setNoirUntil(body.noirUntil ?? null);
      setNotice(action === "grant_noir" ? `Noir üyeliğine ${days} gün eklendi. Yeni bitiş: ${formatDate(body.noirUntil)}` : "Noir üyeliği kaldırıldı.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
    finally { setSaving(false); }
  };
  return <section className="manual-noir"><small>Manuel Noir yönetimi</small><strong>{isNoir(noirUntil) ? `Aktif · ${formatDate(noirUntil)}` : "Ücretsiz üyelik"}</strong><div>{([7,30,90,365] as const).map((days) => <button key={days} type="button" disabled={saving} onClick={() => void update("grant_noir", days)}>+{days} gün</button>)}</div>{isNoir(noirUntil) ? <button className="revoke" type="button" disabled={saving} onClick={() => { if (window.confirm("Bu kullanıcının Noir üyeliği kaldırılsın mı?")) void update("revoke_noir"); }}>Noir üyeliğini kaldır</button> : null}{notice ? <p role="status">{notice}</p> : null}</section>;
}

function Avatar({ src }: { src: unknown }) { return <i className="ops-avatar">{typeof src === "string" && src ? <Image src={src} alt="" fill sizes="48px" unoptimized /> : null}</i>; }
function Status({ active, label }: { active: boolean; label: string }) { return <i className={active ? "status active" : "status"}>{label}</i>; }
function isNoir(value: unknown) { return typeof value === "string" && new Date(value) > new Date(); }
function formatDate(value: unknown) { return typeof value === "string" && value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Kayıt yok"; }
function formatShortDate(value: unknown) { return typeof value === "string" && value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)) : "tarih yok"; }
function providerLabel(value: string) { return ({ shopier: "Kartla ödeme · otomatik", bank_transfer: "Havale / EFT · manuel", papara: "Papara · manuel", crypto: "Kripto · manuel" } as Record<string,string>)[value] ?? value; }
function statusLabel(value: string) { return ({ awaiting_payment: "Ödeme bekleniyor", under_review: "İncelemede", approved: "Onaylandı", rejected: "Reddedildi", open: "Açık", reviewing: "İncelemede", resolved: "Tamamlandı", pending: "Bekliyor" } as Record<string,string>)[value] ?? value; }
function reasonLabel(value: string) { return ({ fake_profile: "Sahte profil", harassment: "Taciz veya tehdit", inappropriate_content: "Uygunsuz içerik", fraud: "Dolandırıcılık", underage: "18 yaş altı şüphesi", spam: "Spam", other: "Diğer" } as Record<string,string>)[value] ?? value; }
