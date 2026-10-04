import { after, NextResponse } from "next/server";
import { z } from "zod";
import { sendPushToProfile } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { scheduleBotReply } from "@/lib/ai/automation";
import { transcribeBotAudio } from "@/lib/ai/provider";

const uuid = z.string().uuid();
const acceptedTypes: Record<string, { contentType: string; extension: string }> = {
  "audio/webm": { contentType: "audio/webm", extension: "webm" },
  "audio/ogg": { contentType: "audio/ogg", extension: "ogg" },
  "audio/mp4": { contentType: "audio/mp4", extension: "m4a" },
  "audio/x-m4a": { contentType: "audio/x-m4a", extension: "m4a" },
  "audio/mpeg": { contentType: "audio/mpeg", extension: "mp3" },
};

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  const profileId = form?.get("profileId");
  const clientId = form?.get("clientId");
  const durationMs = Number(form?.get("durationMs"));
  let waveformInput: unknown = null;
  try { waveformInput = JSON.parse(String(form?.get("waveform") ?? "null")); } catch { /* validated below */ }
  const waveformParsed = z.array(z.number().int().min(0).max(100)).min(8).max(48).safeParse(waveformInput);
  if (!(file instanceof File) || typeof profileId !== "string" || typeof clientId !== "string" ||
    !uuid.safeParse(profileId).success || !uuid.safeParse(clientId).success ||
    !Number.isInteger(durationMs) || durationMs < 500 || durationMs > 60000 || !waveformParsed.success) {
    return NextResponse.json({ error: "Ses kaydını kontrol et." }, { status: 400 });
  }
  const baseType = file.type.split(";")[0].toLowerCase();
  const format = acceptedTypes[baseType];
  if (!format || file.size < 100 || file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Ses kaydı desteklenmiyor veya 4 MB sınırını aşıyor." }, { status: 413 });
  }

  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Canlı bağlantı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!member) return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const [{ data: target }, { data: match }] = await Promise.all([
    admin.from("profiles").select("id,kind").eq("id", profileId).maybeSingle(),
    admin.from("matches").select("id,user_a,user_b").eq("status", "active")
      .or(`and(user_a.eq.${member.id},user_b.eq.${profileId}),and(user_a.eq.${profileId},user_b.eq.${member.id})`).limit(1).maybeSingle(),
  ]);
  if (!target || !match) return NextResponse.json({ error: "Aktif eşleşme gerekli." }, { status: 403 });

  const path = `${member.id}/${match.id}/${clientId}.${format.extension}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from("voice-messages").upload(path, bytes, {
    contentType: format.contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) {
    return NextResponse.json({ error: "Ses kaydı yüklenemedi." }, { status: 503 });
  }
  const uploadedFresh = !uploadError;

  const { data: sent, error: sendError } = target.kind === "bot"
    ? await admin.rpc("send_bot_audio_message_service", { member_uuid: member.id, match_uuid: match.id, message_audio_path: path, message_duration_ms: durationMs, message_waveform: waveformParsed.data, client_uuid: clientId })
    : await session.rpc("send_audio_message", { match_uuid: match.id, message_audio_path: path, message_duration_ms: durationMs, message_waveform: waveformParsed.data, client_uuid: clientId });
  const state = sent as { allowed?: boolean; messageId?: string; createdAt?: string; remaining?: number; limit?: number; duplicate?: boolean } | null;
  if (sendError || state?.allowed === false) {
    if (uploadedFresh && !state?.duplicate) await admin.storage.from("voice-messages").remove([path]);
    if (state?.allowed === false) return NextResponse.json({ error: "Bugünkü mesaj hakkın doldu.", quotaReached: true, limit: state.limit }, { status: 429 });
    return NextResponse.json({ error: "Sesli mesaj kaydedilemedi." }, { status: 503 });
  }
  const { data: signed } = await admin.storage.from("voice-messages").createSignedUrl(path, 60 * 60);
  if (target.kind === "human") {
    after(() => sendPushToProfile(admin, target.id, { title: "Lovask", body: "Yeni bir sesli mesajın var.", url: `/?open=chat&match=${match.id}`, tag: `match-${match.id}`, matchId: match.id }));
  }
  if (target.kind === "bot" && state?.messageId && !state.duplicate) {
    await Promise.all([
      admin.from("bot_experiment_assignments").update({ replied_at: new Date().toISOString() }).eq("match_id", match.id).is("replied_at", null).gte("sent_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString()),
    ]);
    after(async () => {
      await admin.from("messages").update({ transcription_status: "pending" }).eq("id", state.messageId);
      let transcript = "[Sesli mesaj anlaşılamadı; doğal biçimde tekrar etmesini iste.]";
      let transcriptionStatus = "failed";
      try {
        const generated = await transcribeBotAudio(bytes, `${clientId}.${format.extension}`, format.contentType);
        if (generated) { transcript = generated; transcriptionStatus = "ready"; }
      } catch (error) {
        console.error("Lovask voice transcription failed", error);
      }
      await admin.from("messages").update({ transcript, transcription_status: transcriptionStatus }).eq("id", state.messageId);
      await scheduleBotReply({ admin, matchId: match.id, botProfileId: target.id, memberProfileId: member.id, sourceMessageId: state.messageId });
    });
  }
  return NextResponse.json({
    messageId: state?.messageId,
    createdAt: state?.createdAt,
    audioUrl: signed?.signedUrl,
    durationMs,
    waveform: waveformParsed.data,
    remainingMessages: state?.remaining,
    replyPending: target.kind === "bot" && !state?.duplicate,
  }, { status: state?.duplicate ? 200 : 201 });
}
