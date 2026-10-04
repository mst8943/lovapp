import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readVerificationSettings(admin: SupabaseClient) {
  const { data, error } = await admin.from("admin_audit_log").select("metadata")
    .eq("action", "platform.verification_settings.updated").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const flags = data?.metadata as { emailEnabled?: boolean; smsEnabled?: boolean } | null;
  return { emailEnabled: flags?.emailEnabled === true, smsEnabled: flags?.smsEnabled === true, error };
}
