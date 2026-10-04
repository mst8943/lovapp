import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchesPaymentTotal } from "@/lib/payment-total";

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature") ?? "";
  const digest = secret ? crypto.createHmac("sha256", secret).update(raw).digest("hex") : "";
  if (!secret || signature.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  let payload: { meta?: { event_name?: string; custom_data?: { order_id?: string } }; data?: { id?: string; attributes?: { store_id?: number; currency?: string; status?: string; total?: number; first_order_item?: { variant_id?: number; price?: number; quantity?: number } } } };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
  if (payload.meta?.event_name !== "order_created" || !payload.data?.id) return NextResponse.json({ ok: true });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const orderId = payload.meta.custom_data?.order_id;
  if (!orderId) return NextResponse.json({ ok: true });
  const { data: order } = await admin.from("payment_orders").select("amount,currency,provider_checkout_id,premium_plans(slug)").eq("id", orderId).eq("provider", "shopier").like("provider_checkout_id", "lemon:%").maybeSingle();
  const plan = order?.premium_plans as unknown as { slug?: string } | null;
  const expectedVariant = plan?.slug === "noir-hourly" ? process.env.LEMON_SQUEEZY_HOURLY_VARIANT_ID : plan?.slug === "noir-weekly" ? process.env.LEMON_SQUEEZY_WEEKLY_VARIANT_ID : plan?.slug === "noir-monthly" ? process.env.LEMON_SQUEEZY_MONTHLY_VARIANT_ID : undefined;
  const attributes = payload.data.attributes;
  const expectedAmount = Math.round(Number(order?.amount) * 100);
  if (!order || attributes?.status !== "paid" || attributes.store_id !== Number(process.env.LEMON_SQUEEZY_STORE_ID) || String(attributes.first_order_item?.variant_id) !== expectedVariant || attributes.first_order_item?.price !== expectedAmount || attributes.first_order_item?.quantity !== 1 || attributes.currency !== order.currency || !matchesPaymentTotal(attributes.total, expectedAmount)) return NextResponse.json({ error: "order_mismatch" }, { status: 422 });
  const result = await admin.rpc("approve_verified_shopier_payment", { order_uuid: orderId, shopier_order_id: `lemon:${payload.data.id}` });
  if (result.error) return NextResponse.json({ error: "payment_not_approved" }, { status: 422 });
  return NextResponse.json({ ok: true });
}
