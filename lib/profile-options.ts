export const intentionOptions = [
  { slug: "serious", label: "Ciddi düşünüyor" },
  { slug: "fun", label: "Eğlence arıyor" },
  { slug: "adventure", label: "Maceracı" },
  { slug: "coffee", label: "Kahve sever" },
  { slug: "night-owl", label: "Gece kuşu" },
  { slug: "live-music", label: "Canlı müzik" },
  { slug: "foodie", label: "Yeni tatlar" },
  { slug: "travel", label: "Seyahat tutkunu" },
] as const;

export const icebreakerOptions = [
  "En gizli yeteneğim…",
  "Benimle çıkmanın küçük bir lüksü…",
  "Beni etkilemenin en kısa yolu…",
  "Birlikte mutlaka denemeliyiz…",
] as const;

export const lifestyleOptions = {
  alcohol: [["never", "Kullanmıyorum"], ["occasionally", "Nadiren"], ["socially", "Sosyal ortamlarda"], ["regularly", "Düzenli"]],
  smoking: [["never", "Kullanmıyorum"], ["occasionally", "Nadiren"], ["regularly", "Düzenli"], ["quitting", "Bırakıyorum"]],
  pets: [["has_pets", "Evcil hayvanım var"], ["likes_pets", "Severim"], ["no_pets", "Tercih etmiyorum"], ["allergic", "Alerjim var"]],
  sports: [["never", "Yapmıyorum"], ["sometimes", "Ara sıra"], ["regularly", "Düzenli"], ["daily", "Her gün"]],
  education: [["high_school", "Lise"], ["associate", "Ön lisans"], ["bachelor", "Lisans"], ["master", "Yüksek lisans"], ["doctorate", "Doktora"], ["other", "Diğer"]],
} as const;

export const zodiacOptions = [["aries", "Koç"], ["taurus", "Boğa"], ["gemini", "İkizler"], ["cancer", "Yengeç"], ["leo", "Aslan"], ["virgo", "Başak"], ["libra", "Terazi"], ["scorpio", "Akrep"], ["sagittarius", "Yay"], ["capricorn", "Oğlak"], ["aquarius", "Kova"], ["pisces", "Balık"]] as const;

export type OnboardingPayload = {
  name: string;
  birthDate: string;
  gender: string;
  city: string;
  phone: string;
  badgeSlugs: string[];
  prompt: string;
  answer: string;
  minAge: number;
  maxAge: number;
  interestedGenders: Array<"kadın" | "erkek" | "nonbinary" | "other">;
  sameCityOnly: boolean;
  relationshipGoal: "" | "marriage" | "serious" | "dating" | "short_term" | "friendship" | "unsure";
  maritalStatus: "" | "never_married" | "divorced" | "widowed" | "separated" | "married";
  hasChildren: boolean | null;
  childrenPreference: "" | "want" | "do_not_want" | "open" | "unsure";
  district: string;
  alcoholUse: "" | "never" | "occasionally" | "socially" | "regularly";
  smokingUse: "" | "never" | "occasionally" | "regularly" | "quitting";
  petPreference: "" | "has_pets" | "likes_pets" | "no_pets" | "allergic";
  sportsHabit: "" | "never" | "sometimes" | "regularly" | "daily";
  heightCm: number | null;
  educationLevel: "" | "high_school" | "associate" | "bachelor" | "master" | "doctorate" | "other";
  languages: string[];
};
