import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const DAYS = 14;
const DAY = 86_400_000;
const dayKey = (value: string | number | Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date(value));

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const since = new Date(Date.now() - DAYS * DAY).toISOString();
  const labels = Array.from({ length: DAYS }, (_, index) => dayKey(Date.now() - (DAYS - 1 - index) * DAY));
  const bucket = (rows: { created_at: string }[] | null) => {
    const counts = new Map(labels.map((label) => [label, 0]));
    for (const row of rows ?? []) { const key = dayKey(row.created_at); if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1); }
    return labels.map((label) => counts.get(label) ?? 0);
  };
  const [signups, matches, messages, payments] = await Promise.all([
    auth.admin.from("profiles").select("created_at").eq("kind", "human").gte("created_at", since).limit(20000),
    auth.admin.from("matches").select("created_at:matched_at").gte("matched_at", since).limit(20000),
    auth.admin.from("messages").select("created_at").gte("created_at", since).limit(50000),
    auth.admin.from("payment_orders").select("created_at").eq("status", "approved").gte("created_at", since).limit(20000),
  ]);
  if ([signups, matches, messages, payments].some((result) => result.error)) return NextResponse.json({ error: "Trendler yüklenemedi." }, { status: 503 });
  return NextResponse.json({
    labels,
    series: [
      { key: "signups", label: "Yeni üye", values: bucket(signups.data) },
      { key: "matches", label: "Eşleşme", values: bucket(matches.data as { created_at: string }[] | null) },
      { key: "messages", label: "Mesaj", values: bucket(messages.data) },
      { key: "payments", label: "Onaylı ödeme", values: bucket(payments.data) },
    ],
  }, { headers: { "Cache-Control": "private, max-age=60" } });
}
