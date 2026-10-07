import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeTurkishMobile } from "@/lib/application-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  venue: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime({ offset: true }),
  expectedEndAt: z.string().datetime({ offset: true }),
  emergencyContactName: z.string().trim().max(80).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({ id: z.string().uuid(), action: z.literal("checkin") }),
  z.object({ id: z.string().uuid(), action: z.literal("cancel") }),
  z.object({ id: z.string().uuid(), action: z.literal("safe") }),
  z.object({ id: z.string().uuid(), action: z.literal("complete"), rating: z.number().int().min(1).max(5), note: z.string().trim().max(500).optional() }),
]);

async function context() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle();
  return profile ? { admin, profileId: profile.id } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  const legacyColumns = "id,venue,city,starts_at,expected_end_at,status,checked_in_at,feedback_rating,feedback_note";
  const query = (columns: string) => ctx.admin.from("private_date_plans").select(columns).eq("profile_id", ctx.profileId).order("starts_at", { ascending: false }).limit(20);
  let { data, error } = await query(`${legacyColumns},emergency_contact_name,emergency_contact_phone,safety_prompted_at,safe_confirmed_at,emergency_notified_at`);
  // Databases that have not applied migration 077 yet keep working without the safety fields.
  if (error) ({ data, error } = await query(legacyColumns));
  if (error) return NextResponse.json({ error: "Buluşma planları yüklenemedi." }, { status: 503 });
  const plans = ((data ?? []) as unknown as Record<string, unknown>[]).map(({ emergency_contact_phone, ...plan }) => ({ ...plan, emergency_contact_masked: emergency_contact_phone ? `•••• ${String(emergency_contact_phone).slice(-4)}` : null }));
  return NextResponse.json({ plans }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Plan bilgilerini kontrol edin." }, { status: 400 });
  const starts = Date.parse(parsed.data.startsAt), ends = Date.parse(parsed.data.expectedEndAt);
  if (starts < Date.now() - 3_600_000 || starts > Date.now() + 90 * 86_400_000 || ends <= starts || ends > starts + 7 * 86_400_000)
    return NextResponse.json({ error: "Geçerli bir başlangıç ve bitiş zamanı seçin." }, { status: 400 });
  const contactPhone = parsed.data.emergencyContactPhone ? normalizeTurkishMobile(parsed.data.emergencyContactPhone) : null;
  if (parsed.data.emergencyContactPhone && !contactPhone) return NextResponse.json({ error: "Acil durum kişisi için geçerli bir cep telefonu yaz (05xx xxx xx xx)." }, { status: 400 });
  if (contactPhone && !parsed.data.emergencyContactName) return NextResponse.json({ error: "Acil durum kişisinin adını da yaz." }, { status: 400 });
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  const { count, error: countError } = await ctx.admin.from("private_date_plans").select("id", { count: "exact", head: true })
    .eq("profile_id", ctx.profileId).in("status", ["scheduled", "checked_in"]).gt("expected_end_at", new Date().toISOString());
  if (countError || count === null) return NextResponse.json({ error: "Plan sınırı kontrol edilemedi." }, { status: 503 });
  if (count >= 3) return NextResponse.json({ error: "Aynı anda en fazla üç açık plan kaydedilebilir." }, { status: 409 });
  const { data, error } = await ctx.admin.from("private_date_plans").insert({
    profile_id: ctx.profileId, venue: parsed.data.venue, city: parsed.data.city,
    starts_at: parsed.data.startsAt, expected_end_at: parsed.data.expectedEndAt,
    ...(contactPhone ? { emergency_contact_name: parsed.data.emergencyContactName, emergency_contact_phone: contactPhone } : {}),
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Plan kaydedilemedi." }, { status: 503 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "İşlemi kontrol edin." }, { status: 400 });
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });
  const { data: plan, error: lookupError } = await ctx.admin.from("private_date_plans")
    .select("id,status,starts_at").eq("id", parsed.data.id).eq("profile_id", ctx.profileId).maybeSingle();
  if (lookupError || !plan) return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });
  if (!["scheduled", "checked_in"].includes(plan.status))
    return NextResponse.json({ error: "Bu plan artık değiştirilemez." }, { status: 409 });
  if (parsed.data.action === "checkin" && plan.status !== "scheduled")
    return NextResponse.json({ error: "Güvenli durum zaten kaydedildi." }, { status: 409 });
  if (parsed.data.action === "complete" && Date.parse(plan.starts_at) > Date.now())
    return NextResponse.json({ error: "Geri bildirim buluşma başladıktan sonra verilebilir." }, { status: 409 });
  const update = parsed.data.action === "safe" ? { status: plan.status === "scheduled" ? "checked_in" : plan.status, checked_in_at: new Date().toISOString(), safe_confirmed_at: new Date().toISOString() }
    : parsed.data.action === "checkin" ? { status: "checked_in", checked_in_at: new Date().toISOString() }
    : parsed.data.action === "cancel" ? { status: "cancelled" }
    : { status: "completed", feedback_rating: parsed.data.rating, feedback_note: parsed.data.note ?? null };
  const { data: changed, error } = await ctx.admin.from("private_date_plans")
    .update({ ...update, updated_at: new Date().toISOString() }).eq("id", plan.id).eq("status", plan.status).select("id").maybeSingle();
  if (error || !changed) return NextResponse.json({ error: "Plan eşzamanlı değişti; yenileyip tekrar deneyin." }, { status: 409 });
  return NextResponse.json({ updated: true });
}
