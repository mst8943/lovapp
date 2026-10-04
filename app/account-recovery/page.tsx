import { redirect } from "next/navigation";
import { AccountRecovery } from "@/components/account-recovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountRecoveryPage() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) redirect("/login?next=/account-recovery");
  const admin = createAdminClient();
  if (!admin) redirect("/");
  const { data: request } = await admin.from("account_deletion_requests")
    .select("scheduled_for,cancelled_at,completed_at")
    .eq("user_id", user.id).maybeSingle();
  if (!request || request.cancelled_at || request.completed_at) redirect("/");
  return <AccountRecovery scheduledFor={request.scheduled_for} />;
}
