export const ENDORSEMENT_BADGES = [
  { key: "kind", label: "Çok kibar" },
  { key: "looks_like_photos", label: "Fotoğraflarıyla birebir aynı" },
  { key: "great_listener", label: "Harika bir dinleyici" },
  { key: "funny", label: "Eğlenceli" },
  { key: "respectful", label: "Saygılı" },
  { key: "on_time", label: "Dakik" },
] as const;

export type EndorsementBadgeKey = (typeof ENDORSEMENT_BADGES)[number]["key"];
export const ENDORSEMENT_KEYS = ENDORSEMENT_BADGES.map((badge) => badge.key) as [EndorsementBadgeKey, ...EndorsementBadgeKey[]];
export const MIN_ENDORSEMENTS_TO_SHOW = 2;
