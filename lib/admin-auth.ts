import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "owner" | "moderator" | "bot_editor" | "support";

export async function requireAdmin(allowed: AdminRole[]) {
  const [session, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  if (!session || !admin) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: membership } = await session.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!membership || !allowed.includes(membership.role as AdminRole)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }
  return { session, admin, user, role: membership.role as AdminRole };
}
