import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { readOpenRegistration } from "@/lib/registration-settings";

const schema = z.object({ enabled: z.boolean() });

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const setting = await readOpenRegistration(auth.admin);
  if (setting.error) return NextResponse.json({ error: "Kayıt modu okunamadı." }, { status: 503 });
  return NextResponse.json({ enabled: setting.enabled }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Kayıt modu geçersiz." }, { status: 400 });

  const { error } = await auth.session.rpc("write_admin_audit", {
    event_action: "platform.registration_mode.updated",
    event_target_type: "platform_settings",
    event_target_id: "global",
    event_metadata: { enabled: parsed.data.enabled },
  });
  if (error) return NextResponse.json({ error: "Kayıt modu kaydedilemedi." }, { status: 500 });
  return NextResponse.json({ enabled: parsed.data.enabled });
}
