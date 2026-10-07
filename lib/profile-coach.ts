export type CoachInput = {
  photoCount: number;
  bio: string | null;
  answerCount: number;
  verified: boolean;
  hasVoice: boolean;
  hasCity: boolean;
};
export type CoachCheck = { key: string; label: string; ok: boolean; points: number; hint: string };

export function scoreProfile(input: CoachInput) {
  const bioLength = (input.bio ?? "").trim().length;
  const checks: CoachCheck[] = [
    { key: "photos", label: "En az 3 fotoğraf", ok: input.photoCount >= 3, points: 30, hint: input.photoCount >= 3 ? "Fotoğraf sayın yeterli." : `Şu an ${input.photoCount} fotoğrafın var. Net ışıkta, yüzünün göründüğü ve farklı ortamlardan 3+ fotoğraf eşleşme şansını belirgin artırır.` },
    { key: "bio", label: "Kendini anlatan biyografi", ok: bioLength >= 80, points: 25, hint: bioLength >= 80 ? "Biyografin dolu görünüyor." : "80+ karakterlik, kendinden ve sevdiklerinden bahseden bir biyografi sohbet başlatmayı kolaylaştırır." },
    { key: "answers", label: "En az 2 soru yanıtı", ok: input.answerCount >= 2, points: 20, hint: input.answerCount >= 2 ? "Soru yanıtların tamam." : "Buz kırıcı sorulardan 2 tanesini yanıtla; karşındaki kişiye yazacak konu verir." },
    { key: "verified", label: "Doğrulanmış profil", ok: input.verified, points: 15, hint: input.verified ? "Profilin doğrulanmış." : "Selfie doğrulamasını tamamla; güven rozetin olur." },
    { key: "voice", label: "Sesli biyografi", ok: input.hasVoice, points: 10, hint: input.hasVoice ? "Sesli biyografin var." : "Kısa bir sesli tanıtım, profilini sıcak ve gerçek gösterir." },
  ];
  const score = checks.reduce((sum, check) => sum + (check.ok ? check.points : 0), 0);
  return { score, checks };
}
