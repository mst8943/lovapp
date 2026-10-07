"use client";

import { useEffect, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";
import "./admin-trends.css";

type Series = { key: string; label: string; values: number[] };
type Trends = { labels: string[]; series: Series[] };

export function AdminTrends() {
  const role = useAdminRole();
  const [data, setData] = useState<Trends | null>(null);
  useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    void fetch("/api/admin/trends").then((response) => (response.ok ? response.json() : null)).then((body) => { if (!cancelled && body?.series) setData(body); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [role]);
  if (role !== "owner" || !data) return null;
  return (
    <section className="trend-grid" aria-label="Son 14 günün trendleri">
      {data.series.map((series) => {
        const total = series.values.reduce((sum, value) => sum + value, 0);
        const half = series.values.length / 2;
        const recent = series.values.slice(half).reduce((sum, value) => sum + value, 0);
        const before = series.values.slice(0, half).reduce((sum, value) => sum + value, 0);
        const change = before ? Math.round(((recent - before) / before) * 100) : null;
        const max = Math.max(1, ...series.values);
        return (
          <article key={series.key} className="trend-card">
            <small>{series.label} · 14 gün</small>
            <strong>{total.toLocaleString("tr-TR")}</strong>
            <span className={change === null ? "" : change >= 0 ? "up" : "down"}>{change === null ? "Önceki hafta verisi yok" : `${change >= 0 ? "+" : ""}${change}% geçen haftaya göre`}</span>
            <svg viewBox="0 0 140 40" preserveAspectRatio="none" role="img" aria-label={`${series.label}: günlük değerler`}>
              {series.values.map((value, index) => {
                const height = Math.max(value ? 2 : 0.8, (value / max) * 38);
                return <rect key={data.labels[index]} x={index * 10 + 1} y={40 - height} width={8} height={height} rx={1.5}><title>{`${data.labels[index]}: ${value}`}</title></rect>;
              })}
            </svg>
          </article>
        );
      })}
    </section>
  );
}
