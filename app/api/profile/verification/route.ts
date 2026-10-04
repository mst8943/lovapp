import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function context() {
  const session = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user || !admin) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("id,is_verified")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  return profile ? { admin, profile, user } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data } = await ctx.admin
    .from("profile_verification_requests")
    .select("status,selfie_path,created_at,reviewed_at")
    .eq("profile_id", ctx.profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json(
    {
      verified: ctx.profile.is_verified,
      selfie:
        data?.status === "pending" && !data.selfie_path
          ? null
          : data && {
              status: data.status,
              created_at: data.created_at,
              reviewed_at: data.reviewed_at,
            },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (ctx.profile.is_verified)
    return NextResponse.json(
      { error: "Profil zaten doğrulanmış." },
      { status: 409 },
    );
  const form = await request.formData().catch(() => null);
  const file = form?.get("selfie");
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size < 1 ||
    file.size > 8 * 1024 * 1024
  )
    return NextResponse.json(
      { error: "En fazla 8 MB JPG, PNG veya WebP selfie seç." },
      { status: 400 },
    );
  const { data: previous } = await ctx.admin
    .from("profile_verification_requests")
    .select("id,selfie_path,status,created_at")
    .eq("profile_id", ctx.profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { count: photos } = await ctx.admin
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", ctx.profile.id)
    .eq("processing_status", "ready")
    .neq("moderation_status", "rejected");
  if (!photos)
    return NextResponse.json(
      { error: "Önce geçerli bir profil fotoğrafı yükle." },
      { status: 409 },
    );
  if (previous?.status === "pending" && previous.selfie_path)
    return NextResponse.json({ error: "Selfie incelemede." }, { status: 409 });
  if (
    previous?.status !== "pending" &&
    previous?.created_at &&
    Date.now() - Date.parse(previous.created_at) < 24 * 60 * 60_000
  )
    return NextResponse.json(
      { error: "Yeni isteği 24 saat sonra gönderebilirsin." },
      { status: 429 },
    );
  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), {
      failOn: "error",
      limitInputPixels: 30_000_000,
    })
      .rotate()
      .resize({
        width: 960,
        height: 960,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Selfie okunamadı." }, { status: 400 });
  }
  const path = `${ctx.profile.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await ctx.admin.storage
    .from("verification-selfies")
    .upload(path, image, { contentType: "image/webp" });
  if (uploadError)
    return NextResponse.json({ error: "Selfie yüklenemedi." }, { status: 503 });
  const { data: saved, error } =
    previous?.status === "pending"
      ? await ctx.admin
          .from("profile_verification_requests")
          .update({
            selfie_path: path,
            challenge: "Güncel yüz selfiesi",
            updated_at: new Date().toISOString(),
          })
          .eq("id", previous.id)
          .is("selfie_path", null)
          .select("id")
          .maybeSingle()
      : await ctx.admin
          .from("profile_verification_requests")
          .insert({
            profile_id: ctx.profile.id,
            selfie_path: path,
            challenge: "Güncel yüz selfiesi",
            status: "pending",
          })
          .select("id")
          .maybeSingle();
  if (error || !saved) {
    await ctx.admin.storage.from("verification-selfies").remove([path]);
    return NextResponse.json(
      { error: "İstek kaydedilemedi." },
      { status: 503 },
    );
  }
  return NextResponse.json({ status: "pending" }, { status: 201 });
}
