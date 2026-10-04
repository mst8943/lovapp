import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0 || file.size > 12 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "En fazla 12 MB JPG, PNG veya WebP seçin." }, { status: 400 });
  let output: Buffer;
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 900, fit: "cover", position: "attention", withoutEnlargement: false }).webp({ quality: 82, effort: 5 }).toBuffer();
  } catch { return NextResponse.json({ error: "Görsel işlenemedi." }, { status: 400 }); }
  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.webp`;
  const { error } = await auth.admin.storage.from("blog-covers").upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: "Kapak görseli yüklenemedi." }, { status: 500 });
  const { data } = auth.admin.storage.from("blog-covers").getPublicUrl(path);
  await auth.session.rpc("write_admin_audit", { event_action: "blog.cover.uploaded", event_target_type: "blog_cover", event_target_id: path, event_metadata: { bytes: output.length } });
  return NextResponse.json({ url: data.publicUrl, width: 1600, height: 900 }, { status: 201 });
}
