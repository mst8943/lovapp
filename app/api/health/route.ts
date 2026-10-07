import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public liveness probe for uptime monitors and load balancers: no secrets, no member data.
export async function GET() {
  const admin = createAdminClient();
  let database: "ok" | "down" | "unconfigured" = "unconfigured";
  if (admin) {
    try {
      const result = await Promise.race([
        admin.from("profiles").select("id", { head: true, count: "estimated" }).limit(1),
        new Promise<{ error: Error }>((resolve) => setTimeout(() => resolve({ error: new Error("timeout") }), 4000)),
      ]);
      database = result.error ? "down" : "ok";
    } catch { database = "down"; }
  }
  const healthy = database !== "down";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", database, time: new Date().toISOString() }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
