import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const seenSchema = z.object({ resource: z.literal("users") });

export async function GET() {
  const auth = await requireAdmin(["owner","moderator","bot_editor","support"]); if (auth instanceof NextResponse) return auth;
  const { data: read } = await auth.admin.from("admin_resource_reads").select("seen_at").eq("admin_user_id", auth.user.id).eq("resource", "users").maybeSingle();
  const userQuery = auth.admin.from("profiles").select("id", { count: "exact", head: true }).eq("kind", "human");
  if (read?.seen_at) userQuery.gt("created_at", read.seen_at);
  const [users, applications, payments, reports, photos, support, conversations] = await Promise.all([
    userQuery,
    auth.admin.from("membership_applications").select("id", { count: "exact", head: true }).in("status", ["submitted","reviewing"]),
    auth.admin.from("payment_orders").select("id", { count: "exact", head: true }).eq("status", "under_review"),
    auth.admin.from("reports").select("id", { count: "exact", head: true }).in("status", ["open","reviewing"]),
    auth.admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("processing_status", "ready").eq("moderation_status", "pending"),
    auth.admin.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
    auth.admin.from("bot_risk_events").select("id", { count: "exact", head: true }).in("status", ["open","reviewing"]),
  ]);
  if ([users, applications, payments, reports, photos, support, conversations].some((result) => result.error || result.count === null))
    return NextResponse.json({ error: "Yönetim sayaçları yüklenemedi." }, { status: 503 });
  const permitted = new Set(auth.role === "owner" ? ["users","applications","payments","reports","photos","support","conversations"] : auth.role === "support" ? ["users","applications","payments","support","conversations"] : auth.role === "moderator" ? ["users","reports","photos","conversations"] : ["conversations"]);
  const all = { users: users.count ?? 0, applications: applications.count ?? 0, payments: payments.count ?? 0, reports: reports.count ?? 0, photos: photos.count ?? 0, support: support.count ?? 0, conversations: conversations.count ?? 0 };
  return NextResponse.json({ counts: Object.fromEntries(Object.entries(all).map(([key,value]) => [key, permitted.has(key) ? value : 0])) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const parsed = seenSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Geçersiz kaynak." }, { status: 400 });
  const auth = await requireAdmin(["owner","moderator","support"]); if (auth instanceof NextResponse) return auth;
  const { error } = await auth.admin.from("admin_resource_reads").upsert({ admin_user_id: auth.user.id, resource: parsed.data.resource, seen_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Bildirim durumu kaydedilemedi." }, { status: 503 });
  return NextResponse.json({ updated: true });
}
