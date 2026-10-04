import { NextResponse } from "next/server";
import { processDueBotJobs } from "@/lib/ai/automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDeferredPushes } from "@/lib/push";
import { processDueBotMatches } from "@/lib/bot-matches";
import { processDueAccountDeletions } from "@/lib/account-deletion";

export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu bağlantısı yapılandırılmamış." }, { status: 503 });
  const botMatches = await processDueBotMatches(admin, { limit: 20 });
  const [results, deferredPushes, accountDeletions] = await Promise.all([
    processDueBotJobs(admin, { limit: 3 }),
    processDeferredPushes(admin),
    processDueAccountDeletions(admin, 3),
  ]);
  const { data: expiredStories } = await admin.from("profile_stories")
    .select("id,storage_path").lte("expires_at", new Date().toISOString()).limit(100);
  if (expiredStories?.length) {
    const { error } = await admin.storage.from("profiles").remove(expiredStories.map((story) => story.storage_path));
    if (!error) await admin.from("profile_stories").delete().in("id", expiredStories.map((story) => story.id));
  }
  return NextResponse.json({ processed: results.length, matched: botMatches.length, deferredPushes, accountDeletions, results }, { headers: { "Cache-Control": "no-store" } });
}
