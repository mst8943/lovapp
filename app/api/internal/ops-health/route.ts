import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyHermes } from "@/lib/hermes-notifications";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) {
    await notifyHermes({ title: "Lovask sistem sağlık kontrolü başarısız", dedupeKey: "health:error" });
    return NextResponse.json({ error: "Bağlantı yok." }, { status: 503 });
  }
  const [health, failed] = await Promise.all([
    admin.rpc("get_system_health_snapshot"),
    admin.from("payment_webhook_events").select("webhook_id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  if (health.error || failed.error || failed.count === null) {
    await notifyHermes({ title: "Lovask sistem sağlık kontrolü başarısız", dedupeKey: "health:error" });
    return NextResponse.json({ error: "Sağlık verisi alınamadı." }, { status: 503 });
  }
  if (failed.count > 0) await notifyHermes({ title: "Lovask sistem sağlık uyarısı", fields: { failedPaymentWebhooks: failed.count }, dedupeKey: "health:failed-webhooks" });
  const failedBotJobs = Number(health.data?.failedBotJobs ?? 0);
  if (failedBotJobs > 0) await notifyHermes({ title: "Lovask sistem sağlık uyarısı", fields: { failedBotJobs }, dedupeKey: "health:failed-bot-jobs" });
  return NextResponse.json({ measuredAt: new Date().toISOString(), failedPaymentWebhooks: failed.count, health: health.data }, { status: failed.count ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
