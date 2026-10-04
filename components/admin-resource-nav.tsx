"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Bot, Camera, ChartNoAxesCombined, ClipboardList, FileText, HeartPulse, LayoutDashboard, LifeBuoy, MessageSquareText, MessageSquareWarning, Settings2, Users } from "lucide-react";
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
  return <aside className="ops-nav">
    <Brand />
    {["owner", "moderator"].includes(role) ? <Link className={active === "community" ? "active" : ""} href="/admin/lovask-control/community"><Camera size={17}/> Hikayeler ve Buluşma</Link> : null}
    <Link className={active === "overview" ? "active" : ""} href="/admin/lovask-control"><LayoutDashboard size={17} /> Genel bakış</Link>
    {["owner", "bot_editor"].includes(role) ? <Link className={active === "bots" ? "active" : ""} href="/admin/lovask-control/bots"><Bot size={17}/> Bot stüdyosu</Link> : null}
    {["owner", "support", "moderator"].includes(role) ? <Link onClick={seenUsers} className={active === "users" ? "active" : ""} href="/admin/lovask-control/users"><Users size={17} /> Kullanıcılar<Badge count={counts.users}/></Link> : null}
    {["owner", "support"].includes(role) ? <Link className={active === "applications" ? "active" : ""} href="/admin/lovask-control/applications"><ClipboardList size={17}/> Başvurular<Badge count={counts.applications}/></Link> : null}
    {["owner", "support"].includes(role) ? <Link className={active === "payments" ? "active" : ""} href="/admin/lovask-control/payments"><Banknote size={17} /> Ödemeler<Badge count={counts.payments}/></Link> : null}
    {["owner", "support"].includes(role) ? <Link className={active === "support" ? "active" : ""} href="/admin/lovask-control/support"><LifeBuoy size={17} /> Canlı destek<Badge count={counts.support}/></Link> : null}
    {["owner", "moderator"].includes(role) ? <Link className={active === "reports" ? "active" : ""} href="/admin/lovask-control/reports"><MessageSquareWarning size={17} /> Şikâyetler<Badge count={counts.reports}/></Link> : null}
    {["owner", "moderator"].includes(role) ? <Link className={active === "photos" ? "active" : ""} href="/admin/lovask-control/photos"><Camera size={17} /> Fotoğraflar<Badge count={counts.photos}/></Link> : null}
    {["owner", "support", "moderator"].includes(role) ? <Link className={active === "conversations" ? "active" : ""} href="/admin/lovask-control/conversations"><MessageSquareText size={17}/> Sohbetler<Badge count={counts.conversations}/></Link> : null}
    {["owner", "bot_editor"].includes(role) ? <Link className={active === "blog" ? "active" : ""} href="/admin/lovask-control/blog"><FileText size={17}/> Blog</Link> : null}
    {role === "owner" ? <Link className={active === "health" ? "active" : ""} href="/admin/lovask-control/health"><HeartPulse size={17}/> Sistem sağlığı</Link> : null}
    <div className="ops-nav-status"><i /><span>Yönetim alanı<small>Canlı bağlantı etkin</small></span></div>
    <Link className="ops-nav-return" href="/">Uygulamaya dön</Link>
    {role === "owner" ? <Link className={active === "growth" ? "active" : ""} href="/admin/lovask-control/growth"><ChartNoAxesCombined size={17}/> Büyüme</Link> : null}
    {role === "owner" ? <Link className={active === "settings" ? "active" : ""} href="/admin/lovask-control/settings"><Settings2 size={17}/> Ayarlar</Link> : null}
  </aside>;
}

function Badge({ count }: { count?: number }) { return count ? <b className="ops-nav-badge" aria-label={`${count} bekleyen işlem`}>{count > 99 ? "99+" : count}</b> : null; }
