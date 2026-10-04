const promptLeakPattern = /^(?:kullanıcı|asistan|sistem|system|assistant)\s*[:“"'(]|(?:acil ve gerçek bir tehdit|destek hatlarına yönlendir|ilk mesaj.*(?:doğal|birleşik)|genel davranış|cevap biçimi|paylaşılan bilgi tabanı|yalnızca doğal türkçe konuş|her mesajı soruyla bitirme|persona(?:n|ya)?\b|talimat(?:ı|ları)?\b)/iu;
const promptHeadingPattern = /\b(?:GENEL DAVRANIŞ|CEVAP BİÇİMİ|NOKTALAMA|DOĞALLIK|AKIŞ|TUTARLILIK|YAKINLIK)\s*:/u;
const promptInstructionPattern = /(?:açılış mesajına\s+yanıt vermek yerine|bu soruya\s+(?:karşılık|cevap)|kullanıcı(?:ya)?\s+.*(?:cevap|yanıt)\s+(?:yaz|ver)|acil\s+ve\s+gerçek\s+bir\s+tehdit|acil\s+.*(?:servis|destek|hizmet).*yönlendir|talimat(?:ı|ları)?\s+(?:uygula|izle|yaz)|sistem\s+mesajı|iç\s+talimat)/iu;

export function looksLikePromptLeak(text: string) {
  const value = text.trim();
  const plain = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return !value || promptLeakPattern.test(value) || promptHeadingPattern.test(value) || promptInstructionPattern.test(value) || (plain.startsWith("ilk mesaj") && /\b(?:kur|yaz)\b/.test(plain));
}
