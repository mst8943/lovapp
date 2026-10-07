import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("account_deletion_requests").select("profile_id,requested_at,scheduled_for,cancelled_at,completed_at,attempt_count,last_error,profiles(display_name)").order("requested_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Silme talepleri yüklenemedi." }, { status: 503 });
  const now = Date.now();
  const rows = (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { display_name?: string } | null;
    const status = row.completed_at ? "completed" : row.cancelled_at ? "cancelled" : new Date(row.scheduled_for).getTime() <= now ? "due" : "pending";
    return { profileId: row.profile_id, name: profile?.display_name ?? "Üye", requestedAt: row.requested_at, scheduledFor: row.scheduled_for, status, attempts: row.attempt_count, lastError: row.last_error };
  });
  return NextResponse.json({ requests: rows }, { headers: { "Cache-Control": "private, no-store" } });
}
