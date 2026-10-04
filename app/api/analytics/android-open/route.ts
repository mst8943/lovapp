import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const parsed = z.object({ installationId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz kurulum kimliği." }, { status: 400 });
  const limit = await consumeRateLimit(request, { scope: "android.open", limit: 30, windowSeconds: 3600 });
  if (!limit) return NextResponse.json({ error: "Sayaç kullanılamıyor." }, { status: 503 });
  const limited = rateLimitResponse(limit);
  if (limited) return limited;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sayaç kullanılamıyor." }, { status: 503 });
  const { error } = await admin.from("android_install_opens").upsert({ installation_id: parsed.data.installationId }, { onConflict: "installation_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "İlk açılış kaydedilemedi." }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
