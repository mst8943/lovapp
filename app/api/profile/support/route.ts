import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifyHermes } from "@/lib/hermes-notifications";

const createSchema = z.object({ subject: z.string().trim().min(3).max(120), category: z.enum(["account","payment","safety","technical","other"]), message: z.string().trim().min(5).max(4000) });
const replySchema = z.object({ ticketId: z.string().uuid(), message: z.string().trim().min(1).max(4000) });

async function context() {
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return null;
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile ? { admin, profile } : null;
}

export async function GET() {
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: tickets, error } = await auth.admin.from("support_tickets").select("id,subject,category,status,priority,last_message_at,created_at,support_ticket_messages(id,body,sender_admin_id,created_at)").eq("profile_id", auth.profile.id).order("last_message_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Destek talepleri yüklenemedi." }, { status: 503 });
  return NextResponse.json({ tickets: tickets ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Konu ve mesaj alanlarını kontrol et." }, { status: 400 });
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { count } = await auth.admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("profile_id", auth.profile.id).neq("status", "closed");
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "Aynı anda en fazla 5 açık talebin olabilir." }, { status: 409 });
  const { data: ticket, error } = await auth.admin.from("support_tickets").insert({ profile_id: auth.profile.id, subject: parsed.data.subject, category: parsed.data.category }).select("id,subject,category,status,priority,last_message_at,created_at").single();
  if (error || !ticket) return NextResponse.json({ error: "Destek talebi açılamadı." }, { status: 503 });
  const { error: messageError } = await auth.admin.from("support_ticket_messages").insert({ ticket_id: ticket.id, sender_profile_id: auth.profile.id, body: parsed.data.message });
  if (messageError) { await auth.admin.from("support_tickets").delete().eq("id", ticket.id); return NextResponse.json({ error: "Destek mesajı kaydedilemedi." }, { status: 503 }); }
  await notifyHermes({ title: "Yeni destek talebi", fields: { ticketId: ticket.id, subject: ticket.subject, category: ticket.category, message: parsed.data.message.slice(0, 500) } });
  return NextResponse.json({ ticket: { ...ticket, support_ticket_messages: [{ body: parsed.data.message, sender_admin_id: null, created_at: new Date().toISOString() }] } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yanıtı kontrol et." }, { status: 400 });
  const auth = await context();
  if (!auth) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: ticket } = await auth.admin.from("support_tickets").select("id,status").eq("id", parsed.data.ticketId).eq("profile_id", auth.profile.id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  if (ticket.status === "closed") return NextResponse.json({ error: "Kapanan talebe mesaj eklenemez." }, { status: 409 });
  const now = new Date().toISOString();
  const { error } = await auth.admin.from("support_ticket_messages").insert({ ticket_id: ticket.id, sender_profile_id: auth.profile.id, body: parsed.data.message });
  if (error) return NextResponse.json({ error: "Yanıt gönderilemedi." }, { status: 503 });
  await auth.admin.from("support_tickets").update({ status: "open", last_message_at: now, updated_at: now }).eq("id", ticket.id);
  await notifyHermes({ title: "Destek talebine yeni yanıt", fields: { ticketId: ticket.id, message: parsed.data.message.slice(0, 500) } });
  return NextResponse.json({ sent: true });
}
