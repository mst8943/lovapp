"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function Brand({ brandName, logoUrl, compact = false, className = "brand" }: { brandName?: string; logoUrl?: string; compact?: boolean; className?: string }) {
  const [settings, setSettings] = useState({ brand_name: "Lovask", logo_url: "/logo_l_extra_thick.png" });
  useEffect(() => {
    if (brandName && logoUrl) return;
    const controller = new AbortController();
    fetch("/api/branding", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data) setSettings({ brand_name: data.brand_name, logo_url: data.logo_url });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [brandName, logoUrl]);
  const name = brandName ?? settings.brand_name;
  const logo = logoUrl ?? settings.logo_url;
  return (
    <span className={className} aria-label={compact ? name : undefined}>
      <span><Image src={logo} alt="" width={compact ? 30 : 34} height={compact ? 24 : 34} style={{ objectFit: "contain" }} unoptimized priority /></span>
      {!compact ? <b>{name}</b> : null}
    </span>
  );
}
