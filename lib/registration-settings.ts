import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function readOpenRegistration(admin: SupabaseClient) {
  const { data, error } = await admin.from("admin_audit_log")
    .select("metadata")
    .eq("action", "platform.registration_mode.updated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const metadata = data?.metadata as { enabled?: unknown } | null;
  return { enabled: metadata?.enabled === true, error };
}

export async function loadOpenRegistration() {
  const admin = createAdminClient();
  if (!admin) return false;
  const result = await readOpenRegistration(admin);
  return result.error ? false : result.enabled;
}
