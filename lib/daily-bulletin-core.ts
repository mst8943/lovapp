import type { SupabaseClient } from "@supabase/supabase-js";

const DAY = 86_400_000;
const PER_RUN = 100;

const istanbulDay = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export type BulletinDeps = { questionText: (date: string) => string; sendPush: (profileId: string, payload: { title: string; body: string; url?: string; tag?: string }) => Promise<unknown> };

export function istanbulHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", hour12: false }).format(now)) % 24;
}

// One push per member per day, sent during the configured Istanbul hour. The log row is claimed before sending,
// so two overlapping cron runs can never deliver the same bulletin twice.
export async function processDailyBulletin(admin: SupabaseClient, deps: BulletinDeps, options: { hour?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const hour = options.hour ?? 10;
  if (istanbulHour(now) !== hour) return { sent: 0 };
  const today = istanbulDay(now);

  const { data: subscribed } = await admin.from("push_subscriptions").select("profile_id").is("disabled_at", null).limit(1000);
  const ids = [...new Set((subscribed ?? []).map((row) => row.profile_id as string))];
  if (!ids.length) return { sent: 0 };

  const [{ data: already }, { data: optedOut }, { data: members }, { data: newcomers }] = await Promise.all([
    admin.from("daily_bulletin_log").select("profile_id").eq("sent_on", today).in("profile_id", ids),
    admin.from("notification_preferences").select("profile_id").eq("daily_bulletin", false).in("profile_id", ids),
    admin.from("profiles").select("id,city").eq("kind", "human").eq("onboarding_completed", true).eq("is_discoverable", true).is("deleted_at", null).in("id", ids),
    admin.from("profiles").select("city").eq("kind", "human").eq("onboarding_completed", true).eq("is_discoverable", true).is("deleted_at", null).gte("created_at", new Date(now.getTime() - DAY).toISOString()).limit(2000),
  ]);
  const skip = new Set([...(already ?? []), ...(optedOut ?? [])].map((row) => row.profile_id as string));
  const newByCity = new Map<string, number>();
  for (const row of newcomers ?? []) { const key = String(row.city ?? "").toLocaleLowerCase("tr-TR"); if (key) newByCity.set(key, (newByCity.get(key) ?? 0) + 1); }
  const question = deps.questionText(today);

  let sent = 0;
  for (const member of (members ?? []).filter((item) => !skip.has(item.id as string)).slice(0, PER_RUN)) {
    const { error } = await admin.from("daily_bulletin_log").insert({ profile_id: member.id, sent_on: today });
    if (error) continue;
    const city = String(member.city ?? "");
    const fresh = city ? newByCity.get(city.toLocaleLowerCase("tr-TR")) ?? 0 : 0;
    const line = fresh > 0 ? `${city}'da son 24 saatte ${fresh} yeni üye katıldı.` : "Keşfette seni bekleyen yeni profiller var.";
    await deps.sendPush(member.id as string, { title: "Günaydın! Astra'dan günün özeti", body: `${line} Günün sorusu: ${question}`.slice(0, 160), url: "/", tag: `bulletin-${today}` }).catch(() => undefined);
    sent += 1;
  }
  return { sent };
}
