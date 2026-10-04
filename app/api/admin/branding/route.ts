import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { defaultBrandSettings } from "@/lib/branding";

const schema = z.object({
  brandName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(1).max(160),
  supportEmail: z.string().trim().email().max(320),
  logoUrl: z.string().trim().min(1).max(2048).refine((value) => value.startsWith("/") || /^https:\/\//i.test(value), "Logo adresi https:// veya / ile başlamalı."),
});

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const { data } = await auth.admin.from("brand_settings").select("brand_name,tagline,support_email,logo_url").eq("id", true).maybeSingle();
  return NextResponse.json(data ?? defaultBrandSettings, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Marka ayarları geçersiz." }, { status: 400 });
  const values = parsed.data;
  const { data, error } = await auth.admin.from("brand_settings").upsert({ id: true, brand_name: values.brandName, tagline: values.tagline, support_email: values.supportEmail, logo_url: values.logoUrl, updated_by: auth.user.id, updated_at: new Date().toISOString() }).select("brand_name,tagline,support_email,logo_url").single();
  if (error) return NextResponse.json({ error: "Marka ayarları kaydedilemedi." }, { status: 500 });
  const audit = await auth.session.rpc("write_admin_audit", { event_action: "branding.updated", event_target_type: "brand_settings", event_target_id: "global", event_metadata: { brandName: values.brandName } });
  if (audit.error) return NextResponse.json({ error: "Marka ayarları kaydedildi fakat denetim kaydı oluşturulamadı." }, { status: 503 });
  return NextResponse.json(data);
}
