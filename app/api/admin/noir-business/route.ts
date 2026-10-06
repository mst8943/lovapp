import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const planSchema = z.object({
  action: z.literal("plan"), id: z.string().uuid(), name: z.string().trim().min(2).max(80),
  priceAmount: z.number().min(1).max(100000), isActive: z.boolean(),
});
const couponFields = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/),
  label: z.string().trim().min(2).max(120),
  planSlug: z.string().trim().min(2).max(80),
  discountPercent: z.number().int().min(1).max(90),
  maxRedemptions: z.number().int().min(1).max(100000).nullable(),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
}).refine((coupon) => !coupon.startsAt || !coupon.endsAt || coupon.endsAt > coupon.startsAt, "Bitiş başlangıçtan sonra olmalı.");

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const [plans, coupons, revenue] = await Promise.all([
    auth.admin.from("premium_plans").select("id,slug,name,duration_days,duration_minutes,price_amount,currency,is_active").order("duration_days"),
    auth.admin.from("noir_coupon_offers").select("id,code,label,plan_slug,discount_percent,max_redemptions,starts_at,ends_at,is_active,created_at").order("created_at", { ascending: false }),
    auth.admin.rpc("admin_noir_revenue_summary"),
  ]);
  if (plans.error || coupons.error || revenue.error) return NextResponse.json({ error: "Noir iş verileri yüklenemedi." }, { status: 503 });
  return NextResponse.json({ plans: plans.data ?? [], coupons: coupons.data ?? [], revenue: revenue.data ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  if (body?.action === "coupon") {
    const id = z.string().uuid().safeParse(body.id);
    const parsed = couponFields.safeParse(body);
    if (!id.success || !parsed.success) return NextResponse.json({ error: "Kupon taslağını kontrol edin." }, { status: 400 });
    const coupon = parsed.data;
    const { data, error } = await auth.admin.from("noir_coupon_offers").update({
      code: coupon.code, label: coupon.label, plan_slug: coupon.planSlug,
      discount_percent: coupon.discountPercent, max_redemptions: coupon.maxRedemptions,
      starts_at: coupon.startsAt, ends_at: coupon.endsAt, is_active: false,
      updated_at: new Date().toISOString(),
    }).eq("id", id.data).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Bu kupon kodu zaten var." : "Kupon taslağı güncellenemedi." }, { status: 400 });
    await auth.session.rpc("write_admin_audit", { event_action: "noir.coupon.updated", event_target_type: "noir_coupon_offer", event_target_id: data.id, event_metadata: { code: coupon.code } });
    return NextResponse.json({ updated: true });
  }
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Paket bilgilerini kontrol edin." }, { status: 400 });
  const { data: plan, error: lookupError } = await auth.admin.from("premium_plans").select("id,slug,currency").eq("id", parsed.data.id).maybeSingle();
  if (lookupError || !plan) return NextResponse.json({ error: "Paket bulunamadı." }, { status: 404 });
  const { error } = await auth.admin.from("premium_plans").update({ name: parsed.data.name, price_amount: parsed.data.priceAmount, is_active: parsed.data.isActive, updated_at: new Date().toISOString() }).eq("id", plan.id);
  if (error) return NextResponse.json({ error: "Paket güncellenemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "noir.plan.updated", event_target_type: "premium_plan", event_target_id: plan.id, event_metadata: { slug: plan.slug, priceAmount: parsed.data.priceAmount, isActive: parsed.data.isActive } });
  return NextResponse.json({ updated: true, cardCheckoutMayNeedUpdate: plan.slug === "noir-weekly" || plan.slug === "noir-monthly" });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = couponFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Kupon taslağını kontrol edin." }, { status: 400 });
  const coupon = parsed.data;
  const { data: plan } = await auth.admin.from("premium_plans").select("slug").eq("slug", coupon.planSlug).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Paket bulunamadı." }, { status: 404 });
  const { data, error } = await auth.admin.from("noir_coupon_offers").insert({
    code: coupon.code, label: coupon.label, plan_slug: coupon.planSlug,
    discount_percent: coupon.discountPercent, max_redemptions: coupon.maxRedemptions,
    starts_at: coupon.startsAt, ends_at: coupon.endsAt, is_active: false, created_by: auth.user.id,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Bu kupon kodu zaten var." : "Kupon taslağı kaydedilemedi." }, { status: 400 });
  await auth.session.rpc("write_admin_audit", { event_action: "noir.coupon.drafted", event_target_type: "noir_coupon_offer", event_target_id: data.id, event_metadata: { code: coupon.code, planSlug: coupon.planSlug } });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
