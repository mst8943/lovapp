import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const responseSchema = z.object({ eventId: z.string().uuid(), attend: z.boolean() });

export async function GET() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle();
  if (profileError || !profile) return NextResponse.json({ error: "Profil gerekli." }, { status: 403 });
  const { data: events, error } = await admin.from("community_events")
    .select("id,title,description,city,venue,starts_at,ends_at,capacity,status")
    .in("status", ["published", "cancelled"])
    .gte("ends_at", new Date().toISOString()).order("starts_at").limit(20);
  if (error) return NextResponse.json({ error: "Etkinlikler yüklenemedi." }, { status: 503 });
  const ids = (events ?? []).map((event) => event.id);
  const [mine, ...counts] = await Promise.all([
    ids.length ? admin.from("community_event_rsvps").select("event_id,status").eq("profile_id", profile.id).in("event_id", ids) : Promise.resolve({ data: [], error: null }),
    ...(events ?? []).map((event) => admin.from("community_event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "going")),
  ]);
  if (mine.error || counts.some((count) => count.error || count.count === null))
    return NextResponse.json({ error: "Katılım bilgisi yüklenemedi." }, { status: 503 });
  const attending = new Set((mine.data ?? []).filter((row) => row.status === "going").map((row) => row.event_id));
  return NextResponse.json({ events: (events ?? []).map((event, index) => ({ ...event, goingCount: counts[index].count ?? 0, attending: attending.has(event.id) })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Katılım seçimini kontrol edin." }, { status: 400 });
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { error } = await session.rpc("respond_to_community_event", { event_uuid: parsed.data.eventId, attend: parsed.data.attend });
  if (error) {
    const code = error.message.includes("event_full") ? "Etkinlik kontenjanı doldu."
      : error.message.includes("event_unavailable") ? "Etkinlik artık katılıma açık değil."
      : error.message.includes("profile_required") ? "Katılmadan önce profilini tamamla."
      : "Katılım kaydedilemedi.";
    return NextResponse.json({ error: code }, { status: error.message.includes("event_full") ? 409 : 503 });
  }
  return NextResponse.json({ attending: parsed.data.attend }, { headers: { "Cache-Control": "private, no-store" } });
}
