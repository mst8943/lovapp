"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

export function HistoryBackButton({ fallback, className, label, children, style }: { fallback: string; className?: string; label: string; children: ReactNode; style?: CSSProperties }) {
  const router = useRouter();
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return <button type="button" className={className} style={style} aria-label={label} onClick={goBack}>{children}</button>;
}
