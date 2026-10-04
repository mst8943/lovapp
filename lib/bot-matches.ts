import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleProactiveBotJob } from "@/lib/ai/automation";
import { sendPushToProfile } from "@/lib/push";

type CompletedBotMatch = {
  decision_id: string;
  match_id: string;
  member_profile_id: string;
  bot_profile_id: string;
};

export async function processDueBotMatches(admin: SupabaseClient, options: { memberProfileId?: string; limit?: number } = {}) {
  const { data, error } = await admin.rpc("process_due_bot_matches_service", {
    batch_limit: Math.max(1, Math.min(options.limit ?? 20, 100)),
    only_member: options.memberProfileId ?? null,
  });
  if (error) {
    if (error.message.includes("process_due_bot_matches_service")) return [];
    throw error;
  }
  const completed = (data ?? []) as CompletedBotMatch[];
  await Promise.allSettled(completed.map(async (item) => {
    await Promise.allSettled([
      scheduleProactiveBotJob({
        admin,
        matchId: item.match_id,
        botProfileId: item.bot_profile_id,
        memberProfileId: item.member_profile_id,
        jobType: "first_message",
      }),
      sendPushToProfile(admin, item.member_profile_id, {
        title: "Yeni bir eşleşmen var",
        body: "Birbirinizi beğendiniz",
        url: `/?open=match&match=${item.match_id}`,
        tag: `match-${item.match_id}`,
        matchId: item.match_id,
      }),
    ]);
  }));
  return completed;
}
