import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({ body: z.string().trim().min(3).max(240) });
const updateSchema = z.object({ id: z.string().uuid(), body: z.string().trim().min(3).max(240).optional(), isActive: z.boolean().optional() });

export async function GET() {
  const auth = await requireAdmin(["owner", "bot_editor", "support"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("bot_fallback_templates").select("id,body,is_active,created_at").is("profile_id", null).order("created_at");
  if (error) return NextResponse.json({ error: "Fallback metinleri yüklenemedi." }, { status: 503 });
  return NextResponse.json({ templates: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Metin 3–240 karakter olmalı." }, { status: 400 });
  const { data, error } = await auth.admin.from("bot_fallback_templates").insert({ body: parsed.data.body, created_by: auth.user.id }).select("id,body,is_active,created_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Bu fallback zaten kayıtlı." : "Fallback eklenemedi." }, { status: 409 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.fallback.created", event_target_type: "bot_automation", event_target_id: data.id, event_metadata: { body: data.body } });
  return NextResponse.json({ template: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Fallback ayarı geçersiz." }, { status: 400 });
  const payload = { ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}), ...(parsed.data.isActive !== undefined ? { is_active: parsed.data.isActive } : {}) };
  const { data, error } = await auth.admin.from("bot_fallback_templates").update(payload).eq("id", parsed.data.id).is("profile_id", null).select("id,body,is_active,created_at").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Fallback güncellenemedi." }, { status: 404 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.fallback.updated", event_target_type: "bot_automation", event_target_id: data.id, event_metadata: payload });
  return NextResponse.json({ template: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Geçersiz fallback." }, { status: 400 });
  const { error } = await auth.admin.from("bot_fallback_templates").delete().eq("id", id!).is("profile_id", null);
  if (error) return NextResponse.json({ error: "Fallback silinemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "bot.fallback.deleted", event_target_type: "bot_automation", event_target_id: id, event_metadata: {} });
  return new NextResponse(null, { status: 204 });
}
