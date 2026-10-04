import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import "../legal.css";

export const metadata: Metadata = { title: "Topluluk İlkeleri" };
export default function CommunityGuidelinesPage() { return <LegalDocument eyebrow="Topluluk ilkeleri" title="İyi niyet, net sınırlar, gerçek insanlar.">
  <section><h2>Gerçek ol</h2><p>Kendine ait güncel fotoğraflar kullan. Yaşın, kimliğin, ilişki durumun veya niyetin hakkında yanıltıcı bilgi verme. Başkasını taklit etme ve ortak hesap kullanma.</p></section>
  <section><h2>Rıza her adımda gerekir</h2><p>Yanıt gelmemesini yanıt olarak kabul et. Israrlı mesaj, cinsel baskı, hakaret, tehdit, takip veya kişisel sınırları zorlama kabul edilmez. Özel fotoğraf ve konuşmaları izinsiz paylaşma.</p></section>
  <section><h2>Güvenliği koru</h2><p>Para, yatırım, hediye kartı veya finansal bilgi isteme. Kimlik belgesi, adres ve hesap bilgilerini erken paylaşma. Şüpheli davranışı uygulamadaki destek ve şikâyet araçlarıyla bildir; acil tehlikede yerel makamlara başvur.</p></section>
  <section><h2>Alanı ticarete çevirme</h2><p>Toplu mesaj, ürün/hizmet satışı, takipçi toplama, yönlendirme zinciri veya izinsiz reklam yapma. Davet bağlantısını yalnızca gerçekten uygun olacağını düşündüğün kişilere, kişisel bağlamla gönder.</p></section>
  <section><h2>Yaptırım</h2><p>İhlalin ağırlığına göre uyarı, içerik kaldırma, görünürlük kısıtı veya kalıcı hesap kapatma uygulanabilir. İtiraz ve destek için <a href="mailto:destek@lovask.com.tr">destek@lovask.com.tr</a> adresini kullanabilirsin.</p></section>
</LegalDocument>; }
