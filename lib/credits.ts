export const CREDIT_KINDS = [
  { key: "boost", label: "Boost", detail: "30 dakikalık profil öne çıkarma" },
  { key: "super_like", label: "Süper beğeni", detail: "Notlu süper beğeni hakkı" },
  { key: "profile_unlock", label: "Profil açma", detail: "Beğenenlerden bir profili açma" },
] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number]["key"];
export const CREDIT_KEYS = CREDIT_KINDS.map((kind) => kind.key) as [CreditKind, ...CreditKind[]];

export function sumBalances(rows: { kind: string; delta: number }[]) {
  const balances: Record<CreditKind, number> = { boost: 0, super_like: 0, profile_unlock: 0 };
  for (const row of rows) if (row.kind in balances) balances[row.kind as CreditKind] += row.delta;
  return balances;
}
