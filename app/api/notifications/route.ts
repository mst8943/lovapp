import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function notificationContext() {
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return null;
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  return profile ? { admin, profileId: profile.id } : null;
}

export async function GET() {
  const context = await notificationContext();
  if (!context) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: state } = await context.admin.from("notification_read_state").select("likes_seen_at").eq("profile_id", context.profileId).maybeSingle();
  const seenAt = state?.likes_seen_at ?? "1970-01-01T00:00:00.000Z";
  const [likes, superLikes] = await Promise.all([
    context.admin.from("swipes").select("id", { count: "exact", head: true }).eq("target_id", context.profileId).in("direction", ["right", "super"]).gt("created_at", seenAt),
    context.admin.from("swipes").select("id", { count: "exact", head: true }).eq("target_id", context.profileId).eq("direction", "super").gt("created_at", seenAt),
  ]);
  return NextResponse.json({ unreadLikes: likes.count ?? 0, unreadSuperLikes: superLikes.count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH() {
  const context = await notificationContext();
  if (!context) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const seenAt = new Date().toISOString();
  const { error } = await context.admin.from("notification_read_state").upsert({ profile_id: context.profileId, likes_seen_at: seenAt, updated_at: seenAt }, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: "Bildirimler okunmuş olarak işaretlenemedi." }, { status: 503 });
  return NextResponse.json({ unreadLikes: 0, unreadSuperLikes: 0, seenAt });
}
