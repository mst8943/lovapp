import { randomUUID } from "node:crypto";
import heicConvert from "heic-convert";
import { NextResponse } from "next/server";
import sharp, { type Metadata } from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const bucket = "bot-photo-pool";
const genders = ["kadın", "erkek"] as const;
const ageBands = ["18-24", "25-34", "35-44", "45+"] as const;
const widths = [480, 960, 1440] as const;
const maxFileBytes = 12 * 1024 * 1024;
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
type Gender = (typeof genders)[number];
type AgeBand = (typeof ageBands)[number];

const assignmentSchema = z.object({
  assignments: z.array(z.object({ setId: z.string().uuid(), profileId: z.string().uuid() })).min(1).max(20),
});
const legacySetSchema = z.object({
  paths: z.array(z.string().regex(/^available\/(kadin|erkek)\/[a-z0-9-]+\.webp$/i)).min(1).max(6),
  gender: z.enum(genders),
  ageBand: z.enum(ageBands),
});
const deleteSchema = z.union([
  z.object({ setId: z.string().uuid() }),
  z.object({ clearAvailable: z.literal(true) }),
]);

export async function GET() {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const bucketError = await ensurePoolBucket(auth.admin);
  if (bucketError) return NextResponse.json({ error: bucketError }, { status: 503 });

  const [{ data: sets, error: setError }, { data: bots }, womenFiles, menFiles] = await Promise.all([
    auth.admin.from("bot_photo_sets").select("id,gender,age_band,status,assigned_profile_id,created_at,bot_photo_set_items(id,storage_path,sort_order,width,height,size_bytes)").order("created_at", { ascending: false }).limit(500),
    auth.admin.from("profiles").select("id,display_name,birth_date,gender,created_at,profile_photos(id)").eq("kind", "bot").order("created_at", { ascending: true }).limit(1000),
    listLegacyFiles(auth.admin, "available/kadin"),
    listLegacyFiles(auth.admin, "available/erkek"),
  ]);
  if (setError) return NextResponse.json({ error: "Kişi seti tablosu hazır değil. 031 numaralı veritabanı geçişini uygulayın." }, { status: 503 });

  const assignedIds = [...new Set((sets ?? []).flatMap((set) => set.assigned_profile_id ? [set.assigned_profile_id] : []))];
  const assignedNames = new Map((bots ?? []).filter((bot) => assignedIds.includes(bot.id)).map((bot) => [bot.id, bot.display_name]));
  const serializedSets = await Promise.all((sets ?? []).map(async (set) => {
    const rawItems = (set.bot_photo_set_items ?? []) as Array<{ id: string; storage_path: string; sort_order: number; width: number; height: number; size_bytes: number }>;
    const items = await Promise.all(rawItems.toSorted((a, b) => a.sort_order - b.sort_order).map(async (item) => ({
      id: item.id,
      path: item.storage_path,
      sortOrder: item.sort_order,
      width: item.width,
      height: item.height,
      sizeBytes: Number(item.size_bytes),
      url: await signedPoolUrl(auth.admin, item.storage_path),
    })));
    return { id: set.id, gender: set.gender, ageBand: set.age_band, status: set.status, assignedProfileId: set.assigned_profile_id, assignedProfileName: set.assigned_profile_id ? assignedNames.get(set.assigned_profile_id) ?? "Silinmiş bot" : null, createdAt: set.created_at, items };
  }));

  const eligibleBots = (bots ?? []).flatMap((bot) => {
    const photoCount = (bot.profile_photos as unknown[] | null)?.length ?? 0;
    if (photoCount !== 0 || !genders.includes(bot.gender as Gender)) return [];
    return [{ id: bot.id, name: bot.display_name, gender: bot.gender as Gender, age: ageFromBirthDate(bot.birth_date), ageBand: ageBandFromBirthDate(bot.birth_date), createdAt: bot.created_at }];
  });
  const proposals = proposeAssignments(serializedSets, eligibleBots);
  const legacy = await Promise.all([
    ...womenFiles.map((file) => legacyItem(auth.admin, "kadın", "available/kadin", file)),
    ...menFiles.map((file) => legacyItem(auth.admin, "erkek", "available/erkek", file)),
  ]);

  return NextResponse.json({ sets: serializedSets, legacy, eligibleBots, proposals }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const bucketError = await ensurePoolBucket(auth.admin);
  if (bucketError) return NextResponse.json({ error: bucketError }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const gender = form?.get("gender");
  const ageBand = form?.get("ageBand");
  const files = form?.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0) ?? [];
  if (!genders.includes(gender as Gender) || !ageBands.includes(ageBand as AgeBand) || files.length < 1 || files.length > 6) {
    return NextResponse.json({ error: "Bir kişi için 1–6 fotoğraf, cinsiyet ve yaş aralığı seçin." }, { status: 400 });
  }
  if (files.some((file) => file.size > maxFileBytes || !allowedExtensions.has(file.name.split(".").pop()?.toLowerCase() ?? ""))) {
    return NextResponse.json({ error: "Her fotoğraf en fazla 12 MB ve JPG, PNG, WebP veya HEIC olmalı." }, { status: 413 });
  }
  const result = await createSetFromFiles(auth.admin, { files, gender: gender as Gender, ageBand: ageBand as AgeBand, createdBy: auth.user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.photo_set.created", event_target_type: "bot_photo_set", event_target_id: result.setId, event_metadata: { gender, ageBand, count: files.length } });
  return NextResponse.json({ created: true, setId: result.setId }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = legacySetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "1–6 gruplanmamış fotoğraf ile etiketleri kontrol edin." }, { status: 400 });
  const expectedPrefix = parsed.data.gender === "kadın" ? "available/kadin/" : "available/erkek/";
  if (parsed.data.paths.some((path) => !path.startsWith(expectedPrefix))) return NextResponse.json({ error: "Aynı setteki fotoğrafların cinsiyet etiketi aynı olmalı." }, { status: 409 });
  const result = await createSetFromLegacy(auth.admin, { ...parsed.data, createdBy: auth.user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.photo_set.grouped", event_target_type: "bot_photo_set", event_target_id: result.setId, event_metadata: { count: parsed.data.paths.length } });
  return NextResponse.json({ created: true, setId: result.setId }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Atama listesini kontrol edin." }, { status: 400 });
  const uniqueSets = new Set(parsed.data.assignments.map((item) => item.setId));
  const uniqueBots = new Set(parsed.data.assignments.map((item) => item.profileId));
  if (uniqueSets.size !== parsed.data.assignments.length || uniqueBots.size !== parsed.data.assignments.length) return NextResponse.json({ error: "Bir set veya bot aynı atamada iki kez kullanılamaz." }, { status: 409 });

  let assigned = 0;
  const failures: Array<{ setId: string; profileId: string; reason: string }> = [];
  for (const assignment of parsed.data.assignments) {
    const result = await assignSet(auth.admin, assignment);
    if (result.ok) assigned += 1;
    else failures.push({ ...assignment, reason: result.error });
  }
  await auth.session.rpc("write_admin_audit", { event_action: "bot.photo_sets.assigned", event_target_type: "bot_photo_set", event_target_id: [...uniqueSets].join(","), event_metadata: { assigned, failed: failures.length } });
  return NextResponse.json({ assigned, failed: failures.length, failures }, { status: assigned ? 200 : 409 });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Havuz temizleme isteği geçersiz." }, { status: 400 });
  if ("clearAvailable" in parsed.data) {
    const [{ data: sets, error: setReadError }, womenFiles, menFiles] = await Promise.all([
      auth.admin.from("bot_photo_sets").select("id,bot_photo_set_items(storage_path)").eq("status", "available").limit(1000),
      listLegacyFiles(auth.admin, "available/kadin"),
      listLegacyFiles(auth.admin, "available/erkek"),
    ]);
    if (setReadError) return NextResponse.json({ error: "Hazır setler okunamadı." }, { status: 503 });
    const setIds = (sets ?? []).map((set) => set.id);
    const paths = (sets ?? []).flatMap((set) => ((set.bot_photo_set_items ?? []) as Array<{ storage_path: string }>).map((item) => item.storage_path));
    paths.push(...womenFiles.map((file) => `available/kadin/${file.name}`), ...menFiles.map((file) => `available/erkek/${file.name}`));
    if (setIds.length) {
      const { error: deleteError } = await auth.admin.from("bot_photo_sets").delete().in("id", setIds).eq("status", "available");
      if (deleteError) return NextResponse.json({ error: "Hazır setler temizlenemedi." }, { status: 503 });
    }
    for (let index = 0; index < paths.length; index += 500) await auth.admin.storage.from(bucket).remove(paths.slice(index, index + 500));
    await auth.session.rpc("write_admin_audit", { event_action: "bot.photo_pool.cleared", event_target_type: "bot_photo_pool", event_target_id: "available", event_metadata: { sets: setIds.length, photos: paths.length } });
    return NextResponse.json({ cleared: true, sets: setIds.length, photos: paths.length });
  }
  const { data: set } = await auth.admin.from("bot_photo_sets").select("status,bot_photo_set_items(storage_path)").eq("id", parsed.data.setId).maybeSingle();
  if (!set || set.status !== "available") return NextResponse.json({ error: "Yalnızca hazır setler silinebilir." }, { status: 409 });
  const paths = ((set.bot_photo_set_items ?? []) as Array<{ storage_path: string }>).map((item) => item.storage_path);
  const { error } = await auth.admin.from("bot_photo_sets").delete().eq("id", parsed.data.setId).eq("status", "available");
  if (error) return NextResponse.json({ error: "Kişi seti silinemedi." }, { status: 503 });
  if (paths.length) await auth.admin.storage.from(bucket).remove(paths);
  await auth.session.rpc("write_admin_audit", { event_action: "bot.photo_set.deleted", event_target_type: "bot_photo_set", event_target_id: parsed.data.setId, event_metadata: {} });
  return NextResponse.json({ deleted: true });
}

async function createSetFromFiles(admin: SupabaseClient, input: { files: File[]; gender: Gender; ageBand: AgeBand; createdBy: string }) {
  const setId = randomUUID();
  const paths: string[] = [];
  const { error: setError } = await admin.from("bot_photo_sets").insert({ id: setId, gender: input.gender, age_band: input.ageBand, created_by: input.createdBy });
  if (setError) return { ok: false, error: "Kişi seti oluşturulamadı." } as const;
  try {
    for (let index = 0; index < input.files.length; index += 1) {
      const normalized = await normalizeToWebp(input.files[index]);
      const itemId = randomUUID();
      const path = `sets/${setId}/${itemId}.webp`;
      const { error: uploadError } = await admin.storage.from(bucket).upload(path, normalized.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      paths.push(path);
      const { error: itemError } = await admin.from("bot_photo_set_items").insert({ id: itemId, set_id: setId, storage_path: path, sort_order: index, width: normalized.width, height: normalized.height, size_bytes: normalized.bytes.length });
      if (itemError) throw itemError;
    }
    return { ok: true, setId } as const;
  } catch {
    await admin.from("bot_photo_sets").delete().eq("id", setId);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
    return { ok: false, error: "Fotoğraflardan biri işlenemedi; set kaydedilmedi." } as const;
  }
}

async function createSetFromLegacy(admin: SupabaseClient, input: { paths: string[]; gender: Gender; ageBand: AgeBand; createdBy: string }) {
  const setId = randomUUID();
  const moved: string[] = [];
  const { error: setError } = await admin.from("bot_photo_sets").insert({ id: setId, gender: input.gender, age_band: input.ageBand, created_by: input.createdBy });
  if (setError) return { ok: false, error: "Kişi seti oluşturulamadı." } as const;
  try {
    for (let index = 0; index < input.paths.length; index += 1) {
      const sourcePath = input.paths[index];
      const itemId = randomUUID();
      const destinationPath = `sets/${setId}/${itemId}.webp`;
      const { data: blob, error: downloadError } = await admin.storage.from(bucket).download(sourcePath);
      if (downloadError || !blob) throw downloadError ?? new Error("legacy_download_failed");
      const bytes = Buffer.from(await blob.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height) throw new Error("invalid_legacy_image");
      const { error: moveError } = await admin.storage.from(bucket).move(sourcePath, destinationPath);
      if (moveError) throw moveError;
      moved.push(destinationPath);
      const { error: itemError } = await admin.from("bot_photo_set_items").insert({ id: itemId, set_id: setId, storage_path: destinationPath, sort_order: index, width: metadata.width, height: metadata.height, size_bytes: bytes.length });
      if (itemError) throw itemError;
    }
    return { ok: true, setId } as const;
  } catch {
    await admin.from("bot_photo_sets").delete().eq("id", setId);
    for (let index = 0; index < moved.length; index += 1) await admin.storage.from(bucket).move(moved[index], input.paths[index]);
    return { ok: false, error: "Gruplanmamış fotoğraflar sete dönüştürülemedi." } as const;
  }
}

async function assignSet(admin: SupabaseClient, input: { setId: string; profileId: string }) {
  const [{ data: set }, { data: bot }, { count }] = await Promise.all([
    admin.from("bot_photo_sets").select("id,gender,age_band,status,bot_photo_set_items(id,storage_path,sort_order)").eq("id", input.setId).maybeSingle(),
    admin.from("profiles").select("id,gender,birth_date").eq("id", input.profileId).eq("kind", "bot").maybeSingle(),
    admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", input.profileId),
  ]);
  if (!set || set.status !== "available") return { ok: false, error: "set_not_available" } as const;
  if (!bot || (count ?? 0) !== 0) return { ok: false, error: "bot_not_photo_less" } as const;
  if (bot.gender !== set.gender || ageBandFromBirthDate(bot.birth_date) !== set.age_band) return { ok: false, error: "labels_do_not_match" } as const;
  const items = ((set.bot_photo_set_items ?? []) as Array<{ id: string; storage_path: string; sort_order: number }>).toSorted((a, b) => a.sort_order - b.sort_order);
  if (items.length < 1 || items.length > 6) return { ok: false, error: "invalid_set_size" } as const;

  const { data: claimed, error: claimError } = await admin.from("bot_photo_sets").update({ status: "assigning", assigned_profile_id: input.profileId }).eq("id", input.setId).eq("status", "available").select("id").maybeSingle();
  if (claimError || !claimed) return { ok: false, error: "set_already_claimed" } as const;

  const photoIds: string[] = [];
  const profilePaths: string[] = [];
  try {
    for (let index = 0; index < items.length; index += 1) {
      const { data: original, error: downloadError } = await admin.storage.from(bucket).download(items[index].storage_path);
      if (downloadError || !original) throw downloadError ?? new Error("pool_download_failed");
      const source = Buffer.from(await original.arrayBuffer());
      const image = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) throw new Error("invalid_pool_image");
      const photoId = randomUUID();
      const variants: Record<string, string> = {};
      for (const width of widths) {
        const path = `${input.profileId}/${photoId}/${width}.webp`;
        const output = await image.clone().resize({ width, withoutEnlargement: false }).webp({ quality: 82, effort: 4 }).toBuffer();
        const { error: uploadError } = await admin.storage.from("profiles").upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (uploadError) throw uploadError;
        profilePaths.push(path);
        variants[String(width)] = path;
      }
      const { error: insertError } = await admin.from("profile_photos").insert({ id: photoId, profile_id: input.profileId, storage_path: variants["1440"], variants, width: metadata.width, height: metadata.height, sort_order: index, is_primary: index === 0, moderation_status: "approved", processing_status: "ready", source_set_id: input.setId });
      if (insertError) throw insertError;
      photoIds.push(photoId);
    }
    const { data: completed, error: updateError } = await admin.from("bot_photo_sets").update({ status: "assigned", assigned_profile_id: input.profileId, assigned_at: new Date().toISOString() }).eq("id", input.setId).eq("status", "assigning").eq("assigned_profile_id", input.profileId).select("id").maybeSingle();
    if (updateError || !completed) throw updateError ?? new Error("assignment_claim_lost");
    return { ok: true } as const;
  } catch (error) {
    if (photoIds.length) await admin.from("profile_photos").delete().in("id", photoIds);
    if (profilePaths.length) await admin.storage.from("profiles").remove(profilePaths);
    await admin.from("bot_photo_sets").update({ status: "available", assigned_profile_id: null, assigned_at: null }).eq("id", input.setId).eq("status", "assigning");
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 120) : "assignment_failed" } as const;
  }
}

function proposeAssignments(sets: Array<{ id: string; gender: string; ageBand: string; status: string }>, bots: Array<{ id: string; name: string; gender: Gender; ageBand: AgeBand; age: number; createdAt: string }>) {
  const remaining = [...bots];
  return sets.filter((set) => set.status === "available").flatMap((set) => {
    const index = remaining.findIndex((bot) => bot.gender === set.gender && bot.ageBand === set.ageBand);
    if (index < 0) return [];
    const [bot] = remaining.splice(index, 1);
    return [{ setId: set.id, profileId: bot.id, profileName: bot.name, age: bot.age }];
  });
}

function ageFromBirthDate(value: string) {
  const birth = new Date(`${value}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function ageBandFromBirthDate(value: string): AgeBand {
  const age = ageFromBirthDate(value);
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  return "45+";
}

async function ensurePoolBucket(admin: SupabaseClient) {
  const { data } = await admin.storage.getBucket(bucket);
  if (data) return null;
  const { error } = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: maxFileBytes, allowedMimeTypes: ["image/webp"] });
  return error ? "Resim havuzu Storage alanı oluşturulamadı." : null;
}

async function listLegacyFiles(admin: SupabaseClient, prefix: string) {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  return (data ?? []).filter((item) => item.id && item.name.toLowerCase().endsWith(".webp"));
}

async function legacyItem(admin: SupabaseClient, gender: Gender, prefix: string, file: Awaited<ReturnType<typeof listLegacyFiles>>[number]) {
  const path = `${prefix}/${file.name}`;
  return { path, gender, name: displayName(file.name), sizeBytes: Number((file.metadata as { size?: number } | null)?.size ?? 0), url: await signedPoolUrl(admin, path) };
}

async function signedPoolUrl(admin: SupabaseClient, path: string) {
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 900);
  return data?.signedUrl ?? null;
}

function displayName(name: string) {
  return name.replace(/^[0-9a-f-]{36}-/i, "").replace(/\.webp$/i, "").replace(/-/g, " ");
}

async function normalizeToWebp(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const looksHeic = extension === "heic" || extension === "heif" || file.type === "image/heic" || file.type === "image/heif";
  let source = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  } catch {
    if (!looksHeic) throw new Error("invalid_image");
    source = Buffer.from(await heicConvert({ buffer: source, format: "PNG", quality: 1 }));
    metadata = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  }
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp", "heif"].includes(metadata.format ?? "")) throw new Error("invalid_image");
  const bytes = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toBuffer();
  const normalizedMetadata = await sharp(bytes).metadata();
  return { bytes, width: normalizedMetadata.width ?? metadata.width, height: normalizedMetadata.height ?? metadata.height };
}
