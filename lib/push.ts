import "server-only";

import webpush from "web-push";
import { sendFcmToDevice } from "@/lib/fcm";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  matchId?: string;
};

export async function sendPushToProfile(admin: AdminClient, profileId: string, payload: PushPayload, options: { bypassQuietHours?: boolean } = {}) {
  if (payload.matchId && await isChatOpen(admin, profileId, payload.matchId)) return;

  if (!options.bypassQuietHours) {
    const deliverAt = await quietHoursEnd(admin, profileId);
    if (deliverAt) {
      await admin.from("deferred_push_notifications").insert({ profile_id: profileId, payload, deliver_at: deliverAt.toISOString() });
      return;
    }
  }

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("profile_id", profileId)
    .is("disabled_at", null)
    .limit(8);
  if (!subscriptions?.length) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@lovask.com.tr";
  let otherProfileId: string | null = null;
  if (payload.matchId && subscriptions.some((subscription) => subscription.endpoint.startsWith("fcm:"))) {
    const { data: match } = await admin.from("matches").select("user_a,user_b").eq("id", payload.matchId).maybeSingle();
    otherProfileId = match ? (match.user_a === profileId ? match.user_b : match.user_a) : null;
  }

  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  const outcomes = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      if (subscription.endpoint.startsWith("fcm:")) {
        const fcmToken = subscription.endpoint.slice(4);
        const result = await sendFcmToDevice(fcmToken, { title: payload.title, body: payload.body, data: {
          title: payload.title,
          body: payload.body,
          url: payload.url ?? "",
          tag: payload.tag ?? "",
          matchId: payload.matchId ?? "",
          payload: payload.matchId && otherProfileId ? `chat:${payload.matchId}:${otherProfileId}` : (payload.url ?? "matches"),
        } });
        if (result.ok) {
          await admin.from("push_subscriptions").update({ failure_count: 0, updated_at: new Date().toISOString() }).eq("id", subscription.id);
        } else if (result.code === "UNREGISTERED") {
          await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", subscription.id);
        } else {
          throw new Error(`FCM delivery failed: ${result.status} ${result.code ?? "unknown"}`);
        }
        return;
      }

      // Web Push
      if (!publicKey || !privateKey) return;
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({ title: payload.title, body: payload.body, url: payload.url, tag: payload.tag, icon: "/pwa/icon-192.png" }), { TTL: 60 * 60 });
      await admin.from("push_subscriptions").update({ failure_count: 0, updated_at: new Date().toISOString() }).eq("id", subscription.id);
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", subscription.id);
      } else {
        await admin.rpc("increment_push_failure", { subscription_uuid: subscription.id });
      }
      throw error;
    }
  }));
  if (outcomes.some((outcome) => outcome.status === "rejected")) throw new Error("Push delivery failed");
}

export async function processDeferredPushes(admin: AdminClient, limit = 20) {
  const { data: rows } = await admin.from("deferred_push_notifications").select("id,profile_id,payload").eq("status", "queued").lte("deliver_at", new Date().toISOString()).order("deliver_at").limit(limit);
  for (const row of rows ?? []) {
    try {
      await sendPushToProfile(admin, row.profile_id, row.payload as PushPayload, { bypassQuietHours: true });
      await admin.from("deferred_push_notifications").update({ status: "sent", completed_at: new Date().toISOString() }).eq("id", row.id).eq("status", "queued");
    } catch {
      await admin.from("deferred_push_notifications").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", row.id).eq("status", "queued");
    }
  }
  return rows?.length ?? 0;
}

async function isChatOpen(admin: AdminClient, profileId: string, matchId: string) {
  const activeSince = new Date(Date.now() - 75_000).toISOString();
  const { data } = await admin.from("active_chat_sessions").select("profile_id").eq("profile_id", profileId).eq("match_id", matchId).gte("last_heartbeat_at", activeSince).maybeSingle();
  return Boolean(data);
}

async function quietHoursEnd(admin: AdminClient, profileId: string) {
  const { data } = await admin.from("notification_preferences").select("quiet_hours_enabled,quiet_start,quiet_end,timezone").eq("profile_id", profileId).maybeSingle();
  if (!data?.quiet_hours_enabled) return null;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: "hour" | "minute") => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const minute = value("hour") * 60 + value("minute");
  const toMinute = (time: string) => { const [hour, mins] = time.split(":").map(Number); return hour * 60 + mins; };
  const start = toMinute(data.quiet_start);
  const end = toMinute(data.quiet_end);
  const quiet = start <= end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!quiet) return null;
  const minutesUntilEnd = minute < end ? end - minute : 1440 - minute + end;
  return new Date(now.getTime() + Math.max(1, minutesUntilEnd) * 60_000);
}
