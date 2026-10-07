export type WaitingBadge = { label: string; tone: "ok" | "warn" | "late" };

export function waitingBadge(since: string | null | undefined, now: number): WaitingBadge | null {
  if (!since) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  if (Number.isNaN(minutes)) return null;
  if (minutes < 60) return { label: minutes < 5 ? "Az önce geldi" : `${minutes} dakikadır bekliyor`, tone: "ok" };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `${hours} saattir bekliyor`, tone: hours >= 12 ? "warn" : "ok" };
  const days = Math.floor(hours / 24);
  return { label: `${days} gündür bekliyor`, tone: days >= 2 ? "late" : "warn" };
}
