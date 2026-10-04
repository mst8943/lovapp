"use client";

import { Check, Gift, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

type ReferralState = { code: string; shareUrl: string; activations: number; earnedDays: number };

export function ReferralPanel({ liveMode }: { liveMode: boolean }) {
  const [data, setData] = useState<ReferralState | null>(liveMode ? null : { code: "LVK-DEMO", shareUrl: "https://lovask.com.tr/kurucu-uye?ref=LVK-DEMO", activations: 2, earnedDays: 14 });
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!liveMode) return; void fetch("/api/profile/referrals", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then(setData); }, [liveMode]);
  const share = async () => {
    if (!data) return;
    const shareData = { title: "Lovask Kurucu Üyelik", text: "Lovask'ın kurucu topluluğuna kişisel davetimle başvurabilirsin.", url: data.shareUrl };
    if (navigator.share) await navigator.share(shareData).catch(() => null);
    else { await navigator.clipboard.writeText(data.shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    if (liveMode) void fetch("/api/profile/referrals", { method: "POST" });
  };
  return <section className="referral-card">
    <div className="referral-icon"><Gift size={19}/></div>
    <div className="referral-copy"><small>Kişisel davetin</small><strong>Birlikte 7 gün Noir kazanın</strong><p>Arkadaşın profilini tamamlayınca ödül ikinize de otomatik eklenir.</p></div>
    <div className="referral-stats"><span><b>{data?.activations ?? "—"}</b> katılan</span><span><b>{data?.earnedDays ?? "—"}</b> gün kazanç</span></div>
    <button type="button" onClick={() => void share()} disabled={!data}>{copied ? <Check size={16}/> : <Share2 size={16}/>} {copied ? "Bağlantı kopyalandı" : "Kişisel daveti paylaş"}</button>
    {data ? <code>{data.code}</code> : <small className="referral-loading">Davet bağlantın hazırlanıyor…</small>}
  </section>;
}
