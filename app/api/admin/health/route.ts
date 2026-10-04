import { statfs } from "node:fs/promises";
import os from "node:os";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
const schema = z.object({ databaseLimitBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), storageLimitBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });

export async function GET() {
  const auth = await requireAdmin(["owner"]); if (auth instanceof NextResponse) return auth;
  const [snapshot, settings, failedPayments, disk] = await Promise.all([
    auth.admin.rpc("get_system_health_snapshot"),
    auth.admin.from("system_capacity_settings").select("database_limit_bytes,storage_limit_bytes,updated_at").eq("id", true).single(),
    auth.admin.from("payment_webhook_events").select("webhook_id", { count: "exact", head: true }).eq("status", "failed"),
    statfs(process.cwd()).catch(() => null),
  ]);
  if (snapshot.error || settings.error || failedPayments.error || failedPayments.count === null) return NextResponse.json({ error: "Sistem ölçümü alınamadı." }, { status: 503 });
  const memory = process.memoryUsage();
  const diskTotal = disk ? disk.blocks * disk.bsize : null; const diskFree = disk ? disk.bavail * disk.bsize : null;
  return NextResponse.json({ supabase: snapshot.data, failedPaymentWebhooks: failedPayments.count, limits: settings.data, server: { platform: process.env.VERCEL ? "Vercel Serverless" : `${os.platform()} ${os.release()}`, node: process.version, uptimeSeconds: Math.round(process.uptime()), diskTotalBytes: diskTotal, diskUsedBytes: diskTotal !== null && diskFree !== null ? diskTotal - diskFree : null, diskFreeBytes: diskFree, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, rssBytes: memory.rss, systemMemoryBytes: os.totalmem(), freeSystemMemoryBytes: os.freemem() }, measuredAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Kapasite sınırlarını kontrol edin." }, { status: 400 });
  const auth = await requireAdmin(["owner"]); if (auth instanceof NextResponse) return auth;
  const { error } = await auth.admin.from("system_capacity_settings").upsert({ id: true, database_limit_bytes: parsed.data.databaseLimitBytes, storage_limit_bytes: parsed.data.storageLimitBytes, updated_by: auth.user.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Kapasite sınırları kaydedilemedi." }, { status: 503 });
  const audit = await auth.session.rpc("write_admin_audit", { event_action: "system.capacity.updated", event_target_type: "system_capacity_settings", event_target_id: "global", event_metadata: parsed.data });
  if (audit.error) return NextResponse.json({ error: "Kapasite sınırları kaydedildi fakat denetim kaydı oluşturulamadı." }, { status: 503 });
  return NextResponse.json({ updated: true });
}
