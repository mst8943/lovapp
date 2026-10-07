"use client";

import { Award, Ellipsis, HeartCrack, ShieldAlert, UserX } from "lucide-react";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { PremiumNotice } from "@/components/premium-notice";
import type { Profile } from "@/lib/demo-data";
import { ENDORSEMENT_BADGES } from "@/lib/endorsements";
import "./endorsements.css";

export function SafetyMenu({ profile, matchId, compact = false, onBlocked }: { profile: Profile; matchId?: string | null; compact?: boolean; onBlocked: () => void }) {
  const [endorsing, setEndorsing] = useState(false);
  const [open, setOpen] = useState(false); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState("fake_profile"); const [details, setDetails] = useState(""); const [blockAfterReport, setBlockAfterReport] = useState(true); const [notice, setNotice] = useState("");
  const submit = async (payload: Record<string, unknown>) => { const response = await fetch("/api/safety", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({})); if (!response.ok) { setNotice(body.error ?? "İşlem tamamlanamadı."); return false; } return true; };
  const endorse = async (badge: string) => {
    const response = await fetch("/api/endorsements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toProfileId: profile.id, badge }) });
    const body = await response.json().catch(() => ({}));
    setEndorsing(false);
    setNotice(response.ok ? `${profile.name} için rozet bırakıldı. Teşekkürler!` : body.error ?? "Rozet bırakılamadı.");
  };
  const block = async () => { if (!window.confirm(`${profile.name} engellensin mi? Eşleşme kapanır ve artık birbirinizi göremezsiniz.`)) return; if (await submit({ action: "block", targetProfileId: profile.id })) onBlocked(); };
  const unmatch = async () => { if (!window.confirm(`${profile.name} ile eşleşmen kaldırılsın mı? Sohbet iki tarafta da kapanır.`)) return; if (await submit({ action: "unmatch", targetProfileId: profile.id })) onBlocked(); };
  const report = async () => { if (await submit({ action: "report", targetProfileId: profile.id, reason, details, matchId: matchId ?? null, block: blockAfterReport })) { setNotice(blockAfterReport ? "Şikâyetin iletildi ve profil engellendi." : "Şikâyetin güvenlik ekibine iletildi."); setReporting(false); if (blockAfterReport) onBlocked(); } };
  return <div className={compact ? "safety-menu compact" : "safety-menu"}>
    <button type="button" className={compact ? "icon-button" : "safety-trigger"} onClick={() => setOpen((value) => !value)} aria-label="Güvenlik seçenekleri"><Ellipsis size={19}/></button>
    {open ? <div className="safety-popover">{matchId ? <button type="button" onClick={() => { setOpen(false); setEndorsing(true); }}><Award size={16}/> Rozet bırak</button> : null}{matchId ? <button type="button" onClick={() => void unmatch()}><HeartCrack size={16}/> Eşleşmeyi kaldır</button> : null}<button type="button" onClick={() => { setOpen(false); setReporting(true); }}><ShieldAlert size={16}/> Şikâyet et</button><button type="button" className="danger" onClick={() => void block()}><UserX size={16}/> Engelle</button></div> : null}
    {endorsing ? <div className="safety-dialog" role="dialog" aria-modal="true" aria-labelledby="endorse-title"><div><h3 id="endorse-title">{profile.name} için rozet bırak</h3><p>Yalnızca olumlu rozetler vardır. Rozeti kimin bıraktığı görünmez.</p><div className="endorse-options">{ENDORSEMENT_BADGES.map((badge) => <button key={badge.key} type="button" onClick={() => void endorse(badge.key)}>{badge.label}</button>)}</div><footer><button type="button" onClick={() => setEndorsing(false)}>Vazgeç</button></footer></div></div> : null}
    <AnimatePresence>{notice ? <PremiumNotice message={notice} onClose={() => setNotice("")} /> : null}</AnimatePresence>
    {reporting ? <div className="safety-dialog" role="dialog" aria-modal="true" aria-labelledby="safety-report-title"><div><h3 id="safety-report-title">{profile.name} için şikâyet</h3><select aria-label="Şikâyet nedeni" value={reason} onChange={(event) => setReason(event.target.value)}><option value="fake_profile">Sahte profil</option><option value="harassment">Taciz veya tehdit</option><option value="inappropriate_content">Uygunsuz içerik</option><option value="fraud">Dolandırıcılık</option><option value="underage">18 yaş altı şüphesi</option><option value="spam">Spam</option><option value="other">Diğer</option></select><textarea aria-label="Şikâyet ayrıntısı" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} placeholder="Kısaca ne olduğunu anlat (isteğe bağlı)"/><label><input type="checkbox" checked={blockAfterReport} onChange={(event) => setBlockAfterReport(event.target.checked)}/> Bu profili ayrıca engelle</label><footer><button type="button" onClick={() => setReporting(false)}>Vazgeç</button><button type="button" onClick={() => void report()}>Şikâyeti gönder</button></footer></div></div> : null}
  </div>;
}
