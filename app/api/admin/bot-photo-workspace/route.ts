import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const moveSchema = z.object({
  action: z.literal("move"),
  photoId: z.string().uuid(),
  targetProfileId: z.string().uuid(),
  targetPosition: z.number().int().min(0).max(5).optional(),
  confirmEmptySource: z.boolean().default(false),
});
const primarySchema = z.object({ action: z.literal("set_primary"), photoId: z.string().uuid() });
const mutationSchema = z.discriminatedUnion("action", [moveSchema, primarySchema]);

export async function GET() {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const [{ data: bots, error: botError }, { data: photos, error: photoError }] = await Promise.all([
    auth.admin.from("profiles").select("id,display_name,birth_date,gender,is_discoverable,created_at").eq("kind", "bot").order("display_name").limit(1000),
    auth.admin.from("profile_photos").select("id,profile_id,storage_path,variants,sort_order,is_primary,source_set_id,created_at").order("sort_order").limit(6000),
  ]);
  if (botError || photoError) return NextResponse.json({ error: "Bot fotoğrafları yüklenemedi." }, { status: 503 });

  const botIds = new Set((bots ?? []).map((bot) => bot.id));
  const relevantPhotos = (photos ?? []).filter((photo) => botIds.has(photo.profile_id));
  const paths = relevantPhotos.map((photo) => {
    const variants = photo.variants as Record<string, string> | null;
    return variants?.["480"] ?? photo.storage_path;
  });
  const { data: signed } = paths.length ? await auth.admin.storage.from("profiles").createSignedUrls(paths, 900) : { data: [] };
  const urlByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const photoMap = new Map<string, Array<Record<string, unknown>>>();
  for (const photo of relevantPhotos) {
    const variants = photo.variants as Record<string, string> | null;
    const path = variants?.["480"] ?? photo.storage_path;
    const list = photoMap.get(photo.profile_id) ?? [];
    list.push({ id: photo.id, url: urlByPath.get(path) ?? null, sortOrder: photo.sort_order, isPrimary: photo.is_primary, sourceSetId: photo.source_set_id, createdAt: photo.created_at });
    photoMap.set(photo.profile_id, list);
  }
  const result = (bots ?? []).map((bot) => ({
    id: bot.id,
    name: bot.display_name,
    age: ageFromBirthDate(bot.birth_date),
    ageBand: ageBandFromBirthDate(bot.birth_date),
    gender: bot.gender,
    discoverable: bot.is_discoverable,
    photos: photoMap.get(bot.id) ?? [],
  }));
  return NextResponse.json({ bots: result }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Fotoğraf işlemini kontrol edin." }, { status: 400 });

  if (parsed.data.action === "set_primary") {
    const { error } = await auth.session.rpc("set_bot_primary_photo", { photo_uuid: parsed.data.photoId });
    if (error) return NextResponse.json({ error: mapMoveError(error.message) }, { status: 409 });
    await auth.session.rpc("write_admin_audit", { event_action: "bot.photo.primary_changed", event_target_type: "profile_photo", event_target_id: parsed.data.photoId, event_metadata: {} });
    return NextResponse.json({ updated: true });
  }

  const { data: photo } = await auth.admin.from("profile_photos").select("profile_id").eq("id", parsed.data.photoId).maybeSingle();
  if (!photo) return NextResponse.json({ error: "Fotoğraf bulunamadı." }, { status: 404 });
  if (photo.profile_id === parsed.data.targetProfileId) return NextResponse.json({ error: "Fotoğraf zaten bu botta." }, { status: 409 });
  const { count: sourceCount } = await auth.admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", photo.profile_id);
  if ((sourceCount ?? 0) === 1 && !parsed.data.confirmEmptySource) {
    return NextResponse.json({ error: "Bu bot fotoğrafsız kalacak ve keşfetten düşecek.", requiresConfirmation: true }, { status: 409 });
  }
  const { data, error } = await auth.session.rpc("move_bot_photo", {
    moved_photo_id: parsed.data.photoId,
    target_profile_id: parsed.data.targetProfileId,
    target_position: parsed.data.targetPosition ?? null,
  });
  if (error) return NextResponse.json({ error: mapMoveError(error.message) }, { status: 409 });
  const result = data;
  await auth.session.rpc("write_admin_audit", { event_action: "bot.photo.moved", event_target_type: "profile_photo", event_target_id: parsed.data.photoId, event_metadata: result ?? { sourceProfileId: photo.profile_id, targetProfileId: parsed.data.targetProfileId } });
  return NextResponse.json({ moved: true, result });
}

function mapMoveError(message: string) {
  if (message.includes("photo_limit_reached")) return "Hedef botun 6 fotoğraflık limiti dolu.";
  if (message.includes("target_bot_not_found")) return "Hedef bot bulunamadı.";
  if (message.includes("photo_not_found")) return "Fotoğraf bulunamadı.";
  if (message.includes("same_profile")) return "Fotoğraf zaten bu botta.";
  return "Fotoğraf taşınamadı.";
}

function ageFromBirthDate(value: string) {
  const birth = new Date(`${value}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function ageBandFromBirthDate(value: string) {
  const age = ageFromBirthDate(value);
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  return "45+";
}
