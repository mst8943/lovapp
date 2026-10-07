import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { CREDIT_KEYS, sumBalances } from "@/lib/credits";

const idSchema = z.string().uuid();
const grantSchema = z.object({ kind: z.enum(CREDIT_KEYS), delta: z.number().int().min(-50).max(50).refine((value) => value !== 0), reason: z.string().trim().min(2).max(120) });

export async function GET(_: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  if (!idSchema.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const { data, error } = await auth.admin.from("credit_ledger").select("kind,delta,reason,created_at").eq("profile_id", profileId).order("id", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Kredi kayıtları yüklenemedi. 077 migration'ı uygulanmış mı?" }, { status: 503 });
  return NextResponse.json({ balances: sumBalances(data ?? []), history: (data ?? []).slice(0, 10) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  const parsed = grantSchema.safeParse(await request.json().catch(() => null));
  if (!idSchema.safeParse(profileId).success || !parsed.success) return NextResponse.json({ error: "Tür, miktar (-50 ile 50 arası) ve kısa bir neden gerekli." }, { status: 400 });
  const { data: profile } = await auth.admin.from("profiles").select("id").eq("id", profileId).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  const { data: existing } = await auth.admin.from("credit_ledger").select("kind,delta").eq("profile_id", profileId).eq("kind", parsed.data.kind).limit(5000);
  const balance = sumBalances(existing ?? [])[parsed.data.kind];
  if (balance + parsed.data.delta < 0) return NextResponse.json({ error: `Bakiye eksiye düşemez (mevcut: ${balance}).` }, { status: 409 });
  const { error } = await auth.admin.from("credit_ledger").insert({ profile_id: profileId, kind: parsed.data.kind, delta: parsed.data.delta, reason: parsed.data.reason, granted_by: auth.user.id });
  if (error) return NextResponse.json({ error: "Kredi kaydedilemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "credits.adjusted", event_target_type: "profile", event_target_id: profileId, event_metadata: parsed.data });
  return NextResponse.json({ ok: true }, { status: 201 });
}
