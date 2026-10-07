import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNetgsmSms } from "@/lib/application-notifications";
import { notifyHermes } from "@/lib/hermes-notifications";
import { sendPushToProfile } from "@/lib/push";
import { processSafetyCheckins as run } from "@/lib/safety-checkins-core";
import { readProviderConfig } from "@/lib/verification-providers";

export async function processSafetyCheckins(admin: SupabaseClient, now = new Date()) {
  let provider: Awaited<ReturnType<typeof readProviderConfig>> | undefined;
  return run(admin, {
    sendPush: (profileId, payload) => sendPushToProfile(admin, profileId, payload, { bypassQuietHours: true }),
    sendSms: async (phone, message) => {
      provider ??= await readProviderConfig(admin).catch(() => undefined);
      return sendNetgsmSms(phone, message, provider);
    },
    notifyOps: (title, fields, dedupeKey) => notifyHermes({ title, fields, dedupeKey }),
  }, now);
}
