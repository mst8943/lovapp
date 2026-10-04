import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import "../legal.css";

export const metadata: Metadata = { title: "Kullanım Koşulları" };
export default function TermsPage() { return <LegalDocument eyebrow="Kullanım koşulları" title="Saygılı tanışmanın temel sözleşmesi.">
  <section><h2>1. Uygunluk ve hesap</h2><p>Lovask yalnızca 18 yaşını doldurmuş kişiler içindir. Verdiğin bilgilerin doğru olması, hesabını güvenli tutman ve hesabı başkasına devretmemen gerekir. Başvuru yapmak üyeliğin kabul edildiği anlamına gelmez.</p></section>
  <section><h2>2. Kabul edilebilir kullanım</h2><p>Taciz, tehdit, nefret söylemi, dolandırıcılık, izinsiz ticari ileti, otomatik veri toplama, sahte kimlik, cinsel sömürü veya başkasının özel bilgisini paylaşma yasaktır. Topluluk ilkeleri bu koşulların parçasıdır.</p></section>
  <section><h2>3. İçerik ve lisans</h2><p>İçeriğinin hakları sende kalır. Hizmeti sunabilmemiz için yüklediğin içeriği barındırma, işleme ve diğer üyelere seçtiğin görünürlük kapsamında gösterme izni verirsin. Hak sahibi olmadığın içeriği yükleyemezsin.</p></section>
  <section><h2>4. Noir ve kampanya ödülleri</h2><p>Noir erişimi abonelik olmayan, belirtilen süreyle sınırlı bir hak olabilir. Kurucu ve referans ödülleri yalnızca geçerli, birbirinden farklı gerçek insan hesaplarında; profil tamamlandığında ve bir kez uygulanır. Kötüye kullanımda ödül iptal edilebilir.</p></section>
  <section><h2>5. Moderasyon ve sona erme</h2><p>Güvenlik veya koşul ihlali halinde içerik kaldırabilir, görünürlüğü sınırlayabilir, hesabı askıya alabilir ya da kapatabiliriz. Hesabını profil ayarlarından kapatabilirsin. Yasal saklama zorunlulukları saklıdır.</p></section>
  <section><h2>6. Sorumluluk</h2><p>Lovask üyeler arasında tanışma altyapısı sağlar; üyelerin çevrim içi veya fiziksel davranışlarını garanti etmez. İlk buluşmalarda halka açık yer seçmeni, planını güvendiğin biriyle paylaşmanı ve para göndermemeni öneririz.</p></section>
</LegalDocument>; }
