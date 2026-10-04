import { createHash } from "node:crypto";

type NotificationInput = {
  title: string;
  fields?: Record<string, string | number | null | undefined>;
  dedupeKey?: string;
};

const recent = new Map<string, number>();

export async function notifyHermes({ title, fields, dedupeKey }: NotificationInput) {
  const secret = process.env.HERMES_NOTIFIER_SECRET;
  if (!secret) return;
  if (dedupeKey) {
    const now = Date.now();
    for (const [key, sentAt] of recent) if (now - sentAt >= 10 * 60_000) recent.delete(key);
    const last = recent.get(dedupeKey) ?? 0;
    if (now - last < 10 * 60_000) return;
  }
  try {
    const response = await fetch(process.env.HERMES_NOTIFIER_URL ?? "http://127.0.0.1:3010/notify", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ project: "lovask", title, fields, occurredAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) console.error("Hermes notification failed", { status: response.status, title });
    else if (dedupeKey) recent.set(dedupeKey, Date.now());
  } catch (error) {
    console.error("Hermes notification failed", { name: error instanceof Error ? error.name : "unknown", title });
  }
}

export function hermesCooldownKey(event: string, identifier: string) {
  return `${event}:${createHash("sha256").update(identifier.toLowerCase()).digest("hex")}`;
}
