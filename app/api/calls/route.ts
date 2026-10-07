import { after, NextResponse } from "next/server";
import { z } from "zod";
import { hasChatFoundation, isRingingFresh, MAX_CALL_HOURS, MAX_CALLS_PER_HOUR, type CallSession } from "@/lib/calls";
import { callContext, unauthorized } from "@/lib/calls-server";
import { sendPushToProfile } from "@/lib/push";

const startSchema = z.object({ matchId: z.string().uuid(), kind: z.enum(["audio", "video"]) });

// Ringing calls for the signed-in member (used when the app opens from a push notification).
export async function GET() {
  const ctx = await callContext();
  if (!ctx) return unauthorized();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await ctx.admin.from("call_sessions").select("id,match_id,caller_id,callee_id,kind,status,created_at,answered_at,ended_at").eq("callee_id", ctx.profileId).eq("status", "ringing").gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  if (error) return NextResponse.json({ incoming: null }, { headers: { "Cache-Control": "private, no-store" } });
  const session = (data?.[0] as CallSession | undefined) ?? null;
  if (!session) return NextResponse.json({ incoming: null }, { headers: { "Cache-Control": "private, no-store" } });
  const { data: caller } = await ctx.admin.from("profiles").select("display_name").eq("id", session.caller_id).maybeSingle();
  return NextResponse.json({ incoming: { ...session, callerName: caller?.display_name ?? "Bir üye" } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Arama bilgisi geçersiz." }, { status: 400 });
  const ctx = await callContext();
  if (!ctx) return unauthorized();
  const { matchId, kind } = parsed.data;

  const { data: match } = await ctx.admin.from("matches").select("id,user_a,user_b,status").eq("id", matchId).maybeSingle();
  if (!match || match.status !== "active" || (match.user_a !== ctx.profileId && match.user_b !== ctx.profileId)) return NextResponse.json({ error: "Arama için aktif bir eşleşme gerekli." }, { status: 403 });
  const peerId = (match.user_a === ctx.profileId ? match.user_b : match.user_a) as string;

  const [{ data: peer }, { data: blocks }, { data: prefs }, { count: fromCaller }, { count: fromCallee }] = await Promise.all([
    ctx.admin.from("profiles").select("id,kind,deleted_at").eq("id", peerId).maybeSingle(),
    ctx.admin.from("blocks").select("blocker_id").or(`and(blocker_id.eq.${ctx.profileId},blocked_id.eq.${peerId}),and(blocker_id.eq.${peerId},blocked_id.eq.${ctx.profileId})`).limit(1),
    ctx.admin.from("notification_preferences").select("calls_enabled").eq("profile_id", peerId).maybeSingle(),
    ctx.admin.from("messages").select("id", { count: "exact", head: true }).eq("match_id", matchId).eq("sender_id", ctx.profileId),
    ctx.admin.from("messages").select("id", { count: "exact", head: true }).eq("match_id", matchId).eq("sender_id", peerId),
  ]);
  if (!peer || peer.kind !== "human" || peer.deleted_at) return NextResponse.json({ error: "Bu kişiyle arama yapılamaz." }, { status: 403 });
  if (blocks?.length) return NextResponse.json({ error: "Bu kişiyle arama yapılamaz." }, { status: 403 });
  if (prefs && prefs.calls_enabled === false) return NextResponse.json({ error: "Bu kişi şu an aramaları kabul etmiyor." }, { status: 403 });
  if (!hasChatFoundation({ fromCaller: fromCaller ?? 0, fromCallee: fromCallee ?? 0 })) return NextResponse.json({ error: "Arama için önce biraz sohbet etmeniz ve ikinizin de mesaj yazmış olması gerekir." }, { status: 403 });

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: recent }, { data: open }] = await Promise.all([
    ctx.admin.from("call_sessions").select("id", { count: "exact", head: true }).eq("caller_id", ctx.profileId).gte("created_at", hourAgo),
    ctx.admin.from("call_sessions").select("id,status,created_at,answered_at").or(`caller_id.in.(${ctx.profileId},${peerId}),callee_id.in.(${ctx.profileId},${peerId})`).in("status", ["ringing", "accepted"]).gte("created_at", new Date(Date.now() - MAX_CALL_HOURS * 3_600_000).toISOString()).limit(10),
  ]);
  if ((recent ?? 0) >= MAX_CALLS_PER_HOUR) return NextResponse.json({ error: "Çok fazla arama denemesi yaptın. Biraz sonra tekrar dene." }, { status: 429 });
  if ((open ?? []).some((row) => row.status === "accepted" || isRingingFresh({ status: row.status, created_at: row.created_at }))) return NextResponse.json({ error: "Arama şu an yapılamıyor: hatlardan biri meşgul." }, { status: 409 });

  const { data: created, error } = await ctx.admin.from("call_sessions").insert({ match_id: matchId, caller_id: ctx.profileId, callee_id: peerId, kind }).select("id,created_at").single();
  if (error || !created) return NextResponse.json({ error: "Arama başlatılamadı." }, { status: 503 });
  after(() => sendPushToProfile(ctx.admin, peerId, { title: `${ctx.name} seni arıyor`, body: kind === "video" ? "Görüntülü arama" : "Sesli arama", url: `/?open=chat&match=${matchId}`, tag: `call-${created.id}`, matchId }, { bypassQuietHours: true }));
  return NextResponse.json({ id: created.id, kind }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
