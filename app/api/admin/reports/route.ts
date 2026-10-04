import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const schema = z.object({ reportId: z.string().uuid(), status: z.enum(["reviewing","resolved","rejected"]), resolution: z.string().trim().max(1000).optional() });

export async function GET() {
  const auth = await requireAdmin(["owner", "moderator"]); if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("reports").select("id,reason,details,status,match_id,created_at,reviewed_at,reporter:profiles!reports_reporter_id_fkey(id,display_name),reported:profiles!reports_reported_id_fkey(id,display_name)").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Şikâyetler yüklenemedi." }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "İşlem bilgilerini kontrol edin." }, { status: 400 });
  const auth = await requireAdmin(["owner", "moderator"]); if (auth instanceof NextResponse) return auth;
  const { error } = await auth.admin.from("reports").update({ status: parsed.data.status, resolution: parsed.data.resolution ?? null, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() }).eq("id", parsed.data.reportId);
  if (error) return NextResponse.json({ error: "Şikâyet güncellenemedi." }, { status: 500 });
  await auth.session.rpc("write_admin_audit", { event_action: "report.status.updated", event_target_type: "report", event_target_id: parsed.data.reportId, event_metadata: { status: parsed.data.status } });
  return NextResponse.json({ updated: true });
}
