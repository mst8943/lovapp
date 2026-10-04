"use client";

import { ExternalLink, LoaderCircle, MailCheck, Search, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";

type Status = "submitted" | "reviewing" | "approved" | "rejected" | "invited";
type Application = {
  id: string; application_code: string; email: string; phone_e164: string | null; full_name: string; instagram_username: string | null;
  occupation: string; industry: string; city: string | null; application_note: string | null; marketing_consent: boolean;
  notification_consent: boolean; status: Status; admin_note: string | null; reviewed_at: string | null; invited_at: string | null; created_at: string;
  receipt_email_sent_at: string | null; receipt_sms_sent_at: string | null; decision_email_sent_at: string | null; decision_sms_sent_at: string | null; invitation_sms_sent_at: string | null; notification_last_error: string | null;
};

const filters: Array<["all" | Status, string]> = [["all", "Tümü"], ["submitted", "Yeni"], ["reviewing", "İncelemede"], ["approved", "Kabul"], ["invited", "Davetli"], ["rejected", "Ret"]];

export function ApplicationReviewBoard() {
  const role = useAdminRole();
  const [rows, setRows] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("Başvurular yükleniyor…");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/applications${filter === "all" ? "" : `?status=${filter}`}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setNotice(body.error ?? "Başvurular yüklenemedi.");
    setRows(body.applications ?? []); setNotice("");
  }, [filter]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const visible = useMemo(() => rows.filter((row) => `${row.full_name} ${row.email} ${row.occupation} ${row.industry} ${row.instagram_username ?? ""}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))), [rows, query]);
  const selected = visible.find((row) => row.id === selectedId) ?? visible[0] ?? null;
  const adminNote = selected ? noteDrafts[selected.id] ?? selected.admin_note ?? "" : "";

  const update = async (status: "reviewing" | "approved" | "rejected") => {
    if (!selected) return; setBusy(true); setNotice("");
    const response = await fetch("/api/admin/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: selected.id, status, adminNote }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setNotice(body.error ?? "Başvuru güncellenemedi.");
    setNotice("Başvuru durumu kaydedildi."); await load();
  };
  const invite = async () => {
    if (!selected) return; setBusy(true); setNotice("");
    const response = await fetch("/api/admin/applications/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: selected.id }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setNotice(body.error ?? "Davetiye gönderilemedi.");
    setNotice("Kişisel davetiye e-postası gönderildi."); await load();
  };

  return <section className="application-desk">
    <header><div><small>Üyelik kurulu</small><h1>Başvurular</h1><p>Profilleri değerlendir, kabul edilenlere tek kullanımlık davetiye gönder.</p></div><span>{rows.filter((row) => row.status === "submitted").length}<small>yeni başvuru</small></span></header>
    <div className="application-toolbar"><label><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İsim, meslek veya Instagram ara"/></label><div>{filters.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    {notice ? <p className="application-admin-notice" role="status">{notice}</p> : null}
    <div className="application-workspace">
      <aside>{visible.map((row) => <button key={row.id} className={selected?.id === row.id ? "active" : ""} onClick={() => setSelectedId(row.id)}><i className={row.status}/><span><strong>{row.full_name}</strong><small>{row.occupation} · {row.industry}</small></span><em>{statusLabel(row.status)}</em></button>)}{!visible.length ? <p>Bu filtrede başvuru bulunamadı.</p> : null}</aside>
      {selected ? <article className="application-focus"><header><div><small>{selected.application_code}</small><h2>{selected.full_name}</h2><p>{selected.email}</p></div><i className={selected.status}>{statusLabel(selected.status)}</i></header>
        <dl><div><dt>Meslek</dt><dd>{selected.occupation}</dd></div><div><dt>Sektör</dt><dd>{selected.industry}</dd></div><div><dt>Telefon</dt><dd>{selected.phone_e164 ?? "Belirtilmedi"}</dd></div><div><dt>Şehir</dt><dd>{selected.city ?? "Belirtilmedi"}</dd></div><div><dt>Başvuru</dt><dd>{formatDate(selected.created_at)}</dd></div></dl>
        {selected.instagram_username ? <a className="instagram-review" href={`https://www.instagram.com/${encodeURIComponent(selected.instagram_username)}/`} target="_blank" rel="noreferrer">@{selected.instagram_username}<ExternalLink size={14}/></a> : <span className="instagram-review empty">Instagram eklenmemiş</span>}
        <section><small>Başvuru notu</small><p>{selected.application_note ?? "Başvuru notu eklenmemiş."}</p></section>
        <label className="review-note">Kurul notu<textarea maxLength={2000} value={adminNote} onChange={(event) => setNoteDrafts((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder="Yalnızca yönetim ekibi görür."/></label>
        <div className="application-decisions">
          {selected.status === "submitted" ? <button disabled={busy} onClick={() => void update("reviewing")}><ShieldCheck size={15}/> İncelemeye al</button> : null}
          {!["approved", "invited"].includes(selected.status) ? <button className="approve" disabled={busy} onClick={() => void update("approved")}><ShieldCheck size={15}/> Kabul et</button> : null}
          {selected.status === "approved" ? <button className="invite" disabled={busy || role !== "owner"} onClick={() => void invite()}>{busy ? <LoaderCircle className="spin" size={15}/> : <MailCheck size={15}/>} Davetiye gönder</button> : null}
          {selected.status !== "invited" ? <button className="reject" disabled={busy} onClick={() => void update("rejected")}><X size={15}/> Reddet</button> : null}
        </div>
        {selected.marketing_consent ? <small className="marketing-ok">Üyelik teklifleri için iletişim izni var.</small> : null}
        <small className="marketing-ok">Başvuru bildirimi: e-posta {selected.receipt_email_sent_at ? "gönderildi" : "bekliyor"} · SMS {selected.receipt_sms_sent_at ? "gönderildi" : "bekliyor"}</small>
        {selected.notification_last_error ? <small className="notification-error">Son bildirim hatası: {selected.notification_last_error}</small> : null}
      </article> : <div className="application-focus empty">İncelemek için bir başvuru seç.</div>}
    </div>
  </section>;
}

function statusLabel(status: Status) { return ({ submitted: "Yeni", reviewing: "İncelemede", approved: "Kabul", rejected: "Reddedildi", invited: "Davet gönderildi" } as Record<Status, string>)[status]; }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
