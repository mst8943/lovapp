"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";
import "./admin-recent.css";

type Entry = { id: number; actor: string; action: string; target_type: string; created_at: string };

function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} sa önce` : `${Math.floor(hours / 24)} gün önce`;
}

export function AdminRecent() {
  const role = useAdminRole();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    void fetch("/api/admin/audit?limit=6", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)).then((body) => { if (!cancelled && body?.entries) setEntries(body.entries); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [role]);
  if (role !== "owner" || !entries?.length) return null;
  return (
    <section className="recent-panel" aria-label="Son yönetici işlemleri">
      <div className="recent-head"><div><small>Güvenlik</small><h2>Son yönetici işlemleri</h2></div><Link href="/admin/lovask-control/audit">Tümünü gör</Link></div>
      <ul>{entries.map((entry) => <li key={entry.id}><strong>{entry.action}</strong><span>{entry.actor}</span><time>{ago(entry.created_at, now)}</time></li>)}</ul>
    </section>
  );
}
