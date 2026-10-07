import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_SIGNAL_BYTES, MAX_SIGNALS_PER_CALL } from "@/lib/calls";
import { callContext, loadParticipantSession, unauthorized } from "@/lib/calls-server";

const signalSchema = z.object({ kind: z.enum(["offer", "answer", "ice"]), payload: z.record(z.string(), z.unknown()) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await request.text();
  if (raw.length > MAX_SIGNAL_BYTES) return NextResponse.json({ error: "Sinyal çok büyük." }, { status: 413 });
  let json: unknown = null;
  try { json = JSON.parse(raw); } catch { /* handled below */ }
  const parsed = signalSchema.safeParse(json);
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: "Sinyal geçersiz." }, { status: 400 });
  const ctx = await callContext();
  if (!ctx) return unauthorized();
  const session = await loadParticipantSession(ctx, id);
  if (!session) return NextResponse.json({ error: "Arama bulunamadı." }, { status: 404 });
  const isCaller = session.caller_id === ctx.profileId;
  const { kind, payload } = parsed.data;
  if (!["ringing", "accepted"].includes(session.status)) return NextResponse.json({ error: "Arama sona erdi." }, { status: 409 });
  if (kind === "offer" && !isCaller) return NextResponse.json({ error: "Teklifi yalnızca arayan gönderebilir." }, { status: 403 });
  if (kind === "answer" && (isCaller || session.status !== "accepted")) return NextResponse.json({ error: "Yanıt yalnızca kabul eden kişiden gelebilir." }, { status: 403 });
  const { count } = await ctx.admin.from("call_signals").select("id", { count: "exact", head: true }).eq("session_id", id).eq("from_profile_id", ctx.profileId);
  if ((count ?? 0) >= MAX_SIGNALS_PER_CALL) return NextResponse.json({ error: "Sinyal sınırına ulaşıldı." }, { status: 429 });
  const { error } = await ctx.admin.from("call_signals").insert({ session_id: id, from_profile_id: ctx.profileId, to_profile_id: isCaller ? session.callee_id : session.caller_id, kind, payload });
  if (error) return NextResponse.json({ error: "Sinyal gönderilemedi." }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
