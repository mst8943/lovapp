import "server-only";

type HistoryMessage = { role: "user" | "assistant"; content: string };
type ToneTag = "greeting" | "empathy" | "surprise" | "advice" | "anger" | "affection" | "humor" | "gratitude" | "food" | "celebration" | "farewell" | "neutral";

const examples: Record<ToneTag, readonly string[]> = {
  greeting: ["Hoş geldin, günün nasıl geçti bakalım?", "Selam, ne var ne yok? Bugün nasıl gidiyor?"],
  empathy: ["Hadi ya… Üzüldüm gerçekten. İnsan böyle zamanlarda ne yapacağını şaşırıyor.", "Canını sıkmış belli… İstersen anlat, ben buradayım."],
  surprise: ["Yok artık, ciddi misin? Bunu hiç beklemiyordum.", "Hadi ya! Şaka yapıyorsun sandım bir an."],
  advice: ["Bak şimdi, uzaktan kolay görünüyor ama acele karar verme bence.", "Ben olsam biraz düşünüp güvendiğim birine de danışırdım."],
  anger: ["Çok ayıp etmiş gerçekten. Ama sinirle hareket edip kendini üzme.", "Haklı olarak kızmışsın; yine de sakin kafayla cevap vermen daha iyi olur."],
  affection: ["Öyle düşünme, sen kıymetlisin. Seninle konuşmak bana iyi geliyor.", "İçini böyle açman hoşuma gidiyor, bunu bil istedim."],
  humor: ["Bak sen, laf atmayı da biliyormuşsun 😄", "Hah, buna güldüm işte… Az değilsin sen."],
  gratitude: ["Estağfurullah, lafı mı olur? Bir işe yaradıysam ne mutlu bana.", "Ne demek, asıl sen sağ ol."],
  food: ["Bir şeyler yedin mi bari? Aç aç dolaşma sonra.", "Şimdi olsa güzel bir sofraya oturulur aslında."],
  celebration: ["Aaa gerçekten mi? Çok sevindim, bunu kutlamak lazım!", "Hadi be, harika haber! Senin adına çok sevindim."],
  farewell: ["Tamam, sen kendine iyi bak. Müsait olunca yine yazarsın.", "Hadi görüşürüz, güzel dinlen. Sonra yine konuşuruz."],
  neutral: ["Hımm, anladım… Devamını merak ettim doğrusu.", "Bak bu ilginçmiş, hiç o taraftan düşünmemiştim."],
};

const matchers: Array<[ToneTag, RegExp]> = [
  ["farewell", /\b(görüşürüz|hoşça kal|bay bay|iyi geceler|kaçtım|çıkıyorum)\b/i],
  ["celebration", /\b(kazandım|başardım|kabul edildim|terfi|mezun|nişan|evlen|doğum gün|harika haber)\b/i],
  ["empathy", /\b(üzgün|moralim bozuk|ağladım|yalnızım|ayrıldık|kaybettim|öldü|vefat|kötüyüm|canım sıkkın)\b/i],
  ["anger", /\b(sinir|kızdım|haksızlık|saygısız|nefret|kavga|aldattı|yalan söyledi)\b/i],
  ["advice", /\b(ne yapayım|sence|kararsızım|tavsiye|fikrin ne|ne dersin)\b/i],
  ["gratitude", /\b(teşekkür|sağ ol|eyvallah|çok yardımcı)\b/i],
  ["food", /\b(yemek|kahvaltı|akşam yemeği|acıktım|kahve|tatlı|pişir)\b/i],
  ["greeting", /^(selam|merhaba|günaydın|iyi akşamlar|naber|nasılsın)\b/i],
  ["affection", /\b(seviyorum|özledim|aşkım|canım|güzelsin|yakışıklı|hoşlanıyorum)\b/i],
  ["surprise", /\b(inanamıyorum|şok oldum|tahmin et|beklemiyordum|inanır mısın)\b/i],
  ["humor", /(?:😂|🤣|😄|\b(şaka|komik|güldüm|dalga)\b)/i],
];

export const toneGuideInfo = {
  enabled: true,
  source: "raq.md",
  mode: "duyguya göre seçilen kısa örnekler",
  categoryCount: Object.keys(examples).length,
};

export function buildAdaptiveToneGuide(persona: string, history: HistoryMessage[]) {
  const latestUser = [...history].reverse().find((item) => item.role === "user")?.content.trim() ?? "";
  const tag = matchers.find(([, pattern]) => pattern.test(latestUser))?.[0] ?? "neutral";
  const choices = examples[tag];
  const selected = choices[stableIndex(latestUser, choices.length)];
  const recentAssistant = history.filter((item) => item.role === "assistant").slice(-3).map((item) => item.content.trim()).filter(Boolean);
  const region = inferRegion(persona);
  const repetition = recentAssistant.length
    ? `\nTEKRAR ETME: Son cevaplarda geçen şu cümleleri veya belirgin kalıpları yeniden kullanma: ${recentAssistant.map((item) => `“${item.slice(0, 100)}”`).join(" | ")}`
    : "";

  return `DİNAMİK KONUŞMA TONU (${tag}): Aşağıdaki cümleyi kopyalama; yalnızca ritmini, sıcaklığını ve doğallığını örnek al: “${selected}”\nBÖLGESEL AYAR: ${region}\nSamimi ol ama her mesajda yöresel hitap, ünlem veya deyim kullanma. “Valla”, “yavrum”, “gardaş”, “yahu” gibi kalıpları seyrek ve yalnızca personaya uygunsa kullan. Kullanıcının duygusunu otomatik olarak haklı ilan etme; ağır kayıp ve tehlike konularında şaka yapma.${repetition}`;
}

function inferRegion(persona: string) {
  if (/İzmir|Aydın|Muğla|Manisa|Denizli/i.test(persona)) return "Rahat ve hafif muzip Ege konuşması; belirgin şive taklidi yapma.";
  if (/Ankara|Konya|Kayseri|Eskişehir|Sivas|Nevşehir/i.test(persona)) return "Ölçülü, sakin ve yer yer kuru mizahlı İç Anadolu tonu; ağır ağız kullanma.";
  if (/Antalya|Mersin|Adana|Hatay/i.test(persona)) return "Sıcak, canlı ve rahat Akdeniz tonu; klişe yerel sözleri abartma.";
  if (/Trabzon|Rize|Ordu|Giresun|Samsun/i.test(persona)) return "Hızlı ve şakacı Karadeniz sıcaklığı; yazılı şive taklidi yapma.";
  if (/Diyarbakır|Gaziantep|Şanlıurfa|Mardin|Van|Erzurum/i.test(persona)) return "Misafirperver ve içten bir ton; yoğun duygusal hitapları seyrek kullan.";
  if (/Bursa|İstanbul|Kocaeli|Tekirdağ|Edirne/i.test(persona)) return "Doğal şehir Türkçesi; sıcak ama nötr, yapay yöresel ağız kullanma.";
  return "Doğal ve nötr günlük Türkçe; personada belirtilmeyen bir şiveyi taklit etme.";
}

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash) % length;
}
