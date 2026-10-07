"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Bot, CalendarHeart, Camera, ScrollText, ChartNoAxesCombined, ClipboardList, FileText, HeartPulse, LayoutDashboard, LifeBuoy, MessageSquareText, MessageSquareWarning, Settings2, Sparkles, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { useAdminRole } from "@/components/admin-role-context";
import { useCallback, useEffect, useState } from "react";

export function AdminResourceNav() {
  const role = useAdminRole();
  const pathname = usePathname();
  const active = pathname === "/admin/lovask-control" ? "overview" : pathname.split("/")[3] ?? "overview";
  const [counts, setCounts] = useState<Record<string, number>>({});
  const loadCounts = useCallback(async () => { const response = await fetch("/api/admin/badges", { cache: "no-store" }); if (!response.ok) return; const body = await response.json().catch(() => ({})); setCounts(body.counts ?? {}); }, []);
  useEffect(() => { const initial = window.setTimeout(() => void loadCounts(), 0); const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadCounts(); }, 20_000); const visible = () => { if (document.visibilityState === "visible") void loadCounts(); }; const refresh = () => void loadCounts(); document.addEventListener("visibilitychange", visible); window.addEventListener("lovask:admin-counts", refresh); return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("lovask:admin-counts", refresh); }; }, [loadCounts]);
  const seenUsers = () => { if ((counts.users ?? 0) < 1) return; setCounts((current) => ({ ...current, users: 0 })); void fetch("/api/admin/badges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "users" }) }); };
  const link = (key: string, href: string, label: string, icon: React.ReactNode, roles: string[], extra?: { onClick?: () => void; count?: number }) =>
    roles.includes(role) ? <Link onClick={extra?.onClick} className={active === key ? "active" : ""} href={href}>{icon} {label}<Badge count={extra?.count}/></Link> : null;
  return <aside className="ops-nav">
    <Brand />
    {link("overview", "/admin/lovask-control", "Genel bakış", <LayoutDashboard size={17} />, ["owner", "bot_editor", "support", "moderator"])}
    {link("users", "/admin/lovask-control/users", "Kullanıcılar", <Users size={17} />, ["owner", "support", "moderator"], { onClick: seenUsers, count: counts.users })}
    {link("applications", "/admin/lovask-control/applications", "Başvurular", <ClipboardList size={17}/>, ["owner", "support"], { count: counts.applications })}
    {link("payments", "/admin/lovask-control/payments", "Ödemeler", <Banknote size={17} />, ["owner", "support"], { count: counts.payments })}
    {link("support", "/admin/lovask-control/support", "Canlı destek", <LifeBuoy size={17} />, ["owner", "support"], { count: counts.support })}
    {link("reports", "/admin/lovask-control/reports", "Şikâyetler", <MessageSquareWarning size={17} />, ["owner", "moderator"], { count: counts.reports })}
    {link("photos", "/admin/lovask-control/photos", "Fotoğraflar", <Camera size={17} />, ["owner", "moderator"], { count: counts.photos })}
    {link("conversations", "/admin/lovask-control/conversations", "Sohbetler", <MessageSquareText size={17}/>, ["owner", "support", "moderator"], { count: counts.conversations })}
    {link("community", "/admin/lovask-control/community", "Hikayeler ve Buluşma", <CalendarHeart size={17}/>, ["owner", "moderator"])}
    {link("bots", "/admin/lovask-control/bots", "Bot stüdyosu", <Bot size={17}/>, ["owner", "bot_editor"])}
    {link("blog", "/admin/lovask-control/blog", "Blog", <FileText size={17}/>, ["owner", "bot_editor"])}
    {link("growth", "/admin/lovask-control/growth", "Büyüme", <ChartNoAxesCombined size={17}/>, ["owner"])}
    {link("platform", "/admin/lovask-control/platform", "Platform özeti", <Sparkles size={17}/>, ["owner"])}
    {link("health", "/admin/lovask-control/health", "Sistem sağlığı", <HeartPulse size={17}/>, ["owner"])}
    {link("audit", "/admin/lovask-control/audit", "İşlem günlüğü", <ScrollText size={17}/>, ["owner"])}
    {link("settings", "/admin/lovask-control/settings", "Ayarlar", <Settings2 size={17}/>, ["owner"])}
    <div className="ops-nav-status"><i /><span>Yönetim alanı<small>Canlı bağlantı etkin</small></span></div>
    <Link className="ops-nav-return" href="/">Uygulamaya dön</Link>
  </aside>;
}

function Badge({ count }: { count?: number }) { return count ? <b className="ops-nav-badge" aria-label={`${count} bekleyen işlem`}>{count > 99 ? "99+" : count}</b> : null; }
