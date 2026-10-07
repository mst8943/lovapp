export type DailyQuestion = { key: string; text: string; options: string[] };

const BANK: DailyQuestion[] = [
  { key: "bill", text: "İlk buluşmada hesap nasıl ödenmeli?", options: ["Ben öderim", "Yarı yarıya", "Davet eden öder", "O gün karar veririz"] },
  { key: "weekend", text: "İdeal hafta sonu nasıl geçer?", options: ["Doğa ve yürüyüş", "Evde film ve yemek", "Arkadaşlarla dışarıda", "Şehir dışına kaçamak"] },
  { key: "morning", text: "Sabah mı gece mi?", options: ["Sabah insanıyım", "Gece kuşuyum"] },
  { key: "first-date", text: "İdeal ilk buluşma?", options: ["Kahve ve sohbet", "Akşam yemeği", "Aktivite (yürüyüş, sergi)", "Bir konser veya etkinlik"] },
  { key: "texting", text: "Mesajlaşma tarzın?", options: ["Hemen yanıtlarım", "Müsait olunca", "Aramayı tercih ederim", "Sesli mesaj severim"] },
  { key: "travel", text: "Tatilde ilk tercihin?", options: ["Deniz", "Tarihi şehirler", "Doğa kampı", "Hiçbir şey yapmadan dinlenmek"] },
  { key: "pets", text: "Evcil hayvan konusunda ne düşünüyorsun?", options: ["Kedi", "Köpek", "İkisi de", "Pek değil"] },
  { key: "cooking", text: "Mutfakta kimsin?", options: ["Şefim", "Yardımcı aşçıyım", "Sipariş uzmanıyım", "Birlikte pişiririz"] },
  { key: "music", text: "Yol arkadaşın hangisi?", options: ["Pop", "Rock", "Türkçe sözlü hafif", "Rap veya caz"] },
  { key: "plan", text: "Plan mı spontane mi?", options: ["Her şey planlı", "Spontane giderim", "Yarı yarıya"] },
  { key: "love-lang", text: "Sevgiyi nasıl gösterirsin?", options: ["Sözle", "Zaman ayırarak", "Küçük sürprizlerle", "Yardım ederek"] },
  { key: "coffee", text: "Kahve tercihin?", options: ["Türk kahvesi", "Filtre kahve", "Latte/cappuccino", "Kahve içmem"] },
  { key: "movie", text: "Film gecesi için?", options: ["Komedi", "Romantik", "Gerilim", "Belgesel"] },
  { key: "fitness", text: "Spor hayatında nerede?", options: ["Düzenli yaparım", "Ara sıra", "Başlamak istiyorum", "Spor bana göre değil"] },
  { key: "family", text: "Aile ile ilişkin?", options: ["Çok yakınız", "Dengeli", "Mesafeliyiz"] },
  { key: "humor", text: "Mizah anlayışın?", options: ["Kara mizah", "Absürt", "Gündelik espri", "Pek gülmem"] },
  { key: "city", text: "Yaşamak için tercihin?", options: ["Büyükşehir", "Sahil kasabası", "Doğayla iç içe"] },
  { key: "dinner", text: "Akşam yemeği nerede?", options: ["Evde yaparız", "Sokak lezzetleri", "Şık restoran", "Meyhane"] },
  { key: "gift", text: "Hediye alırken?", options: ["Düşünceli küçük şeyler", "Deneyim (bilet, gezi)", "Çiçek", "Hediye mi, gerek yok"] },
  { key: "book", text: "Kitap mı dizi mi?", options: ["Kitap", "Dizi", "Podcast", "İkisi de"] },
  { key: "social", text: "Sosyal enerjin?", options: ["Kalabalıkta şarj olurum", "Birkaç yakın dost yeter", "Çoğunlukla evcilim"] },
  { key: "ex", text: "Eski sevgililerle ilişki?", options: ["Arkadaş kalabilirim", "Kapıyı kapatırım", "Duruma göre"] },
  { key: "serious", text: "Şu an ne arıyorsun?", options: ["Ciddi ilişki", "Önce tanışmak", "Eğlenceli sohbet", "Henüz emin değilim"] },
  { key: "dance", text: "Dans pistinde?", options: ["Ortadayım", "Kenarda izlerim", "Sadece slow", "Pistten uzak dururum"] },
  { key: "late", text: "Geç kalmak?", options: ["Hep erkenci", "Zamanında", "Biraz geç kalırım"] },
  { key: "surprise", text: "Sürprizlere bakışın?", options: ["Bayılırım", "Planlı olsun", "Pek sevmem"] },
  { key: "snack", text: "Atıştırmalık seçimin?", options: ["Tatlı", "Tuzlu", "Meyve", "Sağlıklı atıştırmalık"] },
  { key: "season", text: "Favori mevsim?", options: ["İlkbahar", "Yaz", "Sonbahar", "Kış"] },
  { key: "apology", text: "Kavgadan sonra?", options: ["İlk adımı ben atarım", "Biraz zaman isterim", "Hemen konuşup çözeriz"] },
  { key: "future", text: "5 yıl sonra kendini nerede görüyorsun?", options: ["Kariyer zirvesinde", "Kendi evimde, huzurlu", "Dünyayı geziyorum", "Aile kurmuş"] },
];

export const QUESTION_COUNT = BANK.length;

export function istanbulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function questionForDate(date: string): DailyQuestion {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return BANK[((days % BANK.length) + BANK.length) % BANK.length];
}
