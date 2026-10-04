import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifyHermes } from "@/lib/hermes-notifications";

export const runtime = "nodejs";
const ALLOWED = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"]]);
const submissionSchema = z.object({
  orderId: z.string().uuid(),
  senderFullName: z.string().trim().min(3).max(120),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  externalReference: z.string().trim().max(160).optional().default(""),
});

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const form = await request.formData();
  const parsed = submissionSchema.safeParse({ orderId: form.get("orderId"), senderFullName: form.get("senderFullName"), paymentDate: form.get("paymentDate"), externalReference: form.get("externalReference") });
  if (!parsed.success) return NextResponse.json({ error: "Ad, ödeme tarihi ve sipariş numarasını kontrol edin." }, { status: 400 });
  const proofValue = form.get("proof");
  const proof = proofValue instanceof File && proofValue.size > 0 ? proofValue : null;
  const extension = proof ? ALLOWED.get(proof.type) : null;
  if (proof && (!extension || proof.size > 5 * 1024 * 1024)) return NextResponse.json({ error: "Opsiyonel dekont JPG, PNG, WebP veya PDF ve en fazla 5 MB olmalı." }, { status: 400 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const { data: order } = await admin.from("payment_orders").select("id,status,profile_id,provider").eq("id", parsed.data.orderId).eq("profile_id", profile.id).in("provider", ["bank_transfer", "papara", "crypto", "shopier"]).in("status", ["awaiting_payment", "pending"]).maybeSingle();
  if (!order) return NextResponse.json({ error: "Bu ödeme bildirimi artık gönderilemez." }, { status: 409 });
  if (order.provider === "shopier" && parsed.data.externalReference.length < 4) return NextResponse.json({ error: "Shopier sipariş numarasını yazın." }, { status: 400 });
  const path = proof && extension ? `${profile.id}/${order.id}/${randomUUID()}.${extension}` : null;
  if (proof && path) {
    const { error: uploadError } = await admin.storage.from("payment-proofs").upload(path, Buffer.from(await proof.arrayBuffer()), { contentType: proof.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "Dekont güvenli alana yüklenemedi." }, { status: 500 });
  }
  const { error } = await session.rpc("submit_manual_payment", { order_uuid: order.id, sender_name: parsed.data.senderFullName, paid_on: parsed.data.paymentDate, provider_reference: parsed.data.externalReference || null, object_path: path });
  if (error) {
    if (path) await admin.storage.from("payment-proofs").remove([path]);
    return NextResponse.json({ error: "Ödeme bildirimi kaydedilemedi." }, { status: 409 });
  }
  await notifyHermes({ title: "Yeni ödeme bildirimi", fields: { orderId: order.id, provider: order.provider, shopierOrderNumber: parsed.data.externalReference || undefined } });
  return NextResponse.json({ submitted: true, proofUploaded: Boolean(path) });
}
