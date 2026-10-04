import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const botSchema = z.object({
  name: z.string().trim().min(1).max(60),
  age: z.number().int().min(18).max(99),
  gender: z.string().trim().min(1).max(40).default("unspecified"),
  city: z.string().trim().max(80).default("İstanbul"),
  persona: z.string().trim().min(20).max(8000),
  provider: z.enum(["inherit", "openai", "openrouter", "deepseek", "gemini"]).default("inherit"),
  model: z.string().trim().min(1).max(160).default("gpt-5.6-luna"),
  badges: z.array(z.string().trim()).max(3).default([]),
  prompt: z.string().trim().max(240).optional(),
  answer: z.string().trim().max(240).optional(),
  photoPath: z.string().trim().max(240).optional(),
});
const requestSchema = z.union([botSchema, z.object({ bots: z.array(botSchema).min(1).max(100) })]);
const bulkActionSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(["automation_on", "automation_off", "show", "hide", "delete"]) });
export const runtime = "nodejs";
const seedWidths = [480, 960, 1440] as const;
let seedImagesPromise: Promise<string[]> | undefined;

async function attachSeedPhoto(service: SupabaseClient, profileId: string, requestedPath: string | undefined, fallbackIndex: number) {
  seedImagesPromise ??= readdir(path.join(process.cwd(), "public", "bot-seeds"), { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile() && /\.(jpe?g|png|webp)$/i.test(entry.name)).map((entry) => entry.name).sort());
  const images = await seedImagesPromise;
  if (!images.length) return;
  const seedDir = path.resolve(process.cwd(), "public", "bot-seeds");
  const requestedName = requestedPath?.startsWith("/bot-seeds/") ? path.basename(requestedPath) : "";
  const selected = images.includes(requestedName) ? requestedName : images[fallbackIndex % images.length];
  const source = await readFile(path.join(seedDir, selected));
  const image = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Bot seed fotoğrafının boyutu okunamadı.");
  const photoId = randomUUID();
  const variants: Record<string, string> = {};
  const uploaded: string[] = [];
  try {
    for (const width of seedWidths) {
      const storagePath = `${profileId}/${photoId}/${width}.webp`;
      const output = await image.clone().resize({ width, withoutEnlargement: false }).webp({ quality: 82, effort: 4 }).toBuffer();
      const { error } = await service.storage.from("profiles").upload(storagePath, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (error) throw error;
      uploaded.push(storagePath); variants[String(width)] = storagePath;
    }
    const { error } = await service.from("profile_photos").insert({ id: photoId, profile_id: profileId, storage_path: variants["1440"], variants, width: metadata.width, height: metadata.height, sort_order: 0, is_primary: true, moderation_status: "approved", processing_status: "ready" });
    if (error) throw error;
  } catch (error) {
    await service.storage.from("profiles").remove(uploaded);
    throw error;
  }
}

export async function GET() {
  const session = await createSessionClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: allowed } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!allowed || !["owner", "bot_editor"].includes(allowed.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  const service = createServiceClient(url, key, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);
  const [botResult, activeProfiles, todayMatches, botMessages] = await Promise.all([
    service.from("profiles").select("id,display_name,birth_date,is_discoverable,created_at,profile_photos(storage_path,variants,is_primary),profile_intentions(intent_badges(label))", { count: "exact" }).eq("kind", "bot").order("created_at", { ascending: false }).limit(1000),
    service.from("profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
    service.from("matches").select("id", { count: "exact", head: true }).gte("matched_at", `${today}T00:00:00.000Z`),
    service.from("messages").select("id,profiles!messages_sender_id_fkey(kind)", { count: "exact", head: true }).eq("profiles.kind", "bot"),
  ]);
  const bots = botResult.data;
  const botIds = (bots ?? []).map((bot) => bot.id);
  const photoPathByBotId = new Map((bots ?? []).flatMap((bot) => {
    const photos = bot.profile_photos as unknown as { storage_path: string; variants: Record<string, string> | null; is_primary: boolean }[];
    const photo = photos?.toSorted((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
    const path = photo?.variants?.["480"] ?? photo?.storage_path;
    return path ? [[bot.id, path] as const] : [];
  }));
  const signedPaths = [...new Set([...photoPathByBotId.values()].filter((path) => !path.startsWith("/")))];
  const { data: signedPhotos } = signedPaths.length
    ? await service.storage.from("profiles").createSignedUrls(signedPaths, 900)
    : { data: [] };
  const signedUrlByPath = new Map((signedPhotos ?? []).map((photo) => [photo.path, photo.signedUrl]));
  const [{ data: overrides }, { data: jobs }, { data: risks }, botLikes, pendingBotMatches, completedBotMatches] = await Promise.all([
    botIds.length ? service.from("bot_automation_overrides").select("profile_id,automation_enabled").in("profile_id", botIds) : Promise.resolve({ data: [] }),
    botIds.length ? service.from("bot_reply_jobs").select("bot_profile_id,status,updated_at").in("bot_profile_id", botIds).order("updated_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
    service.from("bot_risk_events").select("match_id,severity,status,matches(user_a,user_b)").in("status", ["open","reviewing"]).limit(500),
    service.from("bot_match_decisions").select("id", { count: "exact", head: true }),
    service.from("bot_match_decisions").select("id", { count: "exact", head: true }).eq("status", "queued"),
    service.from("bot_match_decisions").select("id", { count: "exact", head: true }).eq("status", "matched"),
  ]);
  const overrideMap = new Map((overrides ?? []).map((item) => [item.profile_id, item.automation_enabled]));
  const jobsByBot = new Map<string, typeof jobs>();
  for (const job of jobs ?? []) {
    const list = jobsByBot.get(job.bot_profile_id) ?? [];
    list.push(job);
    jobsByBot.set(job.bot_profile_id, list);
  }
  const riskBotIds = new Set<string>();
  for (const risk of risks ?? []) { const match = risk.matches as unknown as { user_a: string; user_b: string } | null; if (match) { if (botIds.includes(match.user_a)) riskBotIds.add(match.user_a); if (botIds.includes(match.user_b)) riskBotIds.add(match.user_b); } }
  const rows = (bots ?? []).map((bot) => {
    const birth = new Date(`${bot.birth_date}T00:00:00Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
    const path = photoPathByBotId.get(bot.id);
    const intentions = bot.profile_intentions as unknown as { intent_badges: { label: string } | null }[];
    const botJobs = jobsByBot.get(bot.id) ?? [];
    const pendingJobs = botJobs.filter((job) => ["queued","typing","processing"].includes(job.status)).length;
    const failedJobs = botJobs.filter((job) => job.status === "failed").length;
    return { id: bot.id, name: bot.display_name, age, active: bot.is_discoverable, image: path?.startsWith("/") ? path : path ? signedUrlByPath.get(path) ?? null : null, badges: intentions?.flatMap((item) => item.intent_badges?.label ? [item.intent_badges.label] : []) ?? [], automationEnabled: overrideMap.get(bot.id) !== false, pendingJobs, failedJobs, needsReview: failedJobs > 0 || riskBotIds.has(bot.id), lastActivityAt: botJobs[0]?.updated_at ?? bot.created_at };
  });
  const botLikeCount = botLikes.count ?? 0;
  const botMatchedCount = completedBotMatches.count ?? 0;
  return NextResponse.json({ bots: rows, stats: { activeProfiles: activeProfiles.count ?? 0, todayMatches: todayMatches.count ?? 0, botMessages: botMessages.count ?? 0, bots: botResult.count ?? rows.length, botLikes: botLikeCount, pendingBotMatches: pendingBotMatches.count ?? 0, completedBotMatches: botMatchedCount, botMatchRate: botLikeCount ? Math.round(botMatchedCount / botLikeCount * 1000) / 10 : 0 }, permissions: { canDeleteBots: allowed.role === "owner" } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bot verileri geçersiz.", details: parsed.error.flatten() }, { status: 400 });
  const session = await createSessionClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: allowed } = await session!.from("admin_users").select("user_id,role").eq("user_id", user.id).maybeSingle();
  if (!allowed || !["owner", "bot_editor"].includes(allowed.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  const service = createServiceClient(url, key, { auth: { persistSession: false } });
  const bots = "bots" in parsed.data ? parsed.data.bots : [parsed.data];
  const created: string[] = [];
  for (let botIndex = 0; botIndex < bots.length; botIndex++) {
    const bot = bots[botIndex];
    const birth = new Date();
    birth.setUTCFullYear(birth.getUTCFullYear() - bot.age);
    const { data: profile, error } = await service.from("profiles").insert({ kind: "bot", display_name: bot.name, birth_date: birth.toISOString().slice(0, 10), gender: bot.gender, city: bot.city, onboarding_completed: true, is_discoverable: false }).select("id").single();
    if (error || !profile) return NextResponse.json({ error: error?.message ?? "Profil oluşturulamadı.", created }, { status: 500 });
    created.push(profile.id);
    const writes: PromiseLike<unknown>[] = [
      service.from("bot_personas").insert({ profile_id: profile.id, persona: bot.persona, provider: bot.provider, model: bot.model, created_by: user.id }),
      service.from("bot_persona_versions").insert({ profile_id: profile.id, version_number: 1, status: "published", persona: bot.persona, provider: bot.provider, model: bot.model, created_by: user.id, published_by: user.id, published_at: new Date().toISOString() }),
    ];
    if (bot.badges.length) {
      const { data: badges } = await service.from("intent_badges").select("id,label").in("label", bot.badges);
      if (badges?.length) writes.push(service.from("profile_intentions").insert(badges.map((badge) => ({ profile_id: profile.id, badge_id: badge.id }))));
    }
    if (bot.prompt && bot.answer) {
      const { data: prompt } = await service.from("icebreaker_prompts").select("id").eq("prompt", bot.prompt).maybeSingle();
      if (prompt) writes.push(service.from("profile_answers").insert({ profile_id: profile.id, prompt_id: prompt.id, answer: bot.answer }));
    }
    const results = await Promise.all(writes);
    const failed = results.find((result) => Boolean(result && typeof result === "object" && "error" in result && result.error));
    if (failed && typeof failed === "object" && "error" in failed) {
      await service.from("profiles").update({ is_discoverable: false }).eq("id", profile.id);
      const message = failed.error && typeof failed.error === "object" && "message" in failed.error ? String(failed.error.message) : "Bot ayrıntıları kaydedilemedi.";
      return NextResponse.json({ error: message, created, quarantined: profile.id }, { status: 500 });
    }
    try { await attachSeedPhoto(service, profile.id, bot.photoPath, botIndex); }
    catch (error) { await service.from("profiles").update({ is_discoverable: false }).eq("id", profile.id); const detail = error instanceof Error ? error.message.slice(0, 180) : "bilinmeyen hata"; return NextResponse.json({ error: `Bot seed fotoğrafı kaydedilemedi: ${detail}`, created, quarantined: profile.id }, { status: 500 }); }
  }
  await session!.rpc("write_admin_audit", {
    event_action: "bots.created",
    event_target_type: "bot_profile",
    event_target_id: created.join(","),
    event_metadata: { count: created.length },
  });
  return NextResponse.json({ created }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = bulkActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Toplu işlem verileri geçersiz." }, { status: 400 });
  const session = await createSessionClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: allowed } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!allowed || !["owner", "bot_editor"].includes(allowed.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  const service = createServiceClient(url, key, { auth: { persistSession: false } });
  const ids = [...new Set(parsed.data.ids)];
  const { action } = parsed.data;
  if (action === "delete" && allowed.role !== "owner") return NextResponse.json({ error: "Botları yalnızca kurucu silebilir." }, { status: 403 });
  const { data: selectedProfiles } = await service.from("profiles").select("id,gender").in("id", ids).eq("kind", "bot");
  if (selectedProfiles?.length !== ids.length) return NextResponse.json({ error: "Seçimde geçersiz bot var." }, { status: 409 });
  if (action === "delete") {
    const [{ data: photos }, { data: matches }, linkedPayments] = await Promise.all([
      service.from("profile_photos").select("storage_path,variants").in("profile_id", ids),
      service.from("matches").select("id").or(`user_a.in.(${ids.join(",")}),user_b.in.(${ids.join(",")})`),
      service.from("payment_orders").select("id", { count: "exact", head: true }).in("profile_id", ids),
    ]);
    if ((linkedPayments.count ?? 0) > 0) return NextResponse.json({ error: "Ödeme kaydı bulunan bot silinemez." }, { status: 409 });
    const matchIds = (matches ?? []).map((match) => match.id);
    const [audioResult, poolPaths] = await Promise.all([
      matchIds.length
        ? service.from("messages").select("audio_path").in("match_id", matchIds).not("audio_path", "is", null)
        : Promise.resolve({ data: [] as { audio_path: string | null }[] }),
      collectAssignedPoolPaths(service, selectedProfiles),
    ]);
    const { error: reportError } = await service.from("reports").delete().or(`reporter_id.in.(${ids.join(",")}),reported_id.in.(${ids.join(",")})`);
    if (reportError) return NextResponse.json({ error: "Bot rapor bağlantıları temizlenemedi." }, { status: 503 });
    const { data: deleted, error } = await service.from("profiles").delete().in("id", ids).eq("kind", "bot").select("id");
    if (error || deleted?.length !== ids.length) return NextResponse.json({ error: "Botlar silinemedi; işlem durduruldu." }, { status: 503 });

    const photoPaths = new Set<string>();
    for (const photo of photos ?? []) {
      if (photo.storage_path) photoPaths.add(photo.storage_path);
      const variants = photo.variants as Record<string, string> | null;
      for (const path of Object.values(variants ?? {})) if (path) photoPaths.add(path);
    }
    await Promise.all([
      removeStorageBatches(service, "profiles", [...photoPaths]),
      removeStorageBatches(service, "voice-messages", (audioResult.data ?? []).flatMap((message) => message.audio_path ? [message.audio_path] : [])),
      removeStorageBatches(service, "bot-photo-pool", poolPaths),
    ]);
    await session.rpc("write_admin_audit", { event_action: "bots.bulk.delete", event_target_type: "bot_profile", event_target_id: ids.join(","), event_metadata: { count: ids.length } });
    return NextResponse.json({ deleted: ids.length });
  }
  if (action === "show") {
    const [{ data: photoRows }, { data: personaRows }] = await Promise.all([
      service.from("profile_photos").select("profile_id").in("profile_id", ids).eq("processing_status", "ready").eq("moderation_status", "approved"),
      service.from("bot_persona_versions").select("profile_id").in("profile_id", ids).eq("status", "published"),
    ]);
    const photoCounts = new Map<string, number>();
    for (const row of photoRows ?? []) photoCounts.set(row.profile_id, (photoCounts.get(row.profile_id) ?? 0) + 1);
    const personas = new Set((personaRows ?? []).map((row) => row.profile_id));
    const readyIds = ids.filter((id) => (photoCounts.get(id) ?? 0) >= 1 && personas.has(id));
    if (readyIds.length) await service.from("profiles").update({ is_discoverable: true, updated_at: new Date().toISOString() }).in("id", readyIds).eq("kind", "bot");
    await session.rpc("write_admin_audit", { event_action: "bots.bulk.show", event_target_type: "bot_profile", event_target_id: readyIds.join(","), event_metadata: { ready: readyIds.length, skipped: ids.length - readyIds.length } });
    return NextResponse.json({ updated: readyIds.length, skipped: ids.length - readyIds.length });
  }
  const result = action === "hide"
    ? await service.from("profiles").update({ is_discoverable: false, updated_at: new Date().toISOString() }).in("id", ids).eq("kind", "bot")
    : await service.from("bot_automation_overrides").upsert(ids.map((profileId) => ({ profile_id: profileId, automation_enabled: action === "automation_on", updated_by: user.id, updated_at: new Date().toISOString() })));
  if (result.error) return NextResponse.json({ error: "Toplu işlem tamamlanamadı." }, { status: 503 });
  await session.rpc("write_admin_audit", { event_action: `bots.bulk.${action}`, event_target_type: "bot_profile", event_target_id: ids.join(","), event_metadata: { count: ids.length } });
  return NextResponse.json({ updated: ids.length });
}

async function removeStorageBatches(service: SupabaseClient, bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 500) {
    await service.storage.from(bucket).remove(paths.slice(index, index + 500));
  }
}

async function collectAssignedPoolPaths(service: SupabaseClient, profiles: Array<{ id: string; gender: string }>) {
  const paths: string[] = [];
  for (const profile of profiles) {
    if (profile.gender !== "kadın" && profile.gender !== "erkek") continue;
    const genderPath = profile.gender === "kadın" ? "kadin" : "erkek";
    const prefix = `assigned/${genderPath}/${profile.id}`;
    const { data } = await service.storage.from("bot-photo-pool").list(prefix, { limit: 100 });
    for (const item of data ?? []) if (item.id) paths.push(`${prefix}/${item.name}`);
  }
  return paths;
}
