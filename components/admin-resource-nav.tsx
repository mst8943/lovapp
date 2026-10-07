"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Bot, CalendarHeart, Camera, Bell, ScrollText, ShieldUser, ChartNoAxesCombined, ClipboardList, FileText, HeartPulse, LayoutDashboard, LifeBuoy, MessageSquareText, MessageSquareWarning, Settings2, Sparkles, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { AdminCommandPalette } from "@/components/admin-command-palette";
import { ADMIN_PAGES } from "@/lib/admin-pages";
import type { LucideIcon } from "lucide-react";
import { useAdminRole } from "@/components/admin-role-context";
import { useCallback, useEffect, useState } from "react";

const ICONS: Record<string, LucideIcon> = { overview: LayoutDashboard, users: Users, applications: ClipboardList, payments: Banknote, support: LifeBuoy, reports: MessageSquareWarning, photos: Camera, conversations: MessageSquareText, community: CalendarHeart, bots: Bot, blog: FileText, growth: ChartNoAxesCombined, notify: Bell, platform: Sparkles, health: HeartPulse, team: ShieldUser, audit: ScrollText, settings: Settings2 };

export function AdminResourceNav() {
  const role = useAdminRole();
  const pathname = usePathname();
  const active = pathname === "/admin/lovask-control" ? "overview" : pathname.split("/")[3] ?? "overview";
  const [counts, setCounts] = useState<Record<string, number>>({});
  const loadCounts = useCallback(async () => { const response = await fetch("/api/admin/badges", { cache: "no-store" }); if (!response.ok) return; const body = await response.json().catch(() => ({})); setCounts(body.counts ?? {}); }, []);
  useEffect(() => { const initial = window.setTimeout(() => void loadCounts(), 0); const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadCounts(); }, 20_000); const visible = () => { if (document.visibilityState === "visible") void loadCounts(); }; const refresh = () => void loadCounts(); document.addEventListener("visibilitychange", visible); window.addEventListener("lovask:admin-counts", refresh); return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("lovask:admin-counts", refresh); }; }, [loadCounts]);
  const seenUsers = () => { if ((counts.users ?? 0) < 1) return; setCounts((current) => ({ ...current, users: 0 })); void fetch("/api/admin/badges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "users" }) }); };
  return <aside className="ops-nav">
    <Brand />
    <AdminCommandPalette role={role} />
    {ADMIN_PAGES.filter((page) => page.roles.includes(role)).map((page) => {
      const Icon = ICONS[page.key] ?? LayoutDashboard;
      return <Link key={page.key} onClick={page.key === "users" ? seenUsers : undefined} className={active === page.key ? "active" : ""} href={page.href}><Icon size={17} /> {page.label}<Badge count={counts[page.key]}/></Link>;
    })}
    <div className="ops-nav-status"><i /><span>Yönetim alanı<small>Canlı bağlantı etkin</small></span></div>
    <Link className="ops-nav-return" href="/">Uygulamaya dön</Link>
  </aside>;
}

function Badge({ count }: { count?: number }) { return count ? <b className="ops-nav-badge" aria-label={`${count} bekleyen işlem`}>{count > 99 ? "99+" : count}</b> : null; }
