"use client";

import { useEffect, useState } from "react";

type Campaign = { id: string; title: string; body: string; cta_label: string; cta_path: string };

export function CampaignBanner({ compact = false }: { compact?: boolean }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/campaign", { cache: "no-store", signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((body) => { if (body) setCampaign(body.campaign ?? null); })
        .catch(() => {});
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);
  if (!campaign) return null;
  return <aside className={`campaign-banner${compact ? " compact" : ""}`}>
    <div><small>DUYURU</small><strong>{campaign.title}</strong>{!compact ? <p>{campaign.body}</p> : null}</div>
    <a href={campaign.cta_path} onClick={() => { void fetch("/api/campaign", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: campaign.id }) }); }}>{campaign.cta_label}</a>
  </aside>;
}
