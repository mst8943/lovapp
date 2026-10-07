import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const schema = z.object({ quietHoursEnabled: z.boolean(), quietStart: time, quietEnd: time, timezone: z.string().trim().min(1).max(80) });

export async function GET() {
  const context = await profileContext();
  if (context instanceof NextResponse) return context;
  const read = (columns: string) => context.admin.from("notification_preferences").select(columns).eq("profile_id", context.profileId).maybeSingle();
  let { data } = await read("quiet_hours_enabled,quiet_start,quiet_end,timezone,daily_bulletin");
  // Databases without migration 077 do not have the bulletin column yet.
  if (!data) ({ data } = await read("quiet_hours_enabled,quiet_start,quiet_end,timezone"));
  return NextResponse.json({ preferences: { quiet_hours_enabled: true, quiet_start: "23:00", quiet_end: "09:00", timezone: "Europe/Istanbul", daily_bulletin: true, ...(data as object | null) } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const context = await profileContext();
  if (context instanceof NextResponse) return context;
  const raw = await request.json().catch(() => null);
  const bulletin = z.object({ dailyBulletin: z.boolean() }).safeParse(raw);
  if (bulletin.success) {
    const { error } = await context.admin.from("notification_preferences").upsert({ profile_id: context.profileId, daily_bulletin: bulletin.data.dailyBulletin, updated_at: new Date().toISOString() });
    return error ? NextResponse.json({ error: "Bülten tercihi kaydedilemedi." }, { status: 503 }) : NextResponse.json({ saved: true });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Sessiz saat ayarları geçersiz." }, { status: 400 });
  const { error } = await context.admin.from("notification_preferences").upsert({ profile_id: context.profileId, quiet_hours_enabled: parsed.data.quietHoursEnabled, quiet_start: parsed.data.quietStart, quiet_end: parsed.data.quietEnd, timezone: parsed.data.timezone, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ saved: true });
}

async function profileContext() {
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  return { admin, profileId: profile.id };
}
