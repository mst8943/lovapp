import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.string().uuid();
const activeChatSchema = z.object({ matchId: z.string().uuid(), open: z.boolean() });

export async function POST(request: Request) {
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body !== null) {
    const parsed = activeChatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Geçersiz sohbet durumu." }, { status: 400 });
    const { data, error } = await session.rpc("touch_active_chat", { match_uuid: parsed.data.matchId, is_open: parsed.data.open });
    if (error && !parsed.data.open && error.message.includes("not_allowed")) return NextResponse.json({ touchedAt: null });
    if (error) return NextResponse.json({ error: "Sohbet durumu güncellenemedi." }, { status: 500 });
    return NextResponse.json({ touchedAt: data });
  }
  const { data, error } = await session.rpc("touch_presence");
  if (error) return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  return NextResponse.json({ lastSeenAt: data });
}

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!querySchema.safeParse(matchId).success) return NextResponse.json({ error: "Geçersiz eşleşme." }, { status: 400 });
  const session = await createClient();
  if (!session) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const [{ data }, mark] = await Promise.all([
    session.rpc("get_match_presence", { match_uuid: matchId }),
    session.rpc("mark_match_messages_read", { match_uuid: matchId }),
  ]);
  return NextResponse.json({ presence: data?.[0] ?? null, markedRead: mark.data ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
