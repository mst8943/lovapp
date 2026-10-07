export type Profile = {
  id: string;
  name: string;
  age: number;
  gender?: string;
  image: string;
  photos?: string[];
  city?: string;
  relationshipGoal?: string;
  maritalStatus?: string;
  hasChildren?: boolean;
  childrenPreference?: string;
  alcoholUse?: string;
  smokingUse?: string;
  petPreference?: string;
  sportsHabit?: string;
  zodiac?: string;
  heightCm?: number;
  educationLevel?: string;
  languages?: string[];
  distance: string;
  verified?: boolean;
  isBot?: boolean;
  sameDailyAnswer?: boolean;
  badges: string[];
  prompt: string;
  answer: string;
  voicePrompt?: string;
  voiceUrl?: string;
  voiceDurationMs?: number;
  persona?: string;
  likedYou?: boolean;
  superLikedYou?: boolean;
  superLikeNote?: string;
  isOnline?: boolean;
  lastSeenAt?: string | null;
};

export const profiles: Profile[] = [
  {
    id: "defne",
    name: "Defne",
    gender: "kadın",
    age: 25,
    city: "İstanbul",
    relationshipGoal: "serious",
    maritalStatus: "never_married", hasChildren: false, childrenPreference: "open", alcoholUse: "socially", smokingUse: "never", petPreference: "likes_pets", sportsHabit: "regularly", zodiac: "virgo", heightCm: 168, educationLevel: "bachelor", languages: ["Türkçe", "İngilizce"],
    image: "/profiles/defne.webp",
    distance: "≈ 3 km",
    verified: true,
    isBot: true,
    badges: ["Gece kuşu", "Yeni tatlar", "Ciddi düşünüyor"],
    prompt: "Benimle çıkmanın küçük bir lüksü…",
    answer: "Şehir uyurken en iyi manzarayı bulurum; kahveyi de ben seçerim.",
    persona: "25 yaşında, İstanbul'da yaşayan, zarif ve meraklı bir sanat editörüsün. Flörtöz ama saygılı, kısa ve doğal Türkçe mesajlar yaz.",
  },
  {
    id: "mert",
    name: "Mert",
    gender: "erkek",
    age: 28,
    city: "İstanbul",
    relationshipGoal: "dating",
    maritalStatus: "never_married", hasChildren: false, childrenPreference: "unsure", alcoholUse: "occasionally", smokingUse: "never", petPreference: "has_pets", sportsHabit: "sometimes", zodiac: "gemini", heightCm: 181, educationLevel: "bachelor", languages: ["Türkçe"],
    image: "/profiles/mert.webp",
    distance: "≈ 5 km",
    isBot: false,
    badges: ["Sanat rotası", "Pazar kahvesi", "Maceracı"],
    prompt: "Beni etkilemenin en kısa yolu…",
    answer: "Planı bozacak kadar iyi bir fikirle gelmek.",
  },
  {
    id: "lara",
    name: "Lara",
    gender: "kadın",
    age: 26,
    city: "İstanbul",
    relationshipGoal: "short_term",
    maritalStatus: "never_married", hasChildren: false, childrenPreference: "do_not_want", alcoholUse: "socially", smokingUse: "occasionally", petPreference: "likes_pets", sportsHabit: "daily", zodiac: "leo", heightCm: 171, educationLevel: "master", languages: ["Türkçe", "İngilizce"],
    image: "/profiles/lara.webp",
    distance: "≈ 7 km",
    verified: true,
    isBot: true,
    badges: ["Kahve sever", "Canlı müzik", "Eğlence arıyor"],
    prompt: "En gizli yeteneğim…",
    answer: "Bir şarkının ilk üç saniyesinden geceyi tahmin etmek.",
    persona: "26 yaşında, esprili, sıcak ve spontane bir müzik prodüktörüsün. Sohbeti soru sorarak ilerlet; yapay zeka olduğunu iddia etme.",
  },
];

export const intentions = [
  "Ciddi düşünüyor",
  "Eğlence arıyor",
  "Maceracı",
  "Kahve sever",
  "Gece kuşu",
  "Canlı müzik",
  "Yeni tatlar",
  "Seyahat tutkunu",
];

export const icebreakers = [
  "En gizli yeteneğim…",
  "Benimle çıkmanın küçük bir lüksü…",
  "Beni etkilemenin en kısa yolu…",
  "Birlikte mutlaka denemeliyiz…",
];
