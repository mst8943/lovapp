import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const eventBase = z.object({
  title: z.string().trim().min(4).max(100),
  description: z.string().trim().min(10).max(1000),
  city: z.string().trim().min(2).max(80),
  venue: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  capacity: z.number().int().min(2).max(500),
  status: z.enum(["draft", "published", "cancelled"]),
});
const eventFields = eventBase.refine((event) => Date.parse(event.endsAt) > Date.parse(event.startsAt), "Bitiş başlangıçtan sonra olmalı.");

export async function GET() {
  const auth = await requireAdmin(["owner", "moderator"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("community_events")
    .select("id,title,description,city,venue,starts_at,ends_at,capacity,status,created_at")
    .order("starts_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Etkinlikler yüklenemedi." }, { status: 503 });
  return NextResponse.json({ events: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = eventFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Etkinlik bilgilerini kontrol edin." }, { status: 400 });
  const event = parsed.data;
  if (event.status === "published" && Date.parse(event.startsAt) <= Date.now())
    return NextResponse.json({ error: "Geçmiş bir etkinlik yayımlanamaz." }, { status: 400 });
  const { data, error } = await auth.admin.from("community_events").insert({
    title: event.title, description: event.description, city: event.city, venue: event.venue,
    starts_at: event.startsAt, ends_at: event.endsAt, capacity: event.capacity,
    status: event.status, created_by: auth.user.id,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Etkinlik kaydedilemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "community.event.created", event_target_type: "community_event", event_target_id: data.id, event_metadata: { title: event.title, status: event.status } });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = eventBase.extend({ id: z.string().uuid() }).refine((event) => Date.parse(event.endsAt) > Date.parse(event.startsAt), "Bitiş başlangıçtan sonra olmalı.").safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Etkinlik bilgilerini kontrol edin." }, { status: 400 });
  const { data: existing, error: lookupError } = await auth.admin.from("community_events").select("id,title,description,city,venue,starts_at,ends_at,capacity,status").eq("id", parsed.data.id).maybeSingle();
  if (lookupError || !existing) return NextResponse.json({ error: "Etkinlik bulunamadı." }, { status: 404 });
  if (parsed.data.status === "published" && Date.parse(parsed.data.startsAt) <= Date.now())
    return NextResponse.json({ error: "Geçmiş bir etkinlik yayımlanamaz." }, { status: 400 });
  if (existing.status === "cancelled")
    return NextResponse.json({ error: "İptal edilen etkinlik yeniden düzenlenemez." }, { status: 409 });
  const { count, error: countError } = await auth.admin.from("community_event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", parsed.data.id).eq("status", "going");
  if (countError || count === null) return NextResponse.json({ error: "Katılım bilgisi alınamadı." }, { status: 503 });
  if (count > 0 && parsed.data.status === "draft") return NextResponse.json({ error: "Katılımcısı olan etkinlik taslağa alınamaz; iptal edin." }, { status: 409 });
  const detailsChanged = existing.title !== parsed.data.title || existing.description !== parsed.data.description
    || existing.city !== parsed.data.city || existing.venue !== parsed.data.venue
    || Date.parse(existing.starts_at) !== Date.parse(parsed.data.startsAt)
    || Date.parse(existing.ends_at) !== Date.parse(parsed.data.endsAt)
    || existing.capacity !== parsed.data.capacity;
  if (count > 0 && detailsChanged) return NextResponse.json({ error: "Katılım başladıktan sonra etkinlik ayrıntıları değiştirilemez; gerekiyorsa iptal edin." }, { status: 409 });
  const { error } = await auth.admin.from("community_events").update({
    title: parsed.data.title, description: parsed.data.description, city: parsed.data.city, venue: parsed.data.venue,
    starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt, capacity: parsed.data.capacity,
    status: parsed.data.status, updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "Etkinlik güncellenemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "community.event.status", event_target_type: "community_event", event_target_id: parsed.data.id, event_metadata: { from: existing.status, to: parsed.data.status } });
  return NextResponse.json({ updated: true });
}
