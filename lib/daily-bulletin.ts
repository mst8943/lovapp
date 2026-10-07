import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { processDailyBulletin as run } from "@/lib/daily-bulletin-core";
import { questionForDate } from "@/lib/daily-question";
import { sendPushToProfile } from "@/lib/push";

export function processDailyBulletin(admin: SupabaseClient) {
  const hour = Number(process.env.DAILY_BULLETIN_HOUR ?? 10);
  return run(admin, { questionText: (date) => questionForDate(date).text, sendPush: (profileId, payload) => sendPushToProfile(admin, profileId, payload) }, { hour: Number.isFinite(hour) ? hour : 10 });
}
