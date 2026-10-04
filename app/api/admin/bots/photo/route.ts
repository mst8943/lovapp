import { randomUUID } from "node:crypto";
import heicConvert from "heic-convert";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const widths = [480, 960, 1440] as const;

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Sunucu bağlantısı gerekli." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: role } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !["owner", "bot_editor"].includes(role.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const profileId = form?.get("profileId");
  const file = form?.get("photo");
  if (typeof profileId !== "string" || !/^[0-9a-f-]{36}$/i.test(profileId) || !(file instanceof File) || file.size === 0 || file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Geçerli bir bot ve en fazla 12 MB fotoğraf seç." }, { status: 400 });
  }
  const { data: bot } = await admin.from("profiles").select("id").eq("id", profileId).eq("kind", "bot").maybeSingle();
  if (!bot) return NextResponse.json({ error: "Bot bulunamadı." }, { status: 404 });
  const { count: photoCount } = await admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", profileId);
  if ((photoCount ?? 0) >= 6) return NextResponse.json({ error: "Bir botta en fazla 6 fotoğraf olabilir." }, { status: 409 });
  const extension = file.name.split(".").pop()?.toLowerCase();
  const looksHeic = extension === "heic" || extension === "heif" || file.type === "image/heic" || file.type === "image/heif";
  if (!looksHeic && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "JPG, PNG, WebP veya HEIC fotoğraf yükle." }, { status: 400 });
  let source = Buffer.from(await file.arrayBuffer());
  try { await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata(); }
  catch {
    if (!looksHeic) return NextResponse.json({ error: "Fotoğraf okunamadı." }, { status: 400 });
    try { source = Buffer.from(await heicConvert({ buffer: source, format: "PNG", quality: 1 })); }
    catch { return NextResponse.json({ error: "HEIC fotoğraf dönüştürülemedi." }, { status: 400 }); }
  }
  const image = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return NextResponse.json({ error: "Fotoğraf boyutu okunamadı." }, { status: 400 });
  const photoId = randomUUID();
  const paths: string[] = [];
  const variants: Record<string, string> = {};
  try {
    for (const width of widths) {
      const path = `${profileId}/${photoId}/${width}.webp`;
      const output = await image.clone().resize({ width, withoutEnlargement: false }).webp({ quality: 82, effort: 4 }).toBuffer();
      const { error } = await admin.storage.from("profiles").upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (error) throw error;
      paths.push(path); variants[String(width)] = path;
    }
    const { error: insertError } = await admin.from("profile_photos").insert({ id: photoId, profile_id: profileId, storage_path: variants["1440"], variants, width: metadata.width, height: metadata.height, sort_order: photoCount ?? 0, is_primary: (photoCount ?? 0) === 0, moderation_status: "approved", processing_status: "ready" });
    if (insertError) throw insertError;
  } catch {
    await admin.from("profile_photos").delete().eq("id", photoId).eq("profile_id", profileId);
    if (paths.length) await admin.storage.from("profiles").remove(paths);
    return NextResponse.json({ error: "Bot fotoğrafı kaydedilemedi." }, { status: 500 });
  }
  const { data: signed } = await admin.storage.from("profiles").createSignedUrl(variants["480"], 900);
  await session.rpc("write_admin_audit", { event_action: "bot.photo.uploaded", event_target_type: "profile_photo", event_target_id: photoId, event_metadata: { profileId } });
  return NextResponse.json({ uploaded: true, photo: { id: photoId, url: signed?.signedUrl ?? null } }, { status: 201 });
}
