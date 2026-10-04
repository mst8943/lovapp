import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const visibilitySchema = z.object({ discoverable: z.boolean().optional(), ghostEnabled: z.boolean().optional() })
  .refine((value) => Number(value.discoverable !== undefined) + Number(value.ghostEnabled !== undefined) === 1);

export async function GET() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı gerekli." }, { status: 503 });
  const [profile, deletion] = await Promise.all([
    admin.from("profiles").select("id,is_discoverable,ghost_enabled,xp,level").eq("user_id", user.id).eq("kind", "human").maybeSingle(),
    admin.from("account_deletion_requests").select("scheduled_for,cancelled_at,completed_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile.error || deletion.error) return NextResponse.json({ error: "Hesap durumu yüklenemedi." }, { status: 503 });
  const entitlement = profile.data?.id ? await admin.from("user_entitlements").select("noir_until").eq("profile_id", profile.data.id).maybeSingle() : { data: null, error: null };
  if (entitlement.error) return NextResponse.json({ error: "Hesap durumu yüklenemedi." }, { status: 503 });
  const ghostAvailable = Boolean(entitlement.data?.noir_until && new Date(entitlement.data.noir_until) > new Date());
  return NextResponse.json({ profile: profile.data, deletion: deletion.data, ghostAvailable }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await session.rpc("cancel_account_deletion");
  if (error) return NextResponse.json({ error: "Hesap kurtarılamadı." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Aktif kurtarılabilir silme talebi bulunamadı." }, { status: 409 });
  return NextResponse.json({ restored: true });
}

export async function PATCH(request: Request) {
  const parsed = visibilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Görünürlük seçimini kontrol et." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı gerekli." }, { status: 503 });
  if (parsed.data.ghostEnabled !== undefined) {
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
    if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
    const { data: entitlement } = await admin.from("user_entitlements").select("noir_until").eq("profile_id", profile.id).maybeSingle();
    if (parsed.data.ghostEnabled && (!entitlement?.noir_until || new Date(entitlement.noir_until) <= new Date())) return NextResponse.json({ error: "Hayalet Modu için Noir gerekli." }, { status: 403 });
    const { error } = await admin.from("profiles").update({ ghost_enabled: parsed.data.ghostEnabled, updated_at: new Date().toISOString() }).eq("id", profile.id);
    return error ? NextResponse.json({ error: "Hayalet Modu güncellenemedi." }, { status: 503 }) : NextResponse.json({ ghostEnabled: parsed.data.ghostEnabled });
  }
  if (parsed.data.discoverable) {
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
    if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
    const { count, error } = await admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("processing_status", "ready").eq("moderation_status", "approved");
    if (error) return NextResponse.json({ error: "Fotoğraflar kontrol edilemedi." }, { status: 503 });
    if ((count ?? 0) < 1) return NextResponse.json({ error: "Keşfette görünmek için en az bir onaylı fotoğraf gerekli." }, { status: 409 });
  }
  const { error } = await admin.from("profiles").update({ is_discoverable: parsed.data.discoverable, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("kind", "human");
  if (error) return NextResponse.json({ error: "Görünürlük güncellenemedi." }, { status: 503 });
  return NextResponse.json({ discoverable: parsed.data.discoverable });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  if (body?.confirmation !== "HESABIMI SİL") return NextResponse.json({ error: "Onay metni eşleşmedi." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await session.rpc("schedule_account_deletion");
  if (error) return NextResponse.json({ error: "Hesap silme talebi oluşturulamadı." }, { status: 503 });
  return NextResponse.json({ scheduledFor: data }, { status: 202 });
}
