export type UserPresence = {
  isOnline: boolean;
  text: string;
};

export function resolvePresence(params: {
  id?: string | null;
  isOnline?: boolean | null;
  lastSeenAt?: string | null;
}): UserPresence {
  if (params.isOnline) {
    return { isOnline: true, text: "Çevrimiçi" };
  }

  if (params.lastSeenAt) {
    const date = new Date(params.lastSeenAt);
    if (!isNaN(date.getTime())) {
      const now = Date.now();
      const diffMs = now - date.getTime();
      const minutes = Math.max(0, Math.floor(diffMs / 60000));
      if (minutes < 5) return { isOnline: true, text: "Çevrimiçi" };
      if (minutes < 15) return { isOnline: false, text: "Az önce aktifti" };
      if (minutes < 60) return { isOnline: false, text: `${minutes} dk önce aktifti` };
      const nowDate = new Date(now);
      if (date.toDateString() === nowDate.toDateString()) {
        const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(date);
        return { isOnline: false, text: `Bugün ${time}` };
      }
      if (diffMs < 48 * 3600 * 1000) {
        return { isOnline: false, text: "Dün" };
      }
      return { isOnline: false, text: new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(date) };
    }
  }

  return { isOnline: false, text: params.isOnline === false ? "Çevrimdışı" : "Aktiflik bilgisi yok" };
}
