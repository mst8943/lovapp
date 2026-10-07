import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export const SEGMENTS = {
  all: "Tüm üyeler",
  noir_active: "Aktif Noir üyeleri",
  noir_expiring: "Noir'u 7 gün içinde bitenler",
  inactive_7: "7 gündür girmeyenler",
  inactive_30: "30 gündür girmeyenler",
  new_7: "Son 7 günde katılanlar",
} as const;
export type Segment = keyof typeof SEGMENTS;

export const MAX_AUDIENCE = 5000;
const DAY = 86_400_000;

async function humanProfiles(admin: AdminClient, since?: string) {
  const rows: { id: string; created_at: string }[] = [];
  for (let from = 0; from < MAX_AUDIENCE * 4; from += 1000) {
    let query = admin.from("profiles").select("id,created_at").eq("kind", "human").eq("onboarding_completed", true).order("created_at", { ascending: false }).range(from, from + 999);
    if (since) query = query.gte("created_at", since);
    const { data } = await query;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

async function idsFrom(admin: AdminClient, table: "user_entitlements" | "profile_presence", column: string, filter: (query: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const ids = new Set<string>();
  for (let from = 0; from < MAX_AUDIENCE * 4; from += 1000) {
    const { data } = await filter(admin.from(table).select(`profile_id,${column}`)).range(from, from + 999);
    for (const row of data ?? []) ids.add(row.profile_id as string);
    if ((data?.length ?? 0) < 1000) break;
  }
  return ids;
}

export async function resolveAudience(admin: AdminClient, segment: Segment) {
  const now = Date.now();
  let ids: string[];
  if (segment === "new_7") {
    ids = (await humanProfiles(admin, new Date(now - 7 * DAY).toISOString())).map((row) => row.id);
  } else if (segment === "noir_active" || segment === "noir_expiring") {
    const upper = segment === "noir_expiring" ? new Date(now + 7 * DAY).toISOString() : null;
    const noir = await idsFrom(admin, "user_entitlements", "noir_until", (query) => {
      const base = query.gt("noir_until", new Date(now).toISOString());
      return upper ? base.lte("noir_until", upper) : base;
    });
    const humans = new Set((await humanProfiles(admin)).map((row) => row.id));
    ids = [...noir].filter((id) => humans.has(id));
  } else if (segment === "inactive_7" || segment === "inactive_30") {
    const cutoff = new Date(now - (segment === "inactive_7" ? 7 : 30) * DAY).toISOString();
    const recent = await idsFrom(admin, "profile_presence", "last_seen_at", (query) => query.gte("last_seen_at", cutoff));
    ids = (await humanProfiles(admin)).map((row) => row.id).filter((id) => !recent.has(id));
  } else {
    ids = (await humanProfiles(admin)).map((row) => row.id);
  }
  return ids.slice(0, MAX_AUDIENCE);
}
