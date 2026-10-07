import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const ROLES = ["owner", "moderator", "bot_editor", "support"] as const;
const addSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), role: z.enum(ROLES) });
const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(ROLES) });

type Auth = Exclude<Awaited<ReturnType<typeof requireAdmin>>, NextResponse>;

async function ownerCount(auth: Auth) {
  const { count } = await auth.admin.from("admin_users").select("user_id", { count: "exact", head: true }).eq("role", "owner");
  return count ?? 0;
}

async function findUserByEmail(auth: Auth, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data } = await auth.admin.auth.admin.listUsers({ page, perPage: 1000 });
    const found = data?.users.find((item) => item.email?.toLowerCase() === email);
    if (found) return found;
    if ((data?.users.length ?? 0) < 1000) break;
  }
  return null;
}

const audit = (auth: Auth, action: string, targetId: string, metadata: Record<string, unknown>) =>
  auth.session.rpc("write_admin_audit", { event_action: action, event_target_type: "admin_user", event_target_id: targetId, event_metadata: metadata });

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("admin_users").select("user_id,role,created_at").order("created_at");
  if (error) return NextResponse.json({ error: "Ekip listesi yüklenemedi." }, { status: 500 });
  const members = await Promise.all((data ?? []).map(async (row) => {
    const { data: found } = await auth.admin.auth.admin.getUserById(row.user_id);
    return { userId: row.user_id, role: row.role, createdAt: row.created_at, email: found.user?.email ?? null, lastSignInAt: found.user?.last_sign_in_at ?? null, isSelf: row.user_id === auth.user.id };
  }));
  return NextResponse.json({ members }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçerli bir e-posta ve rol seç." }, { status: 400 });
  const user = await findUserByEmail(auth, parsed.data.email);
  if (!user) return NextResponse.json({ error: "Bu e-postayla kayıtlı üye bulunamadı. Kişi önce siteye kayıt olmalı." }, { status: 404 });
  const { error } = await auth.admin.from("admin_users").upsert({ user_id: user.id, role: parsed.data.role }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Yönetici eklenemedi." }, { status: 500 });
  await audit(auth, "team.member_set", user.id, { email: parsed.data.email, role: parsed.data.role });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  const { data: current } = await auth.admin.from("admin_users").select("role").eq("user_id", parsed.data.userId).maybeSingle();
  if (!current) return NextResponse.json({ error: "Yönetici bulunamadı." }, { status: 404 });
  if (current.role === "owner" && parsed.data.role !== "owner" && await ownerCount(auth) <= 1) return NextResponse.json({ error: "Son sahibin rolü düşürülemez. Önce başka bir sahip ekle." }, { status: 409 });
  const { error } = await auth.admin.from("admin_users").update({ role: parsed.data.role }).eq("user_id", parsed.data.userId);
  if (error) return NextResponse.json({ error: "Rol güncellenemedi." }, { status: 500 });
  await audit(auth, "team.role_changed", parsed.data.userId, { from: current.role, to: parsed.data.role });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const userId = new URL(request.url).searchParams.get("userId") ?? "";
  if (!z.string().uuid().safeParse(userId).success) return NextResponse.json({ error: "Geçersiz yönetici." }, { status: 400 });
  if (userId === auth.user.id) return NextResponse.json({ error: "Kendi yönetici yetkini kaldıramazsın." }, { status: 409 });
  const { data: current } = await auth.admin.from("admin_users").select("role").eq("user_id", userId).maybeSingle();
  if (!current) return NextResponse.json({ error: "Yönetici bulunamadı." }, { status: 404 });
  if (current.role === "owner" && await ownerCount(auth) <= 1) return NextResponse.json({ error: "Son sahip kaldırılamaz." }, { status: 409 });
  const { error } = await auth.admin.from("admin_users").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Bu yönetici geçmiş kayıtlarda yer aldığı için silinemedi. Rolünü Destek olarak düşürebilirsin." }, { status: 409 });
  await audit(auth, "team.member_removed", userId, { role: current.role });
  return NextResponse.json({ ok: true });
}
