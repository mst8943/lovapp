import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const schema = z
  .object({
    photoId: z.string().uuid(),
    status: z.enum(["pending", "approved", "rejected"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) => value.status !== "rejected" || (value.reason?.length ?? 0) >= 3,
    { message: "Red nedeni gerekli." },
  );

export async function GET() {
  const auth = await requireAdmin(["owner", "moderator"]);
  if (auth instanceof NextResponse) return auth;
  const select =
    "id,profile_id,variants,storage_path,created_at,moderation_status,moderation_reason,moderated_at,is_primary,sort_order,width,height,profiles(display_name,kind,city)";
  const [pendingRows, decidedRows, pending, approved, rejected] =
    await Promise.all([
      auth.admin
        .from("profile_photos")
        .select(select)
        .eq("processing_status", "ready")
        .eq("moderation_status", "pending")
        .order("created_at", { ascending: true })
        .limit(200),
      auth.admin
        .from("profile_photos")
        .select(select)
        .eq("processing_status", "ready")
        .neq("moderation_status", "pending")
        .order("moderated_at", { ascending: false, nullsFirst: false })
        .limit(100),
      auth.admin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "ready")
        .eq("moderation_status", "pending"),
      auth.admin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "ready")
        .eq("moderation_status", "approved"),
      auth.admin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "ready")
        .eq("moderation_status", "rejected"),
    ]);
  const data = [...(pendingRows.data ?? []), ...(decidedRows.data ?? [])];
  const error = pendingRows.error ?? decidedRows.error;
  if (error)
    return NextResponse.json(
      { error: "Fotoğraflar yüklenemedi." },
      { status: 500 },
    );
  const profileIds = [
    ...new Set((data ?? []).map((photo) => photo.profile_id)),
  ];
  const { data: profilePhotos } = profileIds.length
    ? await auth.admin
        .from("profile_photos")
        .select("profile_id,moderation_status,processing_status")
        .in("profile_id", profileIds)
    : { data: [] };
  const photos = await Promise.all(
    (data ?? []).map(async (photo) => {
      const variants = photo.variants as Record<string, string> | null;
      const path = variants?.["960"] ?? photo.storage_path;
      const signed = await auth.admin.storage
        .from("profiles")
        .createSignedUrl(path, 600);
      const related = (profilePhotos ?? []).filter(
        (item) =>
          item.profile_id === photo.profile_id &&
          item.processing_status === "ready",
      );
      return {
        ...photo,
        profilePhotoCount: related.length,
        usablePhotoCount: related.filter(
          (item) => item.moderation_status === "approved",
        ).length,
        url: signed.data?.signedUrl ?? null,
        storage_path: undefined,
        variants: undefined,
      };
    }),
  );
  return NextResponse.json(
    {
      photos,
      stats: {
        pending: pending.count ?? 0,
        approved: approved.count ?? 0,
        rejected: rejected.count ?? 0,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Moderasyon kararını kontrol edin." },
      { status: 400 },
    );
  const auth = await requireAdmin(["owner", "moderator"]);
  if (auth instanceof NextResponse) return auth;
  const { data: photo } = await auth.admin
    .from("profile_photos")
    .select("profile_id,moderation_status")
    .eq("id", parsed.data.photoId)
    .maybeSingle();
  if (!photo)
    return NextResponse.json(
      { error: "Fotoğraf bulunamadı." },
      { status: 404 },
    );
  let profilePaused = false;
  if (parsed.data.status === "rejected") {
    const { count } = await auth.admin
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", photo.profile_id)
      .eq("processing_status", "ready")
      .neq("id", parsed.data.photoId)
      .eq("moderation_status", "approved");
    profilePaused = (count ?? 0) < 1;
  }
  const { error } = await auth.admin
    .from("profile_photos")
    .update({
      moderation_status: parsed.data.status,
      moderation_reason:
        parsed.data.status === "rejected" ? (parsed.data.reason ?? null) : null,
      moderated_by: parsed.data.status === "pending" ? null : auth.user.id,
      moderated_at:
        parsed.data.status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", parsed.data.photoId);
  if (error)
    return NextResponse.json(
      { error: "Fotoğraf kararı kaydedilemedi." },
      { status: 500 },
    );
  if (profilePaused) {
    const { error: pauseError } = await auth.admin
      .from("profiles")
      .update({ is_discoverable: false, updated_at: new Date().toISOString() })
      .eq("id", photo.profile_id);
    if (pauseError)
      return NextResponse.json(
        {
          error:
            "Fotoğraf reddedildi ancak profil keşfetten kaldırılamadı. İşlemi yeniden deneyin.",
        },
        { status: 503 },
      );
  } else if (parsed.data.status === "approved") {
    const { error: activateError } = await auth.admin
      .from("profiles")
      .update({ is_discoverable: true, updated_at: new Date().toISOString() })
      .eq("id", photo.profile_id)
      .eq("kind", "human")
      .eq("onboarding_completed", true);
    if (activateError)
      return NextResponse.json(
        {
          error:
            "Fotoğraf onaylandı ancak profil keşfe açılamadı. İşlemi yeniden deneyin.",
        },
        { status: 503 },
      );
  }
  await auth.session.rpc("write_admin_audit", {
    event_action: `photo.${parsed.data.status}`,
    event_target_type: "profile_photo",
    event_target_id: parsed.data.photoId,
    event_metadata: {
      profileId: photo.profile_id,
      reason: parsed.data.reason ?? null,
    },
  });
  return NextResponse.json({
    updated: true,
    photoId: parsed.data.photoId,
    status: parsed.data.status,
    profilePaused,
  });
}
