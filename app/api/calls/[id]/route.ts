import { NextResponse } from "next/server";
import { z } from "zod";
import { isRingingFresh } from "@/lib/calls";
import { callContext, loadParticipantSession, unauthorized } from "@/lib/calls-server";

const idSchema = z.string().uuid();
const actionSchema = z.object({ action: z.enum(["accept", "decline", "cancel", "end"]) });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Geçersiz arama." }, { status: 400 });
  const ctx = await callContext();
  if (!ctx) return unauthorized();
  const session = await loadParticipantSession(ctx, id);
  if (!session) return NextResponse.json({ error: "Arama bulunamadı." }, { status: 404 });
  const peerId = session.caller_id === ctx.profileId ? session.callee_id : session.caller_id;
  const [{ data: peer }, { data: signals }] = await Promise.all([
    ctx.admin.from("profiles").select("display_name").eq("id", peerId).maybeSingle(),
    ctx.admin.from("call_signals").select("id,kind,payload").eq("session_id", id).eq("to_profile_id", ctx.profileId).order("id").limit(400),
  ]);
  return NextResponse.json({ session, role: session.caller_id === ctx.profileId ? "caller" : "callee", peerName: peer?.display_name ?? "Bir üye", signals: signals ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!idSchema.safeParse(id).success || !parsed.success) return NextResponse.json({ error: "İşlem geçersiz." }, { status: 400 });
  const ctx = await callContext();
  if (!ctx) return unauthorized();
  const session = await loadParticipantSession(ctx, id);
  if (!session) return NextResponse.json({ error: "Arama bulunamadı." }, { status: 404 });
  const isCaller = session.caller_id === ctx.profileId;
  const now = new Date().toISOString();

  let update: Record<string, unknown> | null = null;
  let expected: string | null = null;
  switch (parsed.data.action) {
    case "accept":
      if (isCaller) return NextResponse.json({ error: "Aramayı yalnızca aranan kişi kabul edebilir." }, { status: 403 });
      if (!isRingingFresh(session)) return NextResponse.json({ error: "Arama sona erdi." }, { status: 409 });
      expected = "ringing"; update = { status: "accepted", answered_at: now }; break;
    case "decline":
      if (isCaller) return NextResponse.json({ error: "Aramayı yalnızca aranan kişi reddedebilir." }, { status: 403 });
      expected = "ringing"; update = { status: "declined", ended_at: now }; break;
    case "cancel":
      if (!isCaller) return NextResponse.json({ error: "Aramayı yalnızca arayan kişi iptal edebilir." }, { status: 403 });
      expected = "ringing"; update = { status: "cancelled", ended_at: now }; break;
    case "end":
      if (session.status === "ringing") { expected = "ringing"; update = isCaller ? { status: "cancelled", ended_at: now } : { status: "declined", ended_at: now }; }
      else { expected = "accepted"; update = { status: "ended", ended_at: now }; }
      break;
  }
  if (session.status !== expected) {
    // Ending a call that is already over is a harmless repeat; anything else is a conflict.
    if (parsed.data.action === "end" || parsed.data.action === "cancel") return NextResponse.json({ session }, { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ error: "Arama durumu değişmiş.", session }, { status: 409 });
  }
  const { data: changed, error } = await ctx.admin.from("call_sessions").update(update).eq("id", id).eq("status", expected).select("id,match_id,caller_id,callee_id,kind,status,created_at,answered_at,ended_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Arama güncellenemedi." }, { status: 503 });
  if (!changed) return NextResponse.json({ error: "Arama durumu değişmiş." }, { status: 409 });
  return NextResponse.json({ session: changed }, { headers: { "Cache-Control": "private, no-store" } });
}
