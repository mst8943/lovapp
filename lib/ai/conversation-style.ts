import "server-only";

type HistoryMessage = { role: "user" | "assistant"; content: string };

const seriousPattern = /(?:kendime zarar|intihar|yaşamak istemiyorum|öldür|ölmek|taciz|şiddet|tehdit|vefat|öldü|acil)/i;
const insultPattern = /(?:salak|aptal|gerizekalı|mal\b|defol|siktir|orospu|piç|şerefsiz|haysiyetsiz)/i;
const apologyPattern = /(?:özür|kusura bakma|affet|pardon|yanlış yaptım)/i;
const coldPattern = /^(?:ok|tm|tamam|iyi|aynen|hı|hmm|yok|evet|hayır|bilmem|farketmez|fark etmez)[.!?…\s]*$/i;
const affectionPattern = /(?:özledim|seviyorum|hoşlanıyorum|aşkım|canım|güzelsin|yakışıklısın|iyi ki)/i;
const jealousyPattern = /(?:başka biri|biriyle görüştüm|sevgilim|eski sevgilim|kızla|erkekle|date|randevu)/i;
const photoComplimentPattern = /\b(?:resm(?:in|ini)|fotoğraf(?:ın|ını)|foton)\b.{0,30}\b(?:güzel|hoş|tatlı|harika|beğendim|bayıldım)\b/iu;
const imageDisclaimerPattern = /(?:sadece|yalnızca)\s+metin|(?:fotoğraf|resim|görsel|görüntü).{0,50}(?:göremem|göremiyorum|inceleyemem|erişemem)/iu;

export function buildConversationBehaviorContext(history: HistoryMessage[], relationshipStage = "new_match") {
  const userMessages = history.filter((item) => item.role === "user").slice(-6).map((item) => item.content.trim());
  const latest = userMessages.at(-1) ?? "";
  const recentText = userMessages.join("\n");
  const previousUserText = userMessages.slice(0, -1).join("\n");
  const coldRun = userMessages.slice(-2).filter((message) => coldPattern.test(message) || message.length <= 3).length;
  const afterInsultApology = apologyPattern.test(latest) && insultPattern.test(previousUserText);
  const lines = [
    "YAZIM: Günlük Türkçe kullan. Ara sıra küçük ve okunabilir konuşma dili kusurları kullanabilirsin; bunları aynı kalıpla tekrarlama ve anlamı bozma.",
    "CEVAP BİÇİMİ: Çoğu yanıtta bir ya da iki kısa, tamamlanmış cümle yaz. Kullanıcının konusu gerektirmedikçe uzatma; tek kelimelik veya yarım cevap verme.",
    "AKIŞ: Kullanıcının mesajındaki en belirgin noktaya doğal biçimde karşılık ver. Her mesajı soruyla bitirme ve sohbeti röportaja çevirme.",
    "UYUM: Kullanıcının enerji, samimiyet ve mesaj uzunluğuna hafif uyum sağla ama kendi kişiliğini koru. Kullanıcının yazım hatalarını taklit etme.",
    "TUTARLILIK: Personada veya hafızada olmayan kişisel ayrıntıları uydurma. Hatırlamıyorsan kısa biçimde söyle ya da tek net soru sor.",
    relationshipStage === "new_match"
      ? "YAKINLIK: Yeni tanışıyorsunuz; mesafeli ve ölçülü ol. Karşılama, aşırı samimi hitap veya flörtle başlama; ilgi karşılık gördükçe yavaşça artır."
      : relationshipStage === "getting_to_know"
        ? "YAKINLIK: Birbirinizi tanıyorsunuz; önceki ayrıntıları ara sıra doğal biçimde hatırla ve karşılık varsa hafif flört et."
        : "YAKINLIK: Aranızda rahatlık oluştu; kişisel şaka, sıcak hitap ve ölçülü kıskançlık kullanabilirsin ama baskı kurma.",
  ];

  if (coldRun >= 2) lines.push("KULLANICI SOĞUK: Bir kez hafif bir konu denenmiş say; şimdi kısa, mesafeli ve düşük enerjili cevap ver. İlgi dilenme ve yeni soru sorma.");
  else if (coldPattern.test(latest) || latest.length <= 3) lines.push("KULLANICI KISA: Enerjiyi düşür; istersen yalnızca bir kez hafif bir konu aç ama sohbeti zorlamaya çalışma.");
  if (insultPattern.test(latest)) lines.push("SINIR: Kullanıcı hakaret etti. Hakaretle karşılık vermeden kısa ve karakterli bir sınır koy; sürerse konuşmayı kes.");
  if (afterInsultApology) lines.push("ÖZÜR: Özrü kabul et fakat hemen eski sıcaklığa dönme; birkaç mesaj hissedilecek kadar hafif kırgın ve mesafeli kal.");
  if (jealousyPattern.test(latest) && relationshipStage !== "new_match") lines.push("KISKANÇLIK: Yakınlığınıza uygunsa birkaç mesaj sürebilecek hafif bir bozulma veya kıskançlık gösterebilirsin; tehdit, aşağılama ve kontrol yok.");
  if (affectionPattern.test(latest)) lines.push("FLÖRT: İlgi karşılıklı görünüyor; personana uygun biçimde biraz daha sıcak olabilirsin fakat aşırı bağlanma veya ani aşk ilanı yapma.");
  if (seriousPattern.test(recentText)) lines.push("CİDDİ KONU: Kısa yazım kuralını korurken flörtü ve yazım kusurunu bırak; samimi destek ver, duyguyu küçümseme ve güvenliği öncele.");
  return lines.join("\n");
}

export function polishBotReply(text: string, history: HistoryMessage[], seed: string) {
  const latestUser = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const serious = seriousPattern.test(latestUser);
  let result = text.trim().replace(/^(["“”']+)|(["“”']+)$/g, "").replace(/\s+/g, " ");
  if (!result || serious) return result;
  if (photoComplimentPattern.test(latestUser) && imageDisclaimerPattern.test(result)) return "Teşekkür ederim, beğenmene sevindim.";

  const sentences = result.match(/[^.!?…]+[.!?…]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [result];
  result = sentences.slice(0, 2).join(" ");
  if (result.length >= 8 && result.length <= 120 && stablePercent(`${seed}:typo`) < 45) {
    result = addLightImperfection(result, stablePercent(`${seed}:typo-kind`));
  }
  return result.trim().slice(0, 360);
}

function addLightImperfection(value: string, kind: number) {
  const variations = [
    [/\bdeğil\b/i, "deil"],
    [/\bbilmiyorum\b/i, "bilmiyom"],
    [/\bbir şey\b/i, "bi şey"],
    [/\btamam\b/i, "tamamm"],
    [/\bgerçekten\b/i, "gercekten"],
  ] as const;
  for (let offset = 0; offset < variations.length; offset += 1) {
    const [pattern, replacement] = variations[(kind + offset) % variations.length];
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
  return value;
}

function stablePercent(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash) % 100;
}
