import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const schema = z.object({ matchId: z.string().uuid(), adminUserId: z.string().uuid(), durationMinutes: z.number().int().min(15).max(1440), reason: z.string().trim().min(10).max(500) });

export async function GET(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!z.string().uuid().safeParse(matchId).success) return NextResponse.json({ error: "Geçersiz sohbet." }, { status: 400 });
  const [{ data: admins }, { data: grants }] = await Promise.all([
    auth.admin.from("admin_users").select("user_id,role").in("role", ["moderator","support"]),
    auth.admin.from("conversation_access_grants").select("id,admin_user_id,reason,expires_at,revoked_at").eq("match_id", matchId!).order("created_at", { ascending: false }),
  ]);
  const reviewers = await Promise.all((admins ?? []).map(async (admin) => ({ ...admin, email: (await auth.admin.auth.admin.getUserById(admin.user_id)).data.user?.email ?? admin.user_id })));
  return NextResponse.json({ reviewers, grants: grants ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vaka erişim bilgilerini kontrol et." }, { status: 400 });
  const { data: reviewer } = await auth.admin.from("admin_users").select("role").eq("user_id", parsed.data.adminUserId).in("role", ["moderator","support"]).maybeSingle();
  if (!reviewer) return NextResponse.json({ error: "Geçerli bir inceleyici seç." }, { status: 409 });
  const { data, error } = await auth.admin.from("conversation_access_grants").insert({ match_id: parsed.data.matchId, admin_user_id: parsed.data.adminUserId, reason: parsed.data.reason, granted_by: auth.user.id, expires_at: new Date(Date.now() + parsed.data.durationMinutes * 60_000).toISOString() }).select("id,expires_at").single();
  if (error) return NextResponse.json({ error: "Vaka erişimi verilemedi." }, { status: 503 });
  await auth.session.rpc("write_admin_audit", { event_action: "conversation.access.granted", event_target_type: "conversation", event_target_id: parsed.data.matchId, event_metadata: { grantId: data.id, reviewer: parsed.data.adminUserId, expiresAt: data.expires_at } });
  return NextResponse.json({ grant: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const grantId = new URL(request.url).searchParams.get("id");
  if (!z.string().uuid().safeParse(grantId).success) return NextResponse.json({ error: "Geçersiz erişim." }, { status: 400 });
  const { error } = await auth.admin.from("conversation_access_grants").update({ revoked_at: new Date().toISOString() }).eq("id", grantId!);
  if (error) return NextResponse.json({ error: "Erişim kaldırılamadı." }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
