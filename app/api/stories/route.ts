import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function context() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile ? { admin, profileId: profile.id } : null;
}

const unavailable = () => NextResponse.json({ error: "Oturum veya profil gerekli." }, { status: 401 });

async function allowedProfiles(ctx: NonNullable<Awaited<ReturnType<typeof context>>>) {
  const { admin, profileId } = ctx;
  const { data: matches, error: matchesError } = await admin.from("matches")
    .select("user_a,user_b").eq("status", "active").in("connection_type", ["matched", "direct_chat"])
    .or(`user_a.eq.${profileId},user_b.eq.${profileId}`);
  if (matchesError) return NextResponse.json({ error: "Hikayeler yüklenemedi." }, { status: 503 });
  const peerIds = (matches ?? []).map((match) => match.user_a === profileId ? match.user_b : match.user_a);
  const { data: blocks, error: blocksError } = await admin.from("blocks").select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`);
  if (blocksError) return NextResponse.json({ error: "Hikayeler yüklenemedi." }, { status: 503 });
  const blocked = new Set((blocks ?? []).map((row) => row.blocker_id === profileId ? row.blocked_id : row.blocker_id));
  const allowed = [...new Set([profileId, ...peerIds.filter((id) => !blocked.has(id))])];
  return allowed;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return unavailable();
  const { admin, profileId } = ctx;
  const allowed = await allowedProfiles(ctx);
  if (allowed instanceof NextResponse) return allowed;
  const { data: rows, error } = await admin.from("profile_stories")
    .select("id,profile_id,storage_path,created_at,expires_at")
    .in("profile_id", allowed).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: "Hikayeler yüklenemedi." }, { status: 503 });
  const ids = [...new Set((rows ?? []).map((row) => row.profile_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id,display_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const { data: views, error: viewError } = await admin.from("story_views").select("story_id").eq("profile_id", profileId);
  if (viewError) return NextResponse.json({ error: "Hikayeler yüklenemedi." }, { status: 503 });
  const seen = new Set((views ?? []).map((view) => view.story_id));
  const stories = await Promise.all((rows ?? []).map(async (row) => {
    const { data } = await admin.storage.from("profiles").createSignedUrl(row.storage_path, 900);
    return data?.signedUrl ? {
      id: row.id, profileId: row.profile_id, name: names.get(row.profile_id) ?? "Üye",
      url: data.signedUrl, createdAt: row.created_at, expiresAt: row.expires_at,
      own: row.profile_id === profileId,
      seen: seen.has(row.id),
    } : null;
  }));
  return NextResponse.json({ stories: stories.filter(Boolean) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const ctx = await context(); if (!ctx) return unavailable();
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "Geçersiz hikaye." }, { status: 400 });
  const allowed = await allowedProfiles(ctx);
  if (allowed instanceof NextResponse) return allowed;
  const { data: story } = await ctx.admin.from("profile_stories").select("id").eq("id", body.id).in("profile_id", allowed).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!story) return NextResponse.json({ error: "Hikaye bulunamadı." }, { status: 404 });
  const { error } = await ctx.admin.from("story_views").upsert({ profile_id: ctx.profileId, story_id: story.id });
  return error ? NextResponse.json({ error: "Görüntüleme kaydedilemedi." }, { status: 503 }) : NextResponse.json({ seen: true });
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx) return unavailable();
  const { admin, profileId } = ctx;
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    || file.size === 0 || file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "En fazla 12 MB JPG, PNG veya WebP fotoğraf seç." }, { status: 400 });
  }
  const { count, error: countError } = await admin.from("profile_stories")
    .select("id", { count: "exact", head: true }).eq("profile_id", profileId)
    .gt("expires_at", new Date().toISOString());
  if (countError) return NextResponse.json({ error: "Hikaye yüklenemedi." }, { status: 503 });
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "En fazla 10 aktif hikaye ekleyebilirsin." }, { status: 409 });
  let output: Buffer;
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate().resize({ width: 1080, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Fotoğraf okunamadı." }, { status: 400 });
  }
  if (output.length > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Fotoğraf sıkıştırılamadı. Başka bir fotoğraf seç." }, { status: 400 });
  }
  const id = randomUUID();
  const path = `${profileId}/stories/${id}.webp`;
  const { error: uploadError } = await admin.storage.from("profiles").upload(path, output, {
    contentType: "image/webp", cacheControl: "86400", upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "Hikaye yüklenemedi." }, { status: 503 });
  const { error: insertError } = await admin.from("profile_stories").insert({ id, profile_id: profileId, storage_path: path });
  if (insertError) {
    await admin.storage.from("profiles").remove([path]);
    return NextResponse.json({ error: "Hikaye kaydedilemedi." }, { status: 503 });
  }
  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const ctx = await context();
  if (!ctx) return unavailable();
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return NextResponse.json({ error: "Geçersiz hikaye." }, { status: 400 });
  }
  const { admin, profileId } = ctx;
  const { data: row } = await admin.from("profile_stories").select("storage_path")
    .eq("id", body.id).eq("profile_id", profileId).maybeSingle();
  if (!row) return NextResponse.json({ error: "Hikaye bulunamadı." }, { status: 404 });
  const { error } = await admin.from("profile_stories").delete().eq("id", body.id).eq("profile_id", profileId);
  if (error) return NextResponse.json({ error: "Hikaye silinemedi." }, { status: 503 });
  await admin.storage.from("profiles").remove([row.storage_path]);
  return NextResponse.json({ removed: body.id });
}
