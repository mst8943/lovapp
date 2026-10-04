import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ messageId: z.string().uuid(), emoji: z.enum(["❤️", "😂", "✨", "👍", "😮"]).nullable().optional() });

async function context(request: Request) {
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return { error: NextResponse.json({ error: "Geçersiz mesaj." }, { status: 400 }) };
  const session = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user || !admin) return { error: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }) };
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  const { data: message } = await admin.from("messages").select("id,match_id,sender_id,kind,audio_path,deleted_at").eq("id", payload.data.messageId).maybeSingle();
  if (!member || !message) return { error: NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 }) };
  const { data: match } = await admin.from("matches").select("id").eq("id", message.match_id).eq("status", "active")
    .or(`user_a.eq.${member.id},user_b.eq.${member.id}`).maybeSingle();
  if (!match) return { error: NextResponse.json({ error: "Aktif sohbet gerekli." }, { status: 403 }) };
  return { admin, member, message, payload: payload.data };
}

export async function PATCH(request: Request) {
  const result = await context(request);
  if (result.error) return result.error;
  const { admin, member, message, payload } = result;
  if (!admin || !member || !message || !payload) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
  if (message.deleted_at) return NextResponse.json({ error: "Silinmiş mesaja tepki verilemez." }, { status: 409 });
  const action = payload.emoji
    ? admin.from("message_reactions").upsert({ message_id: message.id, profile_id: member.id, emoji: payload.emoji })
    : admin.from("message_reactions").delete().eq("message_id", message.id).eq("profile_id", member.id);
  const { error } = await action;
  return error ? NextResponse.json({ error: "Tepki kaydedilemedi." }, { status: 503 }) : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const result = await context(request);
  if (result.error) return result.error;
  const { admin, member, message } = result;
  if (!admin || !member || !message) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
  if (message.sender_id !== member.id) return NextResponse.json({ error: "Yalnızca kendi mesajını silebilirsin." }, { status: 403 });
  if (message.deleted_at) return NextResponse.json({ ok: true });
  const { error } = await admin.from("messages").update({ kind: "text", body: "Mesaj silindi", audio_path: null, audio_duration_ms: null, audio_waveform: null, transcript: null, deleted_at: new Date().toISOString() }).eq("id", message.id).eq("sender_id", member.id).is("deleted_at", null);
  if (error) return NextResponse.json({ error: "Mesaj silinemedi." }, { status: 503 });
  await admin.from("message_reactions").delete().eq("message_id", message.id);
  if (message.audio_path) await admin.storage.from(message.kind === "image" ? "chat-images" : "voice-messages").remove([message.audio_path]);
  return NextResponse.json({ ok: true });
}
