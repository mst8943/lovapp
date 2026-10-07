import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

type Event = { at: string; kind: string; title: string; detail?: string };

export async function GET(_: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin(["owner", "support", "moderator"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  if (!z.string().uuid().safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const canSeeMoney = auth.role === "owner" || auth.role === "support";
  const [profile, matches, reportsAgainst, reportsBy, tickets, orders, photos, deletion, presence] = await Promise.all([
    auth.admin.from("profiles").select("created_at,onboarding_completed").eq("id", profileId).eq("kind", "human").maybeSingle(),
    auth.admin.from("matches").select("matched_at,status").or(`user_a.eq.${profileId},user_b.eq.${profileId}`).order("matched_at", { ascending: false }).limit(25),
    auth.admin.from("reports").select("created_at,reason,status").eq("reported_id", profileId).order("created_at", { ascending: false }).limit(15),
    auth.admin.from("reports").select("created_at,reason,status").eq("reporter_id", profileId).order("created_at", { ascending: false }).limit(15),
    auth.admin.from("support_tickets").select("created_at,subject,status").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(15),
    canSeeMoney ? auth.admin.from("payment_orders").select("created_at,amount,currency,status,provider").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(15) : Promise.resolve({ data: [] as { created_at: string; amount: number; currency: string; status: string; provider: string }[] }),
    auth.admin.from("profile_photos").select("created_at,moderation_status").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(15),
    auth.admin.from("account_deletion_requests").select("requested_at,scheduled_for,cancelled_at,completed_at").eq("profile_id", profileId).maybeSingle(),
    auth.admin.from("profile_presence").select("last_seen_at").eq("profile_id", profileId).maybeSingle(),
  ]);
  if (!profile.data) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const events: Event[] = [{ at: profile.data.created_at, kind: "account", title: "Hesap oluşturuldu", detail: profile.data.onboarding_completed ? "Profil tamamlandı" : "Profil henüz tamamlanmadı" }];
  for (const row of matches.data ?? []) events.push({ at: row.matched_at, kind: "match", title: "Eşleşme", detail: row.status === "active" ? undefined : `Durum: ${row.status}` });
  for (const row of reportsAgainst.data ?? []) events.push({ at: row.created_at, kind: "report", title: "Hakkında şikâyet", detail: `${row.reason} · ${row.status}` });
  for (const row of reportsBy.data ?? []) events.push({ at: row.created_at, kind: "report", title: "Şikâyet etti", detail: `${row.reason} · ${row.status}` });
  for (const row of tickets.data ?? []) events.push({ at: row.created_at, kind: "support", title: "Destek talebi", detail: `${row.subject} · ${row.status}` });
  for (const row of orders.data ?? []) events.push({ at: row.created_at, kind: "payment", title: "Ödeme siparişi", detail: `${Number(row.amount).toLocaleString("tr-TR")} ${row.currency} · ${row.provider} · ${row.status}` });
  for (const row of photos.data ?? []) events.push({ at: row.created_at, kind: "photo", title: "Fotoğraf yüklendi", detail: `Moderasyon: ${row.moderation_status}` });
  if (deletion.data) {
    events.push({ at: deletion.data.requested_at, kind: "deletion", title: "Hesap silme talebi", detail: `Planlanan: ${new Date(deletion.data.scheduled_for).toLocaleDateString("tr-TR")}` });
    if (deletion.data.cancelled_at) events.push({ at: deletion.data.cancelled_at, kind: "deletion", title: "Silme talebi geri alındı" });
  }
  if (presence.data?.last_seen_at) events.push({ at: presence.data.last_seen_at, kind: "presence", title: "Son görülme" });
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ events: events.slice(0, 60) }, { headers: { "Cache-Control": "private, no-store" } });
}
