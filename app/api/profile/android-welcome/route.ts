import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ deviceId: z.string().regex(/^[0-9a-f]{16}$/i) });

export async function POST(request: Request) {
  const client = await createClient();
  const { data: { user } } = client ? await client.auth.getUser() : { data: { user: null } };
  if (!client || !user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cihaz kimliği geçersiz." }, { status: 400 });
  const admin = createAdminClient();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !secret) return NextResponse.json({ error: "Hediye şu anda tanımlanamadı." }, { status: 503 });
  // ponytail: Secret rotation changes device hashes; keep this key stable or migrate stored hashes first.
  const deviceHash = createHmac("sha256", secret).update(parsed.data.deviceId.toLowerCase()).digest("hex");
  const { data, error } = await admin.rpc("claim_android_welcome_noir_for_device", {
    claim_user_id: user.id,
    claim_device_hash: deviceHash,
  });
  if (error) return NextResponse.json({ error: "Hediye şu anda tanımlanamadı." }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
