import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const idSchema = z.string().uuid();
const bodySchema = z.object({ body: z.string().trim().min(1).max(1000) });
const ROLES = ["owner", "support", "moderator"] as const;

export async function GET(_: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin([...ROLES]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  if (!idSchema.safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz profil." }, { status: 400 });
  const { data, error } = await auth.admin.from("admin_user_notes").select("id,author_id,body,created_at").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Notlar yüklenemedi. 076 migration'ı uygulanmış mı?" }, { status: 503 });
  const authors = new Map<string, string>();
  await Promise.all([...new Set((data ?? []).map((note) => note.author_id as string))].map(async (id) => {
    const { data: found } = await auth.admin.auth.admin.getUserById(id);
    authors.set(id, found.user?.email ?? "Yönetici");
  }));
  return NextResponse.json({ notes: (data ?? []).map((note) => ({ ...note, author: authors.get(note.author_id as string) ?? "Yönetici", mine: note.author_id === auth.user.id })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin([...ROLES]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!idSchema.safeParse(profileId).success || !parsed.success) return NextResponse.json({ error: "Not 1-1000 karakter olmalı." }, { status: 400 });
  const { error } = await auth.admin.from("admin_user_notes").insert({ profile_id: profileId, author_id: auth.user.id, body: parsed.data.body });
  if (error) return NextResponse.json({ error: "Not kaydedilemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "user.note_added", event_target_type: "profile", event_target_id: profileId, event_metadata: {} });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireAdmin([...ROLES]);
  if (auth instanceof NextResponse) return auth;
  const { profileId } = await params;
  const noteId = new URL(request.url).searchParams.get("noteId") ?? "";
  if (!idSchema.safeParse(profileId).success || !idSchema.safeParse(noteId).success) return NextResponse.json({ error: "Geçersiz not." }, { status: 400 });
  let query = auth.admin.from("admin_user_notes").delete().eq("id", noteId).eq("profile_id", profileId);
  if (auth.role !== "owner") query = query.eq("author_id", auth.user.id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Not silinemedi." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
