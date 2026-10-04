import { randomUUID } from "node:crypto";
import heicConvert from "heic-convert";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const OUTPUT_WIDTHS = [480, 960, 1440] as const;

export async function POST(request: Request) {
  try {
    return await uploadProfilePhoto(request);
  } catch (error) {
    console.error("Unhandled profile photo upload failure", error);
    return NextResponse.json(
      {
        error:
          "Fotoğraf işlenirken beklenmeyen bir sorun oluştu. Lütfen yeniden dene.",
      },
      { status: 500 },
    );
  }
}

async function uploadProfilePhoto(request: Request) {
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "Sunucu bağlantısı yapılandırılmamış." },
      { status: 503 },
    );
  const { data: profile } = await admin
    .from("profiles")
    .select("id,onboarding_completed")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile)
    return NextResponse.json(
      { error: "Önce profil bilgilerini kaydet." },
      { status: 409 },
    );

  const form = await request.formData().catch((error) => {
    console.error("Profile photo form parsing failed", error);
    return null;
  });
  const file = form?.get("photo");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Fotoğraf seçilmedi." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase();
  const looksHeic =
    extension === "heic" ||
    extension === "heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif";
  if (
    (!ACCEPTED_TYPES.has(file.type) && !looksHeic) ||
    file.size === 0 ||
    file.size > MAX_SOURCE_BYTES
  ) {
    return NextResponse.json(
      {
        error:
          "JPG, PNG, WebP veya HEIC biçiminde, en fazla 12 MB bir fotoğraf yükle.",
      },
      { status: 400 },
    );
  }

  const { count } = await admin
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  if ((count ?? 0) >= 6)
    return NextResponse.json(
      { error: "En fazla 6 fotoğraf yükleyebilirsin." },
      { status: 409 },
    );

  let source = Buffer.from(await file.arrayBuffer());
  try {
    await sharp(source, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    }).metadata();
  } catch {
    if (!looksHeic)
      return NextResponse.json(
        { error: "Fotoğraf okunamadı veya bozuk." },
        { status: 400 },
      );
    try {
      const converted = await heicConvert({
        buffer: source,
        format: "PNG",
        quality: 1,
      });
      source = Buffer.from(converted);
    } catch {
      return NextResponse.json(
        { error: "HEIC fotoğraf dönüştürülemedi. Farklı bir fotoğraf dene." },
        { status: 400 },
      );
    }
  }

  const image = sharp(source, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height)
    return NextResponse.json(
      { error: "Fotoğraf boyutları okunamadı." },
      { status: 400 },
    );

  const photoId = randomUUID();
  const paths: string[] = [];
  const variants: Record<string, string> = {};
  try {
    for (const width of OUTPUT_WIDTHS) {
      const path = `${profile.id}/${photoId}/${width}.webp`;
      const output = await image
        .clone()
        .resize(
          looksHeic
            ? {
                width,
                height: Math.round(width * 1.25),
                fit: "cover",
                position: "centre",
              }
            : { width, withoutEnlargement: false },
        )
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      const { error } = await admin.storage
        .from("profiles")
        .upload(path, output, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (error) throw error;
      paths.push(path);
      variants[String(width)] = path;
    }

    const sortOrder = count ?? 0;
    const { error } = await admin.from("profile_photos").insert({
      id: photoId,
      profile_id: profile.id,
      storage_path: variants["1440"],
      variants,
      width: metadata.width,
      height: metadata.height,
      sort_order: sortOrder,
      is_primary: sortOrder === 0,
      moderation_status: "pending",
      processing_status: "ready",
    });
    if (error) throw error;
  } catch (error) {
    console.error("Profile photo persistence failed", {
      profileId: profile.id,
      storedVariants: paths.length,
      error: error instanceof Error ? error.message : String(error),
    });
    if (paths.length) await admin.storage.from("profiles").remove(paths);
    const message =
      error instanceof Error && error.message.includes("photo_limit_reached")
        ? "En fazla 6 fotoğraf yükleyebilirsin."
        : "Fotoğraf güvenli biçimde kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: signed } = await admin.storage
    .from("profiles")
    .createSignedUrl(variants["960"], 900);
  return NextResponse.json(
    {
      photo: { id: photoId, url: signed?.signedUrl ?? null, status: "pending" },
      processing: {
        sourceStored: false,
        format: "webp",
        widths: OUTPUT_WIDTHS,
        quality: 82,
        metadataStripped: true,
      },
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "Sunucu bağlantısı yapılandırılmamış." },
      { status: 503 },
    );
  const body = (await request.json().catch(() => null)) as {
    photoId?: unknown;
  } | null;
  if (
    typeof body?.photoId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.photoId)
  ) {
    return NextResponse.json({ error: "Geçersiz fotoğraf." }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id,onboarding_completed")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile)
    return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
  const { data: photos, error: photosError } = await admin
    .from("profile_photos")
    .select("id,variants,sort_order,moderation_status,processing_status")
    .eq("profile_id", profile.id)
    .order("sort_order");
  if (photosError)
    return NextResponse.json(
      { error: "Fotoğraflar yüklenemedi." },
      { status: 503 },
    );
  const target = photos?.find((photo) => photo.id === body.photoId);
  if (!target)
    return NextResponse.json(
      { error: "Fotoğraf bulunamadı." },
      { status: 404 },
    );
  const remaining = (photos ?? []).filter((photo) => photo.id !== target.id);
  if (
    profile.onboarding_completed &&
    target.processing_status === "ready" &&
    target.moderation_status !== "rejected" &&
    !remaining.some(
      (photo) =>
        photo.processing_status === "ready" &&
        photo.moderation_status !== "rejected",
    )
  ) {
    return NextResponse.json(
      { error: "Tamamlanmış profilinde en az bir geçerli fotoğraf kalmalı." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await admin
    .from("profile_photos")
    .delete()
    .eq("id", target.id)
    .eq("profile_id", profile.id);
  if (deleteError)
    return NextResponse.json(
      {
        error: deleteError.message.includes("photo_required")
          ? "Tamamlanmış profilinde en az bir geçerli fotoğraf kalmalı."
          : "Fotoğraf kaldırılamadı.",
      },
      { status: deleteError.message.includes("photo_required") ? 409 : 500 },
    );
  for (let index = 0; index < remaining.length; index++) {
    await admin
      .from("profile_photos")
      .update({ sort_order: index, is_primary: index === 0 })
      .eq("id", remaining[index].id);
  }
  const paths = Object.values(
    (target.variants as Record<string, string> | null) ?? {},
  );
  if (paths.length) await admin.storage.from("profiles").remove(paths);
  return NextResponse.json({ removed: target.id });
}
