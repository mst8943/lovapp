import { after, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { sendPushToProfile } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const uuid = z.string().uuid();

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  const matchId = form?.get("matchId");
  const clientId = form?.get("clientId");
  if (!(file instanceof File) || !uuid.safeParse(matchId).success || !uuid.safeParse(clientId).success || file.size < 1 || file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "JPG, PNG veya WebP biçiminde, en fazla 8 MB fotoğraf seç." }, { status: 400 });
  }
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  const admin = createAdminClient();
  if (!session || !user || !admin) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: member } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!member) return NextResponse.json({ error: "Profil gerekli." }, { status: 403 });
  const { data: match } = await admin.from("matches").select("id,user_a,user_b,connection_type").eq("id", matchId as string).eq("status", "active").or(`user_a.eq.${member.id},user_b.eq.${member.id}`).maybeSingle();
  if (!match || match.connection_type === "message_request") return NextResponse.json({ error: "Fotoğraf için kabul edilmiş sohbet gerekli." }, { status: 403 });
  const targetId = match.user_a === member.id ? match.user_b : match.user_a;
  const { data: target } = await admin.from("profiles").select("kind").eq("id", targetId).maybeSingle();
  if (target?.kind !== "human") return NextResponse.json({ error: "Bu sohbette fotoğraf gönderilemiyor." }, { status: 403 });
  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 30_000_000 })
      .rotate().resize({ width: 1440, height: 1440, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Fotoğraf okunamadı." }, { status: 400 });
  }
  const path = `${member.id}/${clientId}.webp`;
  const { error: uploadError } = await admin.storage.from("chat-images").upload(path, image, { contentType: "image/webp", upsert: false });
  if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) return NextResponse.json({ error: "Fotoğraf yüklenemedi." }, { status: 503 });
  const { data, error } = await session.rpc("send_image_message", { match_uuid: matchId, image_path: path, client_uuid: clientId });
  if (error || data?.allowed === false) {
    if (!uploadError) await admin.storage.from("chat-images").remove([path]);
    return NextResponse.json({ error: data?.allowed === false ? "Bugünkü mesaj hakkın doldu." : "Fotoğraf gönderilemedi." }, { status: data?.allowed === false ? 429 : 503 });
  }
  if (!data?.duplicate) after(() => sendPushToProfile(admin, targetId, { title: "Lovask", body: "Yeni bir fotoğrafın var.", url: `/?open=chat&match=${matchId}`, tag: `match-${matchId}`, matchId: matchId as string }));
  return NextResponse.json({ messageId: data.messageId, createdAt: data.createdAt }, { status: data?.duplicate ? 200 : 201 });
}
