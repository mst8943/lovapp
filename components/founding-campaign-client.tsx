"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo } from "react";

export function FoundingCampaignClient({ params }: { params: Record<string, string> }) {
  const applicationUrl = useMemo(() => {
    const query = new URLSearchParams({ mode: "apply", campaign: "istanbul-kurucu-200", utm_campaign: params.utm_campaign || "kurucu200" });
    for (const key of ["ref", "utm_source", "utm_medium", "utm_content"] as const) if (params[key]) query.set(key, params[key]);
    return `/login?${query.toString()}`;
  }, [params]);
  useEffect(() => {
    void fetch("/api/growth/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "campaign_viewed", campaign: "istanbul-kurucu-200", referralCode: params.ref || "", source: params.utm_source || (params.ref ? "referral" : "direct") }) });
  }, [params]);
  return <Link className="founding-primary" href={applicationUrl}>Kurucu üyeliğe başvur <ArrowRight size={18}/></Link>;
}
