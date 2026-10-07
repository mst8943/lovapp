"use client";

import { Award } from "lucide-react";
import { useEffect, useState } from "react";
import "./endorsements.css";

type Badge = { key: string; label: string; count: number };

export function EndorsementBadges({ profileId }: { profileId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(profileId)) return;
    let cancelled = false;
    void fetch(`/api/endorsements?profileId=${profileId}`, { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)).then((body) => { if (!cancelled && body?.badges) setBadges(body.badges); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [profileId]);
  if (!badges.length) return null;
  return <div className="endorsement-badges" aria-label="Üyelerden rozetler">{badges.map((badge) => <span key={badge.key}><Award size={13} /> {badge.label}</span>)}</div>;
}
