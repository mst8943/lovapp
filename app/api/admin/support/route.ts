import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const schema = z.object({ ticketId: z.string().uuid(), status: z.enum(["open","waiting","in_progress","closed"]), priority: z.enum(["low","normal","high","urgent"]).optional(), reply: z.string().trim().max(4000).optional() });

export async function GET() {
  const auth = await requireAdmin(["owner","support"]); if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("support_tickets").select("id,subject,category,status,priority,assigned_to,last_message_at,closed_at,created_at,profiles(id,display_name),support_ticket_messages(id,body,sender_profile_id,sender_admin_id,created_at)").order("last_message_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: "Destek talepleri yüklenemedi." }, { status: 503 });
  return NextResponse.json({ tickets: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Destek işlemini kontrol edin." }, { status: 400 });
  const auth = await requireAdmin(["owner","support"]); if (auth instanceof NextResponse) return auth;
  const now = new Date().toISOString();
  if (parsed.data.reply) {
    const { error } = await auth.admin.from("support_ticket_messages").insert({ ticket_id: parsed.data.ticketId, sender_admin_id: auth.user.id, body: parsed.data.reply });
    if (error) return NextResponse.json({ error: "Destek yanıtı kaydedilemedi." }, { status: 503 });
  }
  const { error } = await auth.admin.from("support_tickets").update({ status: parsed.data.status, priority: parsed.data.priority, assigned_to: auth.user.id, closed_at: parsed.data.status === "closed" ? now : null, last_message_at: parsed.data.reply ? now : undefined, updated_at: now }).eq("id", parsed.data.ticketId);
  if (error) return NextResponse.json({ error: "Talep durumu güncellenemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "support.ticket.updated", event_target_type: "support_ticket", event_target_id: parsed.data.ticketId, event_metadata: { status: parsed.data.status, replied: Boolean(parsed.data.reply) } });
  return NextResponse.json({ updated: true });
}

