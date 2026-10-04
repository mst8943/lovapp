import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveStoragePhoto } from "@/lib/discovery";

const schema = z.object({ name: z.string().trim().min(2).max(60), birthDate: z.string().date(), gender: z.string().trim().min(1).max(40), city: z.string().trim().max(80), badges: z.array(z.string().trim().min(1).max(80)).max(3), prompt: z.string().trim().min(1).max(240), answer: z.string().trim().min(1).max(160), discoverable: z.boolean() });
type Context = { params: Promise<{ profileId: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireAdmin(["owner","bot_editor"]); if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params; if (!z.string().uuid().safeParse(profileId).success) return NextResponse.json({ error: "Geçersiz bot." }, { status: 400 });
  const [{ data: profile }, { data: photos }, { data: intentions }, { data: answer }, { data: persona }] = await Promise.all([
    auth.admin.from("profiles").select("id,display_name,birth_date,gender,city,is_discoverable").eq("id", profileId).eq("kind", "bot").maybeSingle(),
    auth.admin.from("profile_photos").select("id,storage_path,variants,sort_order,is_primary").eq("profile_id", profileId).order("sort_order"),
    auth.admin.from("profile_intentions").select("intent_badges(label)").eq("profile_id", profileId),
    auth.admin.from("profile_answers").select("answer,icebreaker_prompts(prompt)").eq("profile_id", profileId).order("sort_order").limit(1).maybeSingle(),
    auth.admin.from("bot_persona_versions").select("id").eq("profile_id", profileId).eq("status", "published").maybeSingle(),
  ]);
  if (!profile) return NextResponse.json({ error: "Bot bulunamadı." }, { status: 404 });
  const signedPhotos = (await Promise.all((photos ?? []).map(async (photo) => { const variants = photo.variants as Record<string,string> | null; const url = await resolveStoragePhoto(variants?.["480"] ?? photo.storage_path, auth.admin); return url ? { id: photo.id, url, isPrimary: photo.is_primary } : null; }))).filter(Boolean);
  const prompt = answer?.icebreaker_prompts as unknown as { prompt: string } | null;
  return NextResponse.json({ profile: { name: profile.display_name, birthDate: profile.birth_date, gender: profile.gender, city: profile.city ?? "", discoverable: profile.is_discoverable, badges: (intentions ?? []).flatMap((item) => { const badge = item.intent_badges as unknown as { label: string } | null; return badge?.label ? [badge.label] : []; }), prompt: prompt?.prompt ?? "", answer: answer?.answer ?? "", photos: signedPhotos, personaPublished: Boolean(persona), ready: signedPhotos.length >= 1 && Boolean(persona) && Boolean(answer) } });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin(["owner","bot_editor"]); if (auth instanceof NextResponse) return auth;
  const { profileId } = await context.params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(profileId).success || !parsed.success) return NextResponse.json({ error: "Bot profil bilgilerini kontrol et." }, { status: 400 });
  const { data: bot } = await auth.admin.from("profiles").select("id").eq("id", profileId).eq("kind", "bot").maybeSingle();
  if (!bot) return NextResponse.json({ error: "Bot bulunamadı." }, { status: 404 });
  const [{ count: photos }, { data: persona }] = await Promise.all([auth.admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", profileId), auth.admin.from("bot_persona_versions").select("id").eq("profile_id", profileId).eq("status", "published").maybeSingle()]);
  if (parsed.data.discoverable && ((photos ?? 0) < 1 || !persona)) return NextResponse.json({ error: "Keşfete açmak için en az 1 fotoğraf ve yayınlanmış persona gerekli." }, { status: 409 });
  const { data: badges } = parsed.data.badges.length ? await auth.admin.from("intent_badges").select("id,label").in("label", parsed.data.badges) : { data: [] };
  const { data: prompt } = await auth.admin.from("icebreaker_prompts").select("id").eq("prompt", parsed.data.prompt).maybeSingle();
  if (!prompt || (badges?.length ?? 0) !== parsed.data.badges.length) return NextResponse.json({ error: "Profil sorusu veya niyetlerden biri bulunamadı." }, { status: 400 });
  const { error } = await auth.admin.from("profiles").update({ display_name: parsed.data.name, birth_date: parsed.data.birthDate, gender: parsed.data.gender, city: parsed.data.city || null, is_discoverable: parsed.data.discoverable, updated_at: new Date().toISOString() }).eq("id", profileId).eq("kind", "bot");
  if (error) return NextResponse.json({ error: "Bot profili güncellenemedi." }, { status: 503 });
  const deleteIntentions = await auth.admin.from("profile_intentions").delete().eq("profile_id", profileId);
  const insertIntentions = badges?.length ? await auth.admin.from("profile_intentions").insert(badges.map((badge) => ({ profile_id: profileId, badge_id: badge.id }))) : { error: null };
  const deleteAnswers = await auth.admin.from("profile_answers").delete().eq("profile_id", profileId);
  const insertAnswer = await auth.admin.from("profile_answers").insert({ profile_id: profileId, prompt_id: prompt.id, answer: parsed.data.answer });
  if (deleteIntentions.error || insertIntentions.error || deleteAnswers.error || insertAnswer.error) return NextResponse.json({ error: "Bot profil ayrıntıları tamamen kaydedilemedi; tekrar deneyin." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.profile.updated", event_target_type: "bot_profile", event_target_id: profileId, event_metadata: { discoverable: parsed.data.discoverable } });
  return NextResponse.json({ saved: true });
}
