import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import "../legal.css";

export const metadata: Metadata = { title: "Güvenli Tanışma İpuçları", description: "Çevrimiçi tanışırken ve ilk buluşmada kendini korumak için pratik ipuçları." };

export default function SafetyTipsPage() {
  return <LegalDocument eyebrow="Güvenlik" title="Güvenle tanış, rahatça buluş." updated="8 Ekim 2026">
    <section><h2>Önce uygulama içinde tanış</h2><p>Telefon numarası, sosyal medya veya adres paylaşmak için acele etme. Karşındaki kişiyle yeterince rahat hissedene kadar sohbeti uygulama içinde sürdür.</p></section>
    <section><h2>Para veya yatırım isteyenlere dikkat</h2><p>Para, hediye kartı, kripto veya yatırım isteyen, acil durum hikâyesi anlatan kişilerle konuşmayı bırak. Bu kişileri şikâyet et ve engelle.</p></section>
    <section><h2>Profili doğrula</h2><p>Doğrulanmış profilleri tercih et. Fotoğrafları ve anlattıkları birbiriyle uyuşmayan, görüntülü görüşmeyi sürekli erteleyen kişilere temkinli yaklaş.</p></section>
    <section><h2>İlk buluşmayı kalabalık yerde yap</h2><p>İlk buluşmayı gündüz, herkese açık bir mekânda yap. Kendi ulaşımınla git ve ayrıl. Kimseyle kapalı bir ortamda buluşmak zorunda değilsin.</p></section>
    <section><h2>Bir yakınına haber ver</h2><p>Kiminle, nerede ve ne zaman buluşacağını güvendiğin birine söyle. Telefonunun şarjlı olduğundan emin ol ve konumunu paylaş.</p></section>
    <section><h2>İçki ve içeceklerini gözetle</h2><p>İçeceğini yanından ayırma ve tanımadığın kişilerden açık içecek kabul etme. Kendini iyi hissetmiyorsan ortamdan ayrıl.</p></section>
    <section><h2>Rahatsız olursan bırak</h2><p>İçine sinmeyen bir durumda sebep göstermek zorunda değilsin. Kişiyi engelle, şikâyet et ve gerekirse yerel acil yardım hattını ara.</p></section>
    <section><h2>Şüpheli bir şey görürsen bildir</h2><p>Sahte profil, taciz veya tehdit gördüğünde profil ya da sohbet ekranından şikâyet et. Moderasyon ekibimiz bildirimleri inceler.</p></section>
  </LegalDocument>;
}
