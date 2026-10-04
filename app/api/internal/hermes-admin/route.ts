import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("support_list") }),
  z.object({ action: z.literal("support_detail"), ticketId: z.string().uuid() }),
  z.object({ action: z.literal("payment_list") }),
  z.object({ action: z.literal("support_reply"), ticketId: z.string().uuid(), reply: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("payment_approve"), orderId: z.string().uuid(), shopierOrderNumber: z.string().trim().min(4).max(160), amount: z.number().positive() }),
]);

export async function POST(request: Request) {
  if (request.headers.get("host")?.split(":")[0] !== "127.0.0.1")
    return NextResponse.json({ error: "Yerel bağlantı gerekli." }, { status: 403 });
  const secret = process.env.HERMES_NOTIFIER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Komut bilgileri geçersiz." }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Veritabanı kullanılamıyor." }, { status: 503 });

  if (parsed.data.action === "support_list") {
    const { data, error } = await admin.from("support_tickets")
      .select("id,subject,status,priority,last_message_at,profiles(display_name)")
      .neq("status", "closed").order("last_message_at", { ascending: false }).limit(8);
    if (error) return NextResponse.json({ error: "Destek kuyruğu okunamadı." }, { status: 503 });
    return NextResponse.json({ tickets: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  if (parsed.data.action === "support_detail") {
    const [ticket, messages] = await Promise.all([
      admin.from("support_tickets").select("id,subject,status,priority,profiles(display_name)").eq("id", parsed.data.ticketId).maybeSingle(),
      admin.from("support_ticket_messages").select("body,sender_profile_id,created_at").eq("ticket_id", parsed.data.ticketId).order("created_at", { ascending: false }).limit(8),
    ]);
    if (ticket.error || messages.error || !ticket.data) return NextResponse.json({ error: "Talep okunamadı." }, { status: 404 });
    return NextResponse.json({ ticket: ticket.data, messages: (messages.data ?? []).reverse() }, { headers: { "Cache-Control": "no-store" } });
  }

  if (parsed.data.action === "payment_list") {
    const { data, error } = await admin.from("payment_orders")
      .select("id,amount,currency,provider,status,external_reference,submitted_at,premium_plans(name),profiles(display_name)")
      .eq("status", "under_review").order("submitted_at", { ascending: true }).limit(8);
    if (error) return NextResponse.json({ error: "Ödeme kuyruğu okunamadı." }, { status: 503 });
    return NextResponse.json({ orders: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: owner, error: ownerError } = await admin.from("admin_users")
    .select("user_id").eq("role", "owner").order("created_at").limit(1).maybeSingle();
  if (ownerError || !owner) return NextResponse.json({ error: "Yönetici bulunamadı." }, { status: 503 });

  if (parsed.data.action === "support_reply") {
    const { data: ticket } = await admin.from("support_tickets").select("id,status").eq("id", parsed.data.ticketId).maybeSingle();
    if (!ticket || ticket.status === "closed") return NextResponse.json({ error: "Açık talep bulunamadı." }, { status: 409 });
    const now = new Date().toISOString();
    const { error: messageError } = await admin.from("support_ticket_messages").insert({ ticket_id: ticket.id, sender_admin_id: owner.user_id, body: parsed.data.reply });
    if (messageError) return NextResponse.json({ error: "Yanıt kaydedilemedi." }, { status: 503 });
    const { error: ticketError } = await admin.from("support_tickets").update({ status: "waiting", assigned_to: owner.user_id, last_message_at: now, updated_at: now }).eq("id", ticket.id);
    if (ticketError) return NextResponse.json({ error: "Yanıt kaydedildi ancak talep durumu güncellenemedi." }, { status: 503 });
    await admin.from("admin_audit_log").insert({ actor_user_id: owner.user_id, action: "support.ticket.replied.telegram", target_type: "support_ticket", target_id: ticket.id, metadata: {} });
    return NextResponse.json({ sent: true });
  }

  const { data, error } = await admin.rpc("approve_noir_payment_telegram", {
    order_uuid: parsed.data.orderId,
    shopier_order_number: parsed.data.shopierOrderNumber,
    verified_amount: parsed.data.amount,
  });
  if (error) return NextResponse.json({ error: "Onay yapılamadı. Sipariş durumu, Shopier numarası ve tutarı kontrol et." }, { status: 409 });
  return NextResponse.json({ approved: true, noirUntil: data });
}
