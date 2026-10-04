import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const prompts = ["Bir akşam yemeğine çıksak…", "Beni güldürmenin yolu…", "Benimle ilgili şaşıracağın şey…"] as const;
const formats: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3" };

async function owner() {
  const session = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile ? { admin, profileId: profile.id } : null;
}

export async function GET() {
  const context = await owner();
  if (!context) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: voice } = await context.admin.from("profile_voice_prompts").select("prompt,audio_path,duration_ms").eq("profile_id", context.profileId).maybeSingle();
  if (!voice) return NextResponse.json({ voice: null }, { headers: { "Cache-Control": "private, no-store" } });
  const { data: signed } = await context.admin.storage.from("voice-messages").createSignedUrl(voice.audio_path, 3600);
  return NextResponse.json({ voice: { prompt: voice.prompt, audioUrl: signed?.signedUrl, durationMs: voice.duration_ms } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const context = await owner();
  if (!context) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  const prompt = z.enum(prompts).safeParse(form?.get("prompt"));
  const durationMs = Number(form?.get("durationMs"));
  if (!(file instanceof File) || !prompt.success || !Number.isInteger(durationMs) || durationMs < 15000 || durationMs > 30000 || file.size < 100 || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "15–30 saniyelik ses kaydı gerekli." }, { status: 400 });
  const mime = file.type.split(";")[0].toLowerCase();
  const extension = formats[mime];
  if (!extension) return NextResponse.json({ error: "Ses biçimi desteklenmiyor." }, { status: 400 });
  const path = `${context.profileId}/bio/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await context.admin.storage.from("voice-messages").upload(path, await file.arrayBuffer(), { contentType: mime, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Ses yüklenemedi." }, { status: 503 });
  const { data: previous } = await context.admin.from("profile_voice_prompts").select("audio_path").eq("profile_id", context.profileId).maybeSingle();
  const { error } = await context.admin.from("profile_voice_prompts").upsert({ profile_id: context.profileId, prompt: prompt.data, audio_path: path, duration_ms: durationMs, updated_at: new Date().toISOString() });
  if (error) { await context.admin.storage.from("voice-messages").remove([path]); return NextResponse.json({ error: "Ses kaydedilemedi." }, { status: 503 }); }
  if (previous?.audio_path) await context.admin.storage.from("voice-messages").remove([previous.audio_path]);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE() {
  const context = await owner();
  if (!context) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: previous } = await context.admin.from("profile_voice_prompts").select("audio_path").eq("profile_id", context.profileId).maybeSingle();
  const { error } = await context.admin.from("profile_voice_prompts").delete().eq("profile_id", context.profileId);
  if (error) return NextResponse.json({ error: "Ses silinemedi." }, { status: 503 });
  if (previous?.audio_path) await context.admin.storage.from("voice-messages").remove([previous.audio_path]);
  return NextResponse.json({ ok: true });
}
