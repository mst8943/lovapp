import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { MAX_AUDIENCE, resolveAudience, SEGMENTS, type Segment } from "@/lib/audience";
import { sendPushToProfile } from "@/lib/push";

const segmentKeys = Object.keys(SEGMENTS) as [Segment, ...Segment[]];
const schema = z.object({
  mode: z.enum(["preview", "test", "send"]),
  segment: z.enum(segmentKeys),
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(160),
  url: z.string().trim().max(200).regex(/^\/[^\s]*$/, "Bağlantı / ile başlayan bir yol olmalı.").optional().or(z.literal("")),
  confirmCount: z.number().int().optional(),
});
const COOLDOWN_MS = 5 * 60_000;

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bildirim bilgilerini kontrol et." }, { status: 400 });
  const { mode, segment, title, body, url } = parsed.data;
  const payload = { title, body, url: url || "/", tag: `campaign-${Date.now()}` };

  if (mode === "test") {
    const { data: me } = await auth.admin.from("profiles").select("id").eq("user_id", auth.user.id).eq("kind", "human").maybeSingle();
    if (!me) return NextResponse.json({ error: "Test için senin üye profilin gerekli. Önce siteye üye olarak giriş yap." }, { status: 409 });
    await sendPushToProfile(auth.admin, me.id, payload, { bypassQuietHours: true });
    return NextResponse.json({ ok: true, message: "Test bildirimi sana gönderildi. Cihazında bildirim izni açık olmalı." });
  }

  const audience = await resolveAudience(auth.admin, segment);
  if (mode === "preview") return NextResponse.json({ count: audience.length, capped: audience.length >= MAX_AUDIENCE });

  if (parsed.data.confirmCount !== audience.length) return NextResponse.json({ error: "Alıcı sayısı değişti. Önizlemeyi yenileyip tekrar onayla." }, { status: 409 });
  if (!audience.length) return NextResponse.json({ error: "Bu segmentte alıcı yok." }, { status: 409 });
  const { data: last } = await auth.admin.from("admin_audit_log").select("created_at").eq("action", "notify.sent").order("id", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS) return NextResponse.json({ error: "Art arda gönderim engellendi. Birkaç dakika sonra tekrar dene." }, { status: 429 });

  await auth.session.rpc("write_admin_audit", { event_action: "notify.sent", event_target_type: "notification", event_target_id: null, event_metadata: { segment, recipients: audience.length, title } });
  after(async () => {
    for (let index = 0; index < audience.length; index += 20) {
      await Promise.allSettled(audience.slice(index, index + 20).map((id) => sendPushToProfile(auth.admin, id, payload)));
    }
  });
  return NextResponse.json({ ok: true, message: `${audience.length} kişiye gönderim başlatıldı. Sessiz saatlerdeki üyelere sabah iletilir.` }, { status: 202 });
}
