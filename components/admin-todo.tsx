"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./admin-todo.css";

const ITEMS: { key: string; label: (count: number) => string; href: string }[] = [
  { key: "payments", label: (count) => `${count} ödeme incelemeyi bekliyor`, href: "/admin/lovask-control/payments" },
  { key: "applications", label: (count) => `${count} üyelik başvurusu bekliyor`, href: "/admin/lovask-control/applications" },
  { key: "support", label: (count) => `${count} açık destek talebi`, href: "/admin/lovask-control/support" },
  { key: "reports", label: (count) => `${count} açık şikâyet`, href: "/admin/lovask-control/reports" },
  { key: "photos", label: (count) => `${count} fotoğraf onay bekliyor`, href: "/admin/lovask-control/photos" },
  { key: "conversations", label: (count) => `${count} riskli bot sohbeti`, href: "/admin/lovask-control/conversations" },
  { key: "users", label: (count) => `${count} yeni üye`, href: "/admin/lovask-control/users" },
];

export function AdminTodo() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/badges", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)).then((body) => { if (!cancelled && body?.counts) setCounts(body.counts); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  if (!counts) return null;
  const open = ITEMS.filter((item) => (counts[item.key] ?? 0) > 0);
  return (
    <section className="todo-panel" aria-label="Bugün yapılacaklar">
      <div><small>Bugün</small><h2>{open.length ? "Bekleyen işler" : "Bekleyen iş yok"}</h2></div>
      {open.length ? <ul>{open.map((item) => <li key={item.key}><Link href={item.href}><b>{counts[item.key]}</b><span>{item.label(counts[item.key]).replace(/^\d+\s/, "")}</span></Link></li>)}</ul> : <p>Tüm kuyruklar temiz.</p>}
    </section>
  );
}
