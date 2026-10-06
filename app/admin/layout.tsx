import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AdminRoleProvider } from "@/components/admin-role-context";
import type { AdminRole } from "@/lib/admin-auth";
import "./lovask-control/admin-unified.css";
import "./lovask-control/admin-light.css";
import "./lovask-control/admin-polish.css";

export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) return children;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: admin } = await supabase.from("admin_users").select("user_id,role").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/");
  return <AdminRoleProvider role={admin.role as AdminRole}>{children}</AdminRoleProvider>;
}
