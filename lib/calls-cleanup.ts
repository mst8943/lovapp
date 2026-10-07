import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanupCalls as run } from "@/lib/calls-cleanup-core";
import { sendPushToProfile } from "@/lib/push";

export function cleanupCalls(admin: SupabaseClient) {
  return run(admin, { sendPush: (profileId, payload) => sendPushToProfile(admin, profileId, payload, { bypassQuietHours: true }) });
}
