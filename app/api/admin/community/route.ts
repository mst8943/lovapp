import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin(["owner", "moderator"]); if (auth instanceof NextResponse) return auth;
  const [stories, options, intents] = await Promise.all([
    auth.admin.from("profile_stories").select("id,profile_id,storage_path,created_at,expires_at,profiles!profile_stories_profile_id_fkey(display_name)").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(200),
    auth.admin.from("meeting_options").select("*").order("sort_order").order("id"),
    auth.admin.from("meeting_intents").select("profile_id,option_id,expires_at,profiles(display_name)").gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(200),
  ]);
  if (stories.error || options.error || intents.error) return NextResponse.json({ error: "Yönetim verileri yüklenemedi." }, { status: 503 });
  const photos = await Promise.all(stories.data.map(async ({ storage_path, ...story }) => {
    const { data } = await auth.admin.storage.from("profiles").createSignedUrl(storage_path, 600);
    return { ...story, url: data?.signedUrl };
  }));
  return NextResponse.json({ stories: photos, options: options.data, intents: intents.data }, { headers: { "Cache-Control": "private, no-store" } });
}
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("removeStory"), id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("removeIntent"), id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("saveOption"), id: z.string().uuid().optional(), label: z.string().trim().min(2).max(60), icon: z.enum(["coffee", "walk", "event"]), active: z.boolean(), sort_order: z.number().int().min(0).max(100) }),
]);
export async function POST(request: Request) {
  const auth = await requireAdmin(["owner", "moderator"]); if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bilgileri ve kaldırma nedenini kontrol edin." }, { status: 400 });
  const body = parsed.data;
  if (body.action === "saveOption") {
    if (auth.role !== "owner") return NextResponse.json({ error: "Seçenekleri yalnızca yönetici düzenleyebilir." }, { status: 403 });
    const option = { ...(body.id ? { id: body.id } : {}), label: body.label, icon: body.icon, active: body.active, sort_order: body.sort_order };
    const { error } = await auth.admin.from("meeting_options").upsert(option);
    if (error) return NextResponse.json({ error: "Seçenek kaydedilemedi." }, { status: 503 });
  } else if (body.action === "removeStory") {
    const { data: story } = await auth.admin.from("profile_stories").select("storage_path").eq("id", body.id).maybeSingle();
    if (!story) return NextResponse.json({ error: "Hikaye bulunamadı." }, { status: 404 });
    const { error } = await auth.admin.from("profile_stories").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: "Hikaye kaldırılamadı." }, { status: 503 });
    await auth.admin.storage.from("profiles").remove([story.storage_path]);
  } else {
    const { error } = await auth.admin.from("meeting_intents").delete().eq("profile_id", body.id);
    if (error) return NextResponse.json({ error: "Plan kaldırılamadı." }, { status: 503 });
  }
  await auth.session.rpc("write_admin_audit", { event_action: `community.${body.action}`, event_target_type: "community", event_target_id: body.id ?? null, event_metadata: body });
  return NextResponse.json({ ok: true });
}
