import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_PAGE = 100;

export async function GET(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 60).replace(/[%_,()]/g, "") ?? "";
  const before = Number(params.get("before"));
  const PAGE = Math.min(MAX_PAGE, Math.max(1, Number(params.get("limit")) || MAX_PAGE));
  let query = auth.admin.from("admin_audit_log").select("id,actor_user_id,action,target_type,target_id,metadata,created_at").order("id", { ascending: false }).limit(PAGE + 1);
  if (q) query = query.ilike("action", `%${q}%`);
  if (Number.isFinite(before) && before > 0) query = query.lt("id", before);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "İşlem günlüğü yüklenemedi." }, { status: 500 });
  const rows = (data ?? []).slice(0, PAGE);
  const actorIds = [...new Set(rows.map((row) => row.actor_user_id as string))];
  const actors = await Promise.all(actorIds.map(async (id) => {
    const { data: found } = await auth.admin.auth.admin.getUserById(id);
    return [id, found.user?.email ?? id.slice(0, 8)] as const;
  }));
  const names = new Map(actors);
  return NextResponse.json({
    entries: rows.map((row) => ({ ...row, actor: names.get(row.actor_user_id as string) ?? "Bilinmiyor" })),
    hasMore: (data ?? []).length > PAGE,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
