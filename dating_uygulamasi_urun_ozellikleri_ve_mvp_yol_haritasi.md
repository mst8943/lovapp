Bunu bir **ürün geliştirme haritası** gibi ele aldım. 29 Eylül 2026 itibarıyla Tinder, Bumble, Hinge, Badoo, Jaumo, OkCupid, Coffee Meets Bagel, happn, Boo, Feeld, Grindr, HER, Muzz, Yubo, Wizz, Slowly, Litmatch, Azar, MeetMe, Skout, Tagged ve benzeri büyük arkadaşlık/flört/sosyal keşif uygulamalarının güncel özelliklerini özellikle resmi yardım merkezlerinden taradım.

Kelimenin tam anlamıyla dünyadaki binlerce dating uygulamasının her birini tek tek yazmak anlamlı olmaz; ancak piyasadaki **neredeyse bütün ürün mekaniklerini kapsayan özellik havuzunu** aşağıda çıkarıyorum. Bunu senin uygulamanı geliştirecekmişiz gibi **MVP → V1 → V2 → V3 → ileri seviye** şeklinde sıralayacağım.

---

# 1. Önce piyasada ne var?

Bugünkü uygulamalar aslında birkaç farklı modeli birleştiriyor.

| Model                       | Örnek                  | Temel fikir                               |
| --------------------------- | ---------------------- | ----------------------------------------- |
| Swipe dating                | Tinder, Badoo, Bumble  | Beğen → eşleş → konuş                     |
| Relationship dating         | Hinge, CMB             | Daha detaylı profil ve kontrollü öneriler |
| Compatibility dating        | OkCupid, Boo           | Sorular/kişilik → uyumluluk puanı         |
| Location dating             | happn, Grindr          | Yakındakiler / yolunun kesiştikleri       |
| Community dating            | Jaumo, HER, Boo        | Topluluk + sosyal feed + dating           |
| Niche dating                | Muzz, Feeld            | Belirli yaşam biçimi/topluluk             |
| Friendship/social discovery | Yubo, Wizz, Bumble BFF | Arkadaş edinme                            |
| Random video/social         | Azar                   | Anında görüntülü bağlantı                 |
| Voice/community             | Litmatch               | Ses odaları ve sohbet oyunları            |
| Slow social                 | Slowly                 | Mektup, ortak ilgi, pen-pal               |

Tinder artık yalnızca swipe değil; Explore, Double Date, Passport, Music Mode, ilişki hedefleri, doğrulama ve AI destekli fotoğraf seçimi gibi katmanlar eklemiş durumda. Double Date iki arkadaşın başka iki arkadaşla eşleşmesini ve dört kişilik grup sohbeti açmasını sağlıyor. [Tinder](https://tinder.com/tr?utm_source=chatgpt.com)

Bumble, Opening Moves ile kullanıcıların profil sorusu veya fotoğraflı başlangıç sorusu tanımlamasına izin veriyor; ayrıca Notes ile eşleşmeden önce mesaj, Spotlight ile görünürlük artışı, SuperSwipe, gelişmiş filtreler, Travel ve Incognito sunuyor. [Bumble](https://bumble.com/en-us/help/opening-moves?utm_source=chatgpt.com)

Hinge ise swipe'tan ziyade **profildeki belirli fotoğraf veya prompt'a tepki verme** fikrine ağırlık veriyor. Standouts, Roses, Most Compatible, prompt'lar, video prompt'lar, prompt poll'ları ve AI destekli Convo Starters bulunuyor. 2026 itibarıyla Hinge uygulama içi sesli/görüntülü aramayı kaldırmış; mesajlaşma ve Voice Notes devam ediyor. [Hinge](https://help.hinge.co/hc/en-us/articles/36311352171539-How-do-I-edit-my-Prompts?utm_source=chatgpt.com)

Badoo Discover + Encounters modelini beraber çalıştırıyor; kullanıcı ister klasik kaydırma kullanıyor, ister liste halinde insanlara bakıyor. Doğrulanmış kullanıcılar kredi ödeyerek eşleşmeden sohbet açabiliyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/32089604459933-Using-Discover?utm_source=chatgpt.com)

Jaumo ise bunun üzerine **topluluk, grup sohbeti, coin, profil puanı, günlük ödül ve AI karakterleri** ekliyor. [Jaumo](https://www.jaumo.com/en/help/a5a6bad1-4755-4bd6-8905-4cd8f8973195/profile-score?utm_source=chatgpt.com)

Bunlardan çıkacak ürün çok daha geniş.

---

# 2. SENİN UYGULAMAN İÇİN MVP

Burada kritik konu şu:

**MVP'ye Tinder + Badoo + Jaumo + Bumble'ın bütün özelliklerini koymamak gerekir.**

Önce şu döngü kusursuz çalışmalı:

> Kayıt → profil → insan gör → beğen → eşleş → mesajlaş → tekrar uygulamaya dön.

Bu döngü çalışmıyorsa Live, AI, coin, topluluk, story, hediye gibi şeylerin pek anlamı yok.

Ben MVP'yi aşağıdaki yapıda kurardım.

## MVP ana navigasyonu

Alt menü:

| Sekme        | İşlev                      |
| ------------ | -------------------------- |
| ❤️ Keşfet    | İnsanları bul              |
| 💕 Beğeniler | Gelen beğeniler/eşleşmeler |
| 💬 Mesajlar  | Sohbet                     |
| 👤 Profil    | Profil ve ayarlar          |

Topluluk, Live, harita vs. başlangıçta koymazdım.

---

# 3. MVP — KAYIT VE ONBOARDING

İlk ekran:

**Logo**

Altında:

> Yeni insanlarla tanış.\
> Gerçek bağlantılar kur.

Sonrasında:

**Telefon numarasıyla devam et**

**Google ile devam et**

**Apple ile devam et**

E-posta alternatif olabilir.

Ama fake account sorunundan dolayı telefon doğrulaması güçlü bir seçenek.

Kayıt akışı:

| Bilgi                   | MVP |
| ----------------------- | --- |
| Ad                      | ✅   |
| Doğum tarihi            | ✅   |
| 18+ kontrol             | ✅   |
| Cinsiyet                | ✅   |
| Kimi görmek istiyor     | ✅   |
| Konum izni              | ✅   |
| Ana fotoğraf            | ✅   |
| Ek fotoğraflar          | ✅   |
| Biyografi               | ✅   |
| İlgi alanları           | ✅   |
| Aradığı ilişki          | ✅   |
| Telefon/email doğrulama | ✅   |
| Push notification izni  | ✅   |

İlk aşamada kullanıcıyı 40 soruluk onboarding'e sokmak istemezsin.

Ama profil daha sonra tamamlanabilir.

---

# 4. YAŞ VE KİMLİK DOĞRULAMA

Dating uygulamasında bu artık neredeyse çekirdek altyapı haline geliyor.

Wizz örneğin yaş doğrulamasını kayıt sırasında zorunlu hale getiriyor ve profil fotoğrafını doğrulama fotoğrafıyla eşleştiriyor. Yubo da yaş doğrulama ve canlı yayın moderasyonunu ürünün önemli parçası yapmış durumda. [Wizz App](https://wizzapp.com/safety-hub?utm_source=chatgpt.com)

MVP'de bile en azından:

**Telefon doğrulama**

-

**Selfie doğrulama**

olmasını tavsiye ederim.

Kullanıcıdan kısa selfie/video alırsın.

Profil fotoğrafıyla karşılaştırırsın.

Doğrulanırsa:

**✓ Doğrulanmış**

rozeti.

Hinge bazı bölgelerde Face Check ile video selfie, yaş kontrolü, fotoğraf karşılaştırması ve duplicate-account detection kullanıyor. [Hinge](https://help.hinge.co/hc/en-us/articles/45715796564243-Face-Check-Scan?utm_source=chatgpt.com)

Muzz ise selfie verification'ı hesap kullanmanın temel koşullarından biri haline getirmiş. [Muzz](https://muzz.com/us/en/help/getting-started/why-do-i-need-to-show-my-face-in-my-verification-selfie-or-main-photo/?utm_source=chatgpt.com)

---

# 5. MVP PROFİLİ

Profil sadece:

> Ahmet\
> 24\
> Kütahya

olmamalı.

Kullanıcı hakkında sohbet başlatacak veri bulunmalı.

Minimum profil yapısı:

| Alan          | Örnek                             |
| ------------- | --------------------------------- |
| Fotoğraflar   | 1–6                               |
| Ad            | Ahmet                             |
| Yaş           | 24                                |
| Şehir         | Kütahya                           |
| Biyografi     | Kendini anlat                     |
| İlişki amacı  | Ciddi ilişki / Flört / Arkadaşlık |
| İlgi alanları | Müzik, spor, seyahat              |
| Boy           | Opsiyonel                         |
| Meslek        | Opsiyonel                         |
| Eğitim        | Opsiyonel                         |
| Burç          | Opsiyonel                         |
| Sigara        | Opsiyonel                         |
| Alkol         | Opsiyonel                         |
| Çocuk isteği  | Sonraki sürüm                     |
| Dil           | Sonraki sürüm                     |
| Doğrulama     | ✓                                 |

---

# 6. HINGE'DEN ALINMASI GEREKEN İYİ BİR FİKİR: PROFİL SORULARI

Hinge üç adet profil prompt'u gösteriyor ve ayrıca photo prompt, video prompt ve prompt poll kullanıyor. [Hinge](https://help.hinge.co/hc/en-us/articles/36311352171539-How-do-I-edit-my-Prompts?utm_source=chatgpt.com)

Örneğin:

**Benim için mükemmel pazar günü…**

**Beni etkilemenin en kolay yolu…**

**Arkadaşlarım benim için şunu söyler…**

**İlk buluşmada yapmayı sevdiğim şey…**

Kullanıcı bir cevap verir.

Profil böylece sadece fiziksel fotoğraflardan oluşmaz.

Sonradan çok önemli bir özellik eklenebilir:

Kullanıcı direkt fotoğrafı değil,

> “Beni etkilemenin yolu…”

cevabını beğenebilir.

Bu sohbet başlatmayı kolaylaştırır.

---

# 7. İLİŞKİ AMACI

Bu MVP'de kesin olsun.

Örneğin:

❤️ Ciddi ilişki

💞 Flört

🔥 Eğlence

👋 Yeni arkadaşlar

☕ Sohbet

🤷 Henüz emin değilim

Tinder da relationship goals bilgisini profil deneyiminin parçalarından biri olarak kullanıyor. [Tinder](https://tinder.com/tr?utm_source=chatgpt.com)

Böylece yanlış beklentiler azalır.

---

# 8. İLGİ ALANLARI

Burada 100–200 hazır kategori oluşturabilirsin.

Kullanıcı örneğin 5–10 tane seçsin.

Spor\
Fitness\
Futbol\
Basketbol\
Oyun\
Anime\
Netflix\
Film\
Kitap\
Teknoloji\
Arabalar\
Motor\
Kahve\
Seyahat\
Fotoğrafçılık\
Doğa\
Kamp\
Hayvanlar\
Kediler\
Köpekler\
Müzik\
Rap\
Rock\
Elektronik müzik\
Yemek\
Dans\
Astroloji

Bunlar daha sonra recommendation engine'de kullanılabilir.

---

# 9. MVP KEŞFET EKRANI

Burada Tinder/Badoo mantığı çalışır.

Büyük fotoğraf.

Altında:

**Ayşe, 24 ✓**

📍 3 km

Ciddi ilişki arıyor

🎵 Müzik\
🐕 Köpekler\
☕ Kahve

Sonra:

**X**

**❤️**

İstersen ortada:

**⭐ Super Like**

ama bunu MVP monetization dönemine bırakabilirsin.

---

# 10. SWIPE

Temel hareketler:

Sağa → Like

Sola → Pass

Profile dokun → detay

Yukarı → sonraki fotoğraf gibi karmaşık gesture'lar başlangıçta gerekmez.

Badoo'nun Encounters özelliği de bir profili tek seferde gösterip Heart veya X ile karar verdiriyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/32089144062493-Using-the-Encounters-Tab?utm_source=chatgpt.com)

---

# 11. FİLTRELER

Ücretsiz filtre:

Cinsiyet

Yaş

Mesafe

İlişki amacı

Daha sonra Premium:

Boy

Eğitim

Sigara

Alkol

Çocuk

Din

Dil

Burç

İlgi alanı

Doğrulanmış hesaplar

Son aktif

Online

Bumble, Hinge ve CMB bu **temel filtre ücretsiz / ileri filtre premium** modelini kullanıyor. Bumble'ın gelişmiş filtreleri Premium'da; Hinge+ ve HingeX'te çocuk, eğitim, siyaset, sigara, alkol vb. filtreler açılıyor. [Bumble](https://bumble.com/help/what-are-filters-and-advanced-filters?utm_source=chatgpt.com)

---

# 12. MATCH

İki kişi birbirini beğenince:

# Bir eşleşme! ❤️

**Ayşe de seni beğendi.**

Altında:

**Mesaj gönder**

**Profiline bak**

Sonra chat ekranı.

Basit ama dating uygulamasının en önemli dopamin anlarından biri.

Animasyon ve haptic feedback burada oldukça işe yarar.

---

# 13. MVP MESAJLAŞMA

İlk sürüm:

| Chat özelliği   | MVP                 |
| --------------- | ------------------- |
| Yazılı mesaj    | ✅                   |
| Emoji           | ✅                   |
| Fotoğraf        | ✅                   |
| GIF             | Sonraki sürüm       |
| Mesaja cevap    | ✅                   |
| Mesaj silme     | ✅                   |
| Engelle         | ✅                   |
| Rapor et        | ✅                   |
| Unmatch         | ✅                   |
| Yazıyor…        | ✅                   |
| Online          | Opsiyonel           |
| Son görülme     | Opsiyonel           |
| Okundu bilgisi  | Premium yapılabilir |
| Sesli mesaj     | V1                  |
| Video           | V2                  |
| Sesli arama     | V2                  |
| Görüntülü arama | V2                  |

Badoo örneğin telefon numarası paylaşmadan uygulama içinde sesli ve görüntülü görüşmeye izin veriyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/34368873355805-Our-safety-features?utm_source=chatgpt.com)

Grindr chat tarafında fotoğraf, video ve voice message'ı çekirdek iletişim araçları olarak sunuyor. [Grindr Yardım Merkezi](https://help.grindr.com/hc/en-us/articles/1500012478721-What-is-Grindr?utm_source=chatgpt.com)

---

# 14. SOHBET BAŞLATMAYI KOLAYLAŞTIR

Dating uygulamalarının önemli sorunlarından biri:

> Match var fakat kimse mesaj atmıyor.

Bumble bunu Opening Moves ile çözmeye çalışıyor.

Kullanıcı bir soru seçiyor:

> “Hayalindeki tatil neresi?”

Match olan kişi direkt cevap verebiliyor. [Bumble](https://bumble.com/en-us/help/opening-moves?utm_source=chatgpt.com)

Senin uygulamada:

**Sohbet Başlatıcı**

özelliği olabilir.

Örneğin chat açıldığında:

> Ayşe de seyahat seviyor.\
> “Şimdi bir ülkeye gidebilseydin nereye giderdin?”

Bu V1'de çok değerli olur.

---

# 15. HINGE MODELİ: LIKE + MESAJ

Çok güzel bir özellik.

Kullanıcı birini beğenirken küçük mesaj ekleyebilir.

Örneğin:

Ayşe'nin Kapadokya fotoğrafı.

Kullanıcı:

❤️ Beğen

ve

> “Ben de geçen yaz gitmiştim 😄”

gönderir.

Hinge bunu profil içeriğine reaksiyon verme mantığıyla kullanıyor; ayrıca Convo Starters, fotoğraflar veya prompt'lardan AI tabanlı konuşma önerileri oluşturuyor. [Hinge](https://help.hinge.co/hc/en-us/articles/46735258688659-What-are-Convo-Starters?utm_source=chatgpt.com)

Bu match kalitesini ciddi biçimde artırabilecek bir mekanik.

---

# 16. MVP GÜVENLİK

Dating app'te güvenlik ekstra özellik değildir.

Çekirdektir.

MVP'de mutlaka:

Engelle

Şikayet et

Unmatch

Fotoğraf raporlama

Mesaj raporlama

Fake profile raporu

Taciz raporu

Spam/scam raporu

18 yaş altı kullanıcı raporu

Hesabı gizle

Hesabı sil

olmalı.

Ayrıca backend admin paneli şart.

---

# 17. ADMIN PANELİ

Kullanıcı uygulamasında görünmez ama ürünün belki de en önemli kısmı.

Admin tarafında:

| Sistem               | İşlev                    |
| -------------------- | ------------------------ |
| Kullanıcı arama      | ID/email/telefon         |
| Profil görüntüleme   | Kullanıcı bilgileri      |
| Raporlar             | Şikayet kuyruğu          |
| Ban                  | Geçici/kalıcı            |
| Shadow restriction   | Kısıtlama                |
| Fotoğraf moderasyonu | Onay/red                 |
| Chat inceleme        | Yalnızca rapor durumunda |
| Verification         | Manuel kontrol           |
| Payment              | Satın alma geçmişi       |
| Subscription         | Üyelik durumu            |
| Coins                | Coin hareketleri         |
| Abuse detection      | Spam/fake                |
| Dashboard            | DAU/MAU/match/chat       |
| Audit log            | Hangi admin ne yaptı     |

Bunu baştan düşünmezsen kullanıcı sayısı büyüdüğünde sorun yaşarsın.

---

# 18. MVP ANALYTICS

Backend şu event'leri tutmalı:

Signup started

Signup completed

Profile completed

Photo uploaded

Verification started

Verification passed

Discovery viewed

Profile viewed

Like sent

Pass sent

Match created

First message sent

Reply received

Conversation created

Unmatch

Block

Report

Subscription viewed

Purchase started

Purchase completed

Bu event'ler olmadan kullanıcıların nerede uygulamayı terk ettiğini bilemezsin.

---

# 19. MVP PUSH NOTIFICATION

Temel bildirimler:

> Yeni bir eşleşmen var ❤️

> Ayşe sana mesaj gönderdi.

> Birisi seni beğendi 👀

> Profilin bugün daha fazla görüntülendi.

> Yeni kişiler seni bekliyor.

Ama bildirim spam yapılmamalı.

Kullanıcı bildirim kategorilerini kapatabilmeli.

---

# 20. MVP'NİN TAM HALİ

İlk yayınlanabilir ürünü şöyle düşün:

| Alan          | Özellik                   |
| ------------- | ------------------------- |
| Auth          | Telefon / Google / Apple  |
| Onboarding    | Ad, yaş, cinsiyet         |
| Profil        | Fotoğraf, bio, ilgi alanı |
| Dating intent | İlişki amacı              |
| Konum         | Mesafe                    |
| Filters       | Yaş/cinsiyet/mesafe       |
| Discovery     | Kart/swipe                |
| Likes         | Like/pass                 |
| Match         | Mutual like               |
| Chat          | Text + fotoğraf           |
| Notification  | Match + mesaj             |
| Safety        | Block/report/unmatch      |
| Verification  | Selfie                    |
| Account       | Pause/delete              |
| Backend       | Moderasyon                |
| Analytics     | Temel funnel              |
| Payment       | İstersen tek Premium      |

Bence bundan fazlası **ilk gerçek MVP için gereksiz**.

---

# 21. V1 — MVP ÇALIŞTIKTAN SONRA EKLENECEKLER

Buradan sonra ürün zenginleşmeye başlar.

## “Seni Kim Beğendi?”

Dating uygulamalarının klasik Premium tetikleyicisi.

Ücretsiz kullanıcı görür:

> Seni 14 kişi beğendi.

Ama fotoğraflar blur.

Premium:

> Hepsini gör.

Tinder Gold, Hinge+, Bumble Premium, Badoo Premium, CMB Premium ve Jaumo Premium buna benzer bir sistem kullanıyor. [Tinder Yardım](https://www.help.tinder.com/hc/tr/articles/115004487406-Tinder-abonelikleri?utm_source=chatgpt.com)

Bu monetization açısından en güçlü ürün kalıplarından biri.

---

# 22. UNLIMITED LIKES

Ücretsiz:

örneğin günde 30–50 like.

Premium:

sınırsız.

Tinder Plus, Hinge+, Jaumo Plus gibi uygulamalar bu yaklaşımı kullanıyor. [Tinder Yardım](https://www.help.tinder.com/hc/tr/articles/115004487406-Tinder-abonelikleri?utm_source=chatgpt.com)

Burada amaç kullanıcıyı cezalandırmak değil.

Swipe spam'i azaltmak ve Premium'a değer yaratmak.

---

# 23. REWIND

Yanlışlıkla sola kaydırdı.

> Geri al.

Premium özellik.

Badoo, Tinder, Jaumo ve CMB benzeri geri alma mekaniklerine sahip. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/32089144062493-Using-the-Encounters-Tab?utm_source=chatgpt.com)

Teknik olarak basit, algılanan değeri yüksek.

---

# 24. SUPER LIKE / CRUSH / ROSE / FLOWER / PING

Hemen hemen herkes farklı isim vermiş.

Tinder:

**Super Like**

Hinge:

**Rose**

Badoo:

**Crush**

Coffee Meets Bagel:

**Flower**

Feeld:

**Ping**

Jaumo:

**Super-Request**

Aslında hepsi aynı şeyi satıyor:

> “Ben sana normalden daha fazla ilgi gösteriyorum.”

Hinge'de Rose alan kullanıcının Likes You ekranında üste çıkıyor. [Hinge](https://help.hinge.co/hc/en-us/articles/36311177115027-Roses?utm_source=chatgpt.com)

CMB'de Flower anında Likes You'ya düşüyor. [coffeemeetsbagel.zendesk.com](https://coffeemeetsbagel.zendesk.com/hc/en-us/articles/31212228097043-How-does-Discover-work?utm_source=chatgpt.com)

Feeld Ping'e kişisel not da eklenebiliyor. [support.feeld.co](https://support.feeld.co/hc/en-gb/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJykjzCOCDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBxWxy%2BOCDoLbG9jYWxlSSIKZW4tZ2IGOgZFVDoIdXJsSSI1L2hjL2VuLWdiL2FydGljbGVzLzk0MDY3OTMwOTgzOTYtUGluZ3MtZXhwbGFpbmVkBjsIVDoJcmFua2kJ--0ae240f9e43c51183ee354790f63e1ef3a60c133\&utm_source=chatgpt.com)

Sen buna markana göre isim verebilirsin.

Örneğin:

**💖 Kalp Atışı**

veya

**✨ Spark**

---

# 25. BOOST

Bir diğer evrensel para kazanma sistemi.

> Profilimi 30 dakika daha fazla göster.

Tinder Boost.

Bumble Spotlight.

Badoo Extra Shows/visibility.

Jaumo Boost.

Feeld Uplift.

Grindr Boost.

Hinge Boost.

Feeld'in Uplift'i profili 24 saat Discover'da öne taşıyor. [support.feeld.co](https://support.feeld.co/hc/en-gb/articles/9406801337244-Uplift-explained?utm_source=chatgpt.com)

Jaumo 30 dakikalık ve daha uzun Boost seçenekleri sunuyor. [Jaumo](https://www.jaumo.com/en/help/62bc3853-b8c2-49d8-82a7-fede64d92c00/what-are-boosts?utm_source=chatgpt.com)

Grindr Boost profili yakındaki Grid'in üstlerine taşıyor. [Grindr](https://www.grindr.com/blog/introducing-boost-new-feature?utm_source=chatgpt.com)

Bu sana çok güçlü bir consumable ürün verir.

---

# 26. PRE-MATCH MESSAGE

Bu önemli.

Normalde:

Like → Match → Chat.

Ama kullanıcı:

> “Bu kişiye mutlaka yazmak istiyorum.”

diyebilir.

O zaman coin harcar.

Badoo Credits ile eşleşmeden chat açmaya izin veriyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/32090645184925-Understanding-Badoo-s-paid-features?utm_source=chatgpt.com)

Jaumo Coins ile pre-match chat request ve Super Request veriyor. [Jaumo](https://www.jaumo.com/en/help/2c7a8ac6-6715-4dfd-8e80-289b2b512146/coins?utm_source=chatgpt.com)

Bumble Notes da eşleşmeden önce profil içeriği üzerinden mesaj bırakmaya izin veriyor. [Bumble Destek](https://support.bumble.com/hc/en-us/articles/32668790872733-Understanding-Bumble-s-paid-features-and-subscription-plans?utm_source=chatgpt.com)

Senin uygulamada mesela:

**Mesaj İsteği**

olabilir.

Normal:

10 coin.

Priority:

25 coin.

---

# 27. READ RECEIPT

> Mesajımı gördü mü?

Badoo bunu Credits ile satıyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/32090645184925-Understanding-Badoo-s-paid-features?utm_source=chatgpt.com)

CMB Premium Read Receipts sunuyor. [coffeemeetsbagel.zendesk.com](https://coffeemeetsbagel.zendesk.com/hc/en-us/articles/360021076153-What-s-included-in-CMB-Premium-and-Platinum-subscriptions?utm_source=chatgpt.com)

Sen de:

Premium'un parçası

veya

tek kullanımlık coin özelliği

yapabilirsin.

---

# 28. ONLINE / SON GÖRÜLME

Normal:

Online bilgisi sınırlı.

Premium:

Online

Son görülme

Şu an aktif

görebilir.

Jaumo bunu Plus katmanının bir parçası yapıyor. [Jaumo](https://www.jaumo.com/en/help/40fc6931-6c41-4963-a428-9d0108a8f04a/exploring-the-benefits-of-plus-and-premium?utm_source=chatgpt.com)

Ama gizlilik için:

**Online durumumu gizle**

ayarı şart.

---

# 29. INCOGNITO

Çok iyi Premium özelliği.

Normal kullanıcı:

Discovery'de herkese görünür.

Incognito:

> Yalnızca benim beğendiğim kişiler beni görebilsin.

Bumble Premium, CMB Platinum ve Feeld Majestic bu modele benzer gizlilik özellikleri sunuyor. [Bumble Destek](https://support.bumble.com/hc/en-us/articles/32668790872733-Understanding-Bumble-s-paid-features-and-subscription-plans?utm_source=chatgpt.com)

Bu özellikle kadın kullanıcılar ve gizlilik isteyen kullanıcılar için değerli olabilir.

---

# 30. TRAVEL MODE

Örneğin kullanıcı İstanbul'a gidecek.

Daha gitmeden:

📍 İstanbul

seçer.

İstanbul'daki profilleri görmeye başlar.

Tinder Passport, Bumble Travel, Jaumo Travel ve Grindr Roam bunun farklı versiyonlarını kullanıyor. Bumble Travel seçilen şehirde konumu yedi gün değiştirebiliyor. Grindr Roam ise profili başka lokasyona bir saatliğine taşıyor. [Tinder](https://tinder.com/tr?utm_source=chatgpt.com)

Premium için güzel özellik.

---

# 31. V1 COIN EKONOMİSİ

Bence uygulaman ciddi şekilde gelir yaratacaksa sadece abonelik değil:

**Subscription + Coin**

kurulmalı.

Coin ile alınabilecekler:

| Ürün               | Coin  |
| ------------------ | ----- |
| Super Like         | 10    |
| Pre-match message  | 20    |
| Priority Message   | 30    |
| Read Receipt       | 5     |
| 30 dk Boost        | 50    |
| 2 saat Boost       | 100   |
| Gift               | 5–100 |
| AI opener          | 2     |
| Profil öne çıkarma | 50    |

Bu kullanıcıya çok farklı ödeme seçenekleri sağlar.

---

# 32. COIN NASIL KAZANILIR?

Sadece satma.

Oyunlaştır.

Jaumo profil tamamlama, doğrulama ve çeşitli görevlerle ücretsiz coin kazandırıyor; ayrıca günlük giriş ödülleri var ve reklam izleyerek günlük ödül ikiye katlanabiliyor. [Jaumo](https://www.jaumo.com/en/help/2c7a8ac6-6715-4dfd-8e80-289b2b512146/coins?utm_source=chatgpt.com)

Senin sistem:

Profil %100 tamamla → +20

Selfie doğrula → +50

3 gün giriş → +10

7 gün giriş → +30

İlk mesaj → +5

İlk match → +5

Arkadaş davet et → +50

Rewarded ad → +5

Bu kullanıcıyı ekonomi sistemine sokar.

---

# 33. STREAK

Örneğin:

🔥 1 gün

🔥 3 gün

🔥 7 gün

🔥 14 gün

🔥 30 gün

Günlük giriş devam ettikçe ödül artar.

Dating uygulamasında dikkatli uygulanmalı; ürünün kumar gibi hissettirmemesi gerekir.

Ama günlük ödül sistemi retention'a hizmet eder.

---

# 34. PROFILE SCORE

Jaumo'daki ilginç özelliklerden biri.

Profil skoru:

**72/100**

Neden?

Fotoğraf: +20

Bio: +10

İlgi alanları: +15

Doğrulama: +20

Profil soruları: +15

Topluluğa katılım: +10

Aktiflik: +10

Jaumo profil skorunu doğrulama, profil tamamlama ve community engagement gibi faktörlere bağlıyor. [Jaumo](https://www.jaumo.com/en/help/a5a6bad1-4755-4bd6-8905-4cd8f8973195/profile-score?utm_source=chatgpt.com)

Sen bunu:

**Profil Gücü**

diye gösterebilirsin.

Örneğin:

> Profilin %68 tamamlandı.\
> +3 ilgi alanı ekle → %75.

Bu kullanıcıyı profili doldurmaya teşvik eder.

---

# 35. V2 — ALGORİTMAYI GELİŞTİR

MVP'de:

Yaş + mesafe + cinsiyet.

Daha sonra scoring engine.

Örneğin:

`Match Score =`

Mesafe uyumu &#x20;

- yaş uyumu &#x20;
- ilişki amacı &#x20;
- ortak ilgi alanı &#x20;
- activity &#x20;
- profile quality &#x20;
- davranışsal benzerlik &#x20;
- like-back likelihood.

Ama kullanıcıya skorun tamamını açıklamak zorunda değilsin.

---

# 36. OKCUPID MODELİ

OkCupid'in ilginç tarafı soru sistemi.

Yaklaşık **500 match question** bulunuyor ve platform başlangıç için yaklaşık 50–100 soruya yanıt vermeyi öneriyor. Bu cevaplardan Match % üretiliyor. [OkCupid](https://okcupid-app.zendesk.com/hc/en-us/articles/22770910347803-Match-Questions?utm_source=chatgpt.com)

Örneğin:

“Çocuk istiyor musun?”

“Sigara senin için sorun mu?”

“Gece hayatı önemli mi?”

“Evcil hayvan sever misin?”

“Uzun mesafe ilişki olur mu?”

Senin uygulamada 500 soruyla başlamana gerek yok.

30–50 kaliteli soru yeter.

Sonra:

**%89 uyum**

gibi skor.

---

# 37. BOO MODELİ: KİŞİLİK TESTİ

Boo kullanıcıya 30 soruluk test verip 16 kişilik tipinden birini çıkarıyor ve eşleştirmede kişilik uyumunu kullanıyor. Ayrıca sosyal Universe feed'i bulunuyor. [Boo World](https://boo.world/tr/faq?utm_source=chatgpt.com)

Sen ileride:

**Kişilik testi**

ekleyebilirsin.

Örneğin:

Introvert/Extrovert

Planlı/Spontane

Romantik/Mantıklı

Ev insanı/Sosyal

Risk alan/Temkinli

Böylece:

> %86 yaşam tarzı uyumu

çıkarabilirsin.

Ama bunu bilimsel kesinlik gibi sunmamak daha doğru olur.

---

# 38. MOST COMPATIBLE

Hinge kullanıcıya günlük bir **Most Compatible** önerisi veriyor; karşılıklı dealbreaker'lar, yakın geçmişteki aktivite ve like davranışları gibi sinyalleri kullanıyor. [Hinge](https://help.hinge.co/hc/en-us/articles/360011233073-What-is-Most-Compatible?utm_source=chatgpt.com)

Senin uygulamada:

# Bugünün Özel Eşleşmesi ✨

günde 1 kişi.

Bu scarcity oluşturur.

---

# 39. GÜNLÜK SINIRLI ÖNERİ

Coffee Meets Bagel bunun iyi örneği.

Her gün öğlen yeni bir seçilmiş profil grubu gösteriyor.

Ama sonsuz swipe yok.

Platform buna Suggested diyor ve kullanıcı davranışı ile tercihlerini kullanıyor. [coffeemeetsbagel.zendesk.com](https://coffeemeetsbagel.zendesk.com/hc/en-us/articles/360019599254-What-is-Coffee-Meets-Bagel?utm_source=chatgpt.com)

Sen ayrıca:

**Bugünün 10 kişisi**

bölümü oluşturabilirsin.

Bu Tinder tarzı sonsuz swipe'ın yanına farklı bir deneyim koyar.

---

# 40. HAPPN MODELİ: GERÇEK HAYATTA YOLUNUN KESİŞTİĞİ KİŞİLER

happn'ın farklılaştırıcı özelliği bu.

Kullanıcı:

> “Bugün yolunun kesiştiği insanlar”

görüyor.

Ayrıca Map, son 14 günlük karşılaşma noktalarına göre profilleri bulmaya izin veriyor; uygulama gerçek zamanlı kesin konumu göstermediğini belirtiyor. [Happn Destek Merkezi](https://support.happn.fr/hc/en-us/articles/15703631805853-What-is-the-happn-Map?utm_source=chatgpt.com)

Senin uygulamaya ileride:

# Yakınından Geçenler

eklenebilir.

Fakat privacy açısından gerçek konumu vermemelisin.

Örneğin:

> 2 saat önce şehir merkezinde yollarınız kesişti.

---

# 41. GRINDR MODELİ: GRID

Swipe dışında farklı bir keşif modeli.

Grindr ana ekranda en yakındaki kullanıcıları Grid halinde gösteriyor.

Sonra:

Tags

Filters

Fresh

Explore

ile filtreleniyor. [Grindr Yardım Merkezi](https://help.grindr.com/hc/en-us/articles/1500012478721-What-is-Grindr?utm_source=chatgpt.com)

Sen de kullanıcıya seçim verebilirsin:

**Kart görünümü**

ve

**Grid görünümü**

Swipe istemeyen kullanıcı grid kullanır.

---

# 42. FRESH

Grindr'da Fresh:

son bir saat aktif olup yeni hesap açmış veya yeni fotoğraf yüklemiş profilleri öne çıkarıyor. [Grindr Yardım Merkezi](https://help.grindr.com/hc/en-us/articles/12155590113043-Fresh?utm_source=chatgpt.com)

Senin uygulamada:

**Yeni**

**Şimdi aktif**

**Yeni fotoğraf**

badge'leri olabilir.

Bu discovery'yi canlı hissettirir.

---

# 43. V2 COMMUNITY

Burada Jaumo + HER + Boo birleşir.

Ana navigasyona:

**Topluluklar**

eklersin.

Örnek:

🎮 Oyuncular

🐕 Hayvanseverler

🏋 Fitness

✈️ Gezginler

🎬 Film

📚 Kitap

🎵 Müzik

🚗 Arabalar

♈ Astroloji

☕ Kahve

🎓 Üniversiteliler

🌙 Gece kuşları

Jaumo public communities ve ayrı community chat yapısına sahip. [Jaumo](https://www.jaumo.com/tr/help/cb038d59-5c14-49d3-ae4a-72bac743aec7/joining-or-leaving-a-community-and-a-chat-what-you-need-to-k?utm_source=chatgpt.com)

HER ise sınırsız sayıda LGBTQ+ temalı community'ye katılmayı ve bu alanlarda post/etkileşim yapmayı destekliyor. [support.weareher.com](https://support.weareher.com/hc/en-us/articles/37020509469467-Communities-FAQ?utm_source=chatgpt.com)

Boo'da da Universe sosyal feed bulunuyor. [Boo World](https://boo.world/faq?utm_source=chatgpt.com)

---

# 44. COMMUNITY İÇİ ÖZELLİKLER

Her community:

Kapak fotoğrafı

Açıklama

Üye sayısı

Üyeler

Post feed

Chat

Like

Comment

Mention

Report

Mute

Moderator

Pinned post

içerebilir.

Buradan dating uygulaması klasik swipe ürününden çıkıp **dating social network** haline gelir.

---

# 45. ÖZEL GRUP

Jaumo Premium kullanıcıları ikiden fazla connection olduğunda özel grup oluşturabiliyor ve grup admini üye ekleme/çıkarma, mute, admin atama ve mesaj sabitleme yapabiliyor. [Jaumo](https://www.jaumo.com/en/help/59b0b122-52e6-42b6-b901-a9e5eb725a23/creating-and-managing-private-groups?utm_source=chatgpt.com)

Senin uygulamada:

**Grup oluştur**

3–20 kişi.

Arkadaş grubu.

Etkinlik grubu.

Travel grubu.

Oyun grubu.

Bu dating dışı retention yaratır.

---

# 46. SOCIAL FEED

Boo/HER/Litmatch tarafında gördüğümüz model.

Ana feed:

Fotoğraf

Yazı

Poll

Video

Story

Kullanıcı:

Like

Comment

Follow

DM

yapabilir.

Ama burada dikkat:

Bu özellik artık seni Instagram benzeri bir ürün geliştirmeye iter.

Dolayısıyla MVP'ye kesin koymazdım.

---

# 47. STORY

24 saatlik içerik.

Profilde halka.

Kullanıcı:

Fotoğraf/video paylaşır.

Match'ler veya topluluk üyeleri cevaplayabilir.

Böylece sohbet için doğal tetik oluşur:

> Story'ye cevap ver.

Bu daha ileriki sürüm.

---

# 48. V2 VOICE NOTE

Dating chat'te çok iyi özellik.

10 saniye–5 dakika.

Playback:

1×\
1.5×\
2×

Voice note kullanıcıya karşı tarafın gerçek bir insan olduğunu da biraz hissettirir.

Hinge 2026'da aramayı kaldırmasına rağmen Voice Notes'u koruyor. [Hinge](https://help.hinge.co/hc/en-us/articles/20650526717971-What-happened-to-the-Voice-and-Video-Calling-feature?utm_source=chatgpt.com)

---

# 49. VOICE CALL

Uygulama içinde.

Telefon numarası görünmez.

Call request:

> Ayşe seni aramak istiyor.

Kabul / reddet.

Block/report mevcut.

---

# 50. VIDEO CALL

Dating için güvenlik açısından da değerli.

Buluşmadan önce:

**Video date**

yapılabilir.

Badoo uygulama içinde video ve voice call sunuyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/34368873355805-Our-safety-features?utm_source=chatgpt.com)

Ama video altyapısı maliyetlidir.

WebRTC/Twilio/Agora benzeri altyapı gerektirir.

O nedenle MVP değil.

---

# 51. RANDOM VIDEO CHAT

Azar modeli.

Kullanıcı:

**Başlat**

der.

Sistem online başka bir kullanıcıyla eşleştirir.

Video açılır.

Next → sonraki kullanıcı.

Azar ayrıca Lounge üzerinden profil gezme, seçili kullanıcıyla video bağlantı başlatma ve ülke/cinsiyet filtrelerini premiumlaştırma modelini kullanıyor. [Google Play](https://play.google.com/store/apps/details/?hl=en\&id=com.azarlive.android\&utm_source=chatgpt.com)

Bunu dating ürününe koymak ürünün karakterini ciddi biçimde değiştirir.

---

# 52. LIVE TRANSLATION

Azar'ın en ilginç teknolojik özelliklerinden biri.

Konuşma:

speech-to-text

→ translation

→ karşı tarafta subtitle.

Azar bunu canlı görüntülü görüşmede sunuyor. [Azar Yardım Merkezi](https://help.azarlive.com/hc/tr/articles/61774576359065-Canl%C4%B1-%C3%87eviri-Tan%C4%B1t%C4%B1m%C4%B1?utm_source=chatgpt.com)

Sen global uygulama yaparsan çok güçlü özellik olabilir.

---

# 53. LITMATCH MODELİ

Litmatch dating'den çok sosyal bağ kurma odaklı.

Şunları kullanıyor:

**Soul Game:** gerçek zamanlı text eşleşmesi.

**Voice Game:** ses üzerinden eşleşme.

**Party Chat:** grup ses odaları.

**Avatar:** özelleştirilebilir karakter.

**Feed:** kullanıcı paylaşımları. [Google Play](https://play.google.com/store/apps/details?hl=tr\&id=com.litatom.lite\&utm_source=chatgpt.com)

Buradan çıkarılabilecek özellik:

# Sesle Tanış

İki kullanıcı profillerini görmeden 2 dakika konuşur.

Süre bittiğinde:

❤️ Bağlan

❌ Geç

Bu gerçekten farklılaştırıcı olabilir.

---

# 54. SLOWLY MODELİ

Bu uygulama tamamen ters psikoloji kullanıyor.

Instant messaging yerine mesajın karşı tarafa ulaşması gerçek mesafeye göre zaman alıyor. [Slowly Yardım Merkezi](https://help.slowly.app/hc/en-us/articles/115001740772-What-is-Slowly?utm_source=chatgpt.com)

Ayrıca:

Open Letters

Profile discovery

Auto Match

Slowly ID

Language exchange

City map

Q&A

Avatar

Stamp collection

bulunuyor. [Slowly Yardım Merkezi](https://help.slowly.app/hc/en-us/articles/115001829051-How-do-I-match-a-new-friend-on-Slowly?utm_source=chatgpt.com)

Dating ürününde direkt kopyalanmasına gerek yok.

Ama:

**Mektup gönder**

diye derin bağlantı özelliği olabilir.

500+ karakter.

Karşı taraf kabul ederse sohbet açılır.

---

# 55. DOUBLE DATE

Tinder'ın 2026'daki ilginç özelliklerinden.

Sen + arkadaşın.

Karşı taraf + arkadaşı.

İki çift eşleştiğinde dört kişilik chat açılıyor. [Tinder Yardım](https://www.help.tinder.com/hc/tr/articles/34712866048653-%C3%87ifte-Randevu?utm_source=chatgpt.com)

Senin uygulama V3:

# Çift Randevu

Arkadaşını seç.

Bir ekip oluştur.

Başka ekiplere swipe yap.

Match:

4 kişilik sohbet.

Özellikle genç kullanıcılar için dating üzerindeki baskıyı azaltabilir.

---

# 56. EVENT / PLANS

Bumble For Friends'in Plans özelliği kullanıcının yakındaki buluşmaları oluşturmasına ve katılmasına izin veriyor. [Bumble](https://bumble.com/the-buzz/en-us/bumble-for-friends-how-to-host-plans?amp=1\&utm_source=chatgpt.com)

Sen:

# Etkinlikler

Kahve buluşması

Koşu

Board game

Sinema

Concert

Gezi

oluşturabilirsin.

Örneğin:

**Cumartesi kahve buluşması**

📍 Kütahya

👥 8/12 kişi

18:00

Katıl.

Bu friendship tarafını güçlendirir.

---

# 57. VIRTUAL GIFTS

MeetMe, Skout ve benzeri sosyal discovery uygulamalarında live + virtual gift ekonomisi yaygın.

Skout örneğin canlı yayınları ve sanal hediyeleri doğrudan ürün deneyiminin parçası olarak tanıtıyor. [Skout](https://www.skout.com/tr/?utm_source=chatgpt.com)

Sen:

🌹 Rose

☕ Coffee

❤️ Heart

💎 Diamond

🎁 Gift

ekleyebilirsin.

Coin ile satın alınır.

---

# 58. PRIVATE PHOTO ALBUM

Grindr burada çok iyi örnek.

Kullanıcı özel albüm oluşturuyor.

Belirli kişilere erişim veriyor.

Sonra geri alabiliyor.

Bazı premium kullanıcılarda albüm erişimi:

Bir kez

10 dakika

1 saat

24 saat

süresince verilebiliyor. [Grindr Yardım Merkezi](https://help.grindr.com/hc/en-us/articles/4414580688787-Albums?utm_source=chatgpt.com)

Sen bunu cinsel içerik odağında değil:

**Özel Albüm**

şeklinde kullanabilirsin.

Mesela yalnızca match olduktan sonra açılır.

---

# 59. EXPIRING PHOTO

1 kere görüntülenir.

Sonra yok olur.

Screenshot protection.

Grindr 1 görüntüleme / 10 saniyelik expiring photo mekanizmasına sahip. [Grindr Yardım Merkezi](https://help.grindr.com/hc/en-us/articles/4402749200915-In-app-privacy-features?utm_source=chatgpt.com)

Bu dating chat için güzel ama moderation ve abuse riskini artırdığı için ileriki sürüme bırakılmalı.

---

# 60. SCREENSHOT PROTECTION

Muzz uygulama içinde profil ve görsellerin ekran görüntüsü/kaydı konusunda koruma kullanıyor. [Muzz](https://muzz.com/us/en/help/safety-and-privacy/how-does-muzz-keep-users-safe/?utm_source=chatgpt.com)

Sen de hassas alanlarda:

Screenshot disabled

veya

Screenshot detected

uyarısı ekleyebilirsin.

---

# 61. BLURRED PROFILE

Muzz'dan çok iyi gizlilik fikri.

Kullanıcı fotoğrafını blur yapar.

Sadece seçtiği match'e açar.

Muzz bunu özellikle kadın kullanıcıların fotoğraf gizliliği için kullanıyor. [Muzz](https://muzz.com/us/en/help/getting-started/how-is-muzz-halal/?utm_source=chatgpt.com)

Sen bunu herkese açabilirsin.

**Fotoğraflarımı yalnızca onayladığım kişiler görsün.**

Premium veya ücretsiz safety feature olabilir.

---

# 62. CHAPERONE

Muzz'ın alışılmadık özelliklerinden.

Chaperone Mode, chat transcript'lerini belirlenen wali/chaperone ile haftalık paylaşabiliyor. [Muzz](https://muzz.com/us/en/help/getting-started/how-is-muzz-halal/?utm_source=chatgpt.com)

Sen bunu farklı biçimde:

**Güvenilir kişi**

özelliğine çevirebilirsin.

Örneğin:

> Buluşmaya gidiyorum.

Arkadaşa:

Kişinin adı

profil linki

buluşma yeri

buluşma saati

gönder.

Tinder da **Share My Date / Randevumu Paylaş** gibi güvenlik araçları sunuyor. [Tinder](https://tinder.com/tr?utm_source=chatgpt.com)

---

# 63. DATE SAFETY

İleride çok güçlü olabilir.

**Randevum var**

butonu.

Kullanıcı:

Match seçer.

Lokasyon.

Saat.

Tahmini bitiş.

Güvenilir kişi.

Sonra:

> Güvende misin?

check-in.

Yanıt gelmezse kullanıcı önceden belirlediği güvenilir kişiye bildirim seçeneği sunulabilir.

---

# 64. AI MODERATION

Burada AI gerçekten önemli.

AI:

Nude detection

Spam detection

Scam detection

Fake profile

Hate speech

Harassment

Underage risk

Solicitation

Bot pattern

Message abuse

kontrolü yapabilir.

Yubo AI ve insan moderasyonunu beraber çalıştırıyor ve canlı yayınları gerçek zamanlı denetlediğini söylüyor. [yubo.live](https://www.yubo.live/safety/safety-tools?utm_source=chatgpt.com)

Wizz ise upload edilen içeriği görünmeden önce otomatik moderasyondan geçirdiğini belirtiyor. [Wizz App](https://wizzapp.com/safety-hub?utm_source=chatgpt.com)

---

# 65. AI PHOTO SELECTOR

Tinder'ın Photo Selector'ı cihazdaki fotoğrafları inceleyerek hangi fotoğrafların profil için uygun olabileceğini öneriyor; işlemin cihaz üzerinde gerçekleştiğini belirtiyor. [Tinder Yardım](https://www.help.tinder.com/hc/tr/articles/21276850679693-Foto%C4%9Fraf-Se%C3%A7ici?utm_source=chatgpt.com)

2026'da ayrıca Photo Tips, kullanıcının fotoğraflarının çeşitliliği ve profil içeriği üzerinden “başka tür fotoğraf ekle” gibi öneriler veriyor. [Tinder Yardım](https://www.help.tinder.com/hc/en-us/articles/48425605518861-Photo-Tips?utm_source=chatgpt.com)

Sen:

# AI Profil Koçu

koyabilirsin.

> 6 fotoğrafından 4'ü selfie.\
> Bir aktivite fotoğrafı ekle.

> Biyografin çok kısa.

> 3 ilgi alanı daha ekle.

Bu gerçekten güzel Premium özelliğe dönüşebilir.

---

# 66. AI FIRST MESSAGE

Hinge AI Convo Starters profil fotoğrafı ve prompt'lardan konuşma konusu öneriyor. [Hinge](https://help.hinge.co/hc/en-us/articles/46735258688659-What-are-Convo-Starters?utm_source=chatgpt.com)

Jaumo ise coin kullanarak AI message suggestion sunuyor. [Jaumo](https://www.jaumo.com/en/help/2c7a8ac6-6715-4dfd-8e80-289b2b512146/coins?utm_source=chatgpt.com)

Sen:

**✨ Mesaj öner**

butonu.

Ayşe profili:

Kediler

İtalya

Kahve

AI:

> “Profilindeki Roma fotoğrafını görünce merak ettim, İtalya'da en sevdiğin şehir hangisiydi?”

Kullanıcı düzenleyip gönderir.

AI'nın direkt otomatik mesaj göndermemesi daha iyi olur.

---

# 67. AI DATING COACH

Bir üst seviye.

Kullanıcı:

> Profilimi iyileştir.

AI:

Bio önerisi.

Fotoğraf sırası.

Prompt önerileri.

İlgi alanı önerisi.

Sohbet önerisi.

Buluşma fikri.

Ama tavsiye kullanıcıya sunulur; AI kullanıcının yerine insanlarla gizlice konuşmaz.

---

# 68. AI PROFILES

Jaumo'nun en sıra dışı özelliklerinden.

Gerçek insan olmayan yapay zekâ karakterleri var.

Kullanıcı bunlarla sohbet edebiliyor.

Basic kullanım sınırlı, Plus ve üzeri daha uzun kullanım sağlıyor. Jaumo bunların gerçek kişi olmadığını açıkça belirtiyor. [Jaumo](https://www.jaumo.com/en/help/b61c5971-ba6c-49f6-81ac-2e3b07d996ec/what-are-ai-profiles-and-how-do-they-work?utm_source=chatgpt.com)

Sen yaparsan:

**AI karakter olduğu çok açık olmalı.**

İnsan profili gibi gizlenmemeli.

Örneğin:

🤖 AI

**Lina**

“Sohbet pratiği yap.”

Böylece kullanıcı match beklerken uygulamada vakit geçirir.

Ama bunu MVP'den çok sonra düşünürdüm.

---

# 69. PREMIUM YAPISI

Ben doğrudan 3 üyelikle başlamazdım.

Başlangıç:

# Ücretsiz

Profil

Discovery

Match

Chat

Günde belirli like

Temel filtre

# Premium

Sınırsız like

Seni kim beğendi

Rewind

Advanced filters

Incognito

Travel

Read receipts

Haftalık Super Like

Haftalık Boost.

Daha sonra:

# Premium+

Always-on visibility

Priority Likes

AI profile coach

Daha fazla Boost

Daha fazla pre-match message.

Bumble Premium+ zaten profile insight, hızlı gösterilen likes ve sürekli daha yüksek görünürlük gibi avantajlar ekliyor. [Bumble](https://bumble.com/en-us/help/what-is-bumble-premium-plus?utm_source=chatgpt.com)

HingeX de Enhanced Recommendations, Skip the Line ve Priority Likes sunuyor. [Hinge](https://help.hinge.co/hc/en-us/articles/38014282744595-Subscription-and-Purchase-Benefits?utm_source=chatgpt.com)

---

# 70. MONETIZATION MİMARİSİ

En güçlü model tek gelir kaynağı değil.

## Abonelik

Aylık recurring revenue.

## Coins

Tek kullanımlık satın almalar.

## Boost

Visibility.

## Super Like

Intent.

## Pre-match message

Access.

## Gifts

Emotional expression.

## Ads

Free kullanıcı.

## Rewarded ads

Ücretsiz coin.

## AI

AI chat / coach / message.

## Avatar cosmetics

Kıyafet / badge / theme.

## Event

İleride etkinlik.

Burada Jaumo çok öğretici: abonelik + Boost + Coins + rewarded ads + AI özelliklerini aynı ekonomide birleştiriyor. [Jaumo](https://www.jaumo.com/en/help/62bc3853-b8c2-49d8-82a7-fede64d92c00/what-are-boosts?utm_source=chatgpt.com)

Slowly ise dating dışında güzel bir örnek olarak Coin'i premium avatar/stamp ekonomisinde kullanıyor. [Slowly Yardım Merkezi](https://help.slowly.app/hc/en-us/articles/60740159254297-What-are-Slowly-Coins-and-how-can-I-use-them?utm_source=chatgpt.com)

---

# 71. USER RETENTION SİSTEMİ

Kullanıcının uygulamaya geri dönmesi için yalnızca “yeni match” yeterli değil.

Senin ürününde zamanla şu döngü oluşabilir:

> Yeni profil → like → match → message → daily reward → community → profile score → new suggestion → notification → tekrar uygulama.

Dating + social ürünlerin avantajı burada.

---

# 72. FRIENDSHIP MODE

Bence uygulamanın ileride önemli parçası olabilir.

Profilde:

**Ne arıyorsun?**

Dating ❤️

Arkadaşlık 👋

İkisi 🌈

Sonra discovery buna göre çalışır.

Ancak başlangıçta iki ayrı kullanıcı havuzu oluşturmak küçük uygulamada liquidity sorununa yol açabilir.

Başlangıçta aynı profile **niyet etiketi** koymak daha mantıklı.

Kullanıcı büyüdükten sonra ayrı:

**Dating**

**Friends**

modu açılabilir.

Bumble For Friends bu alanı artık ayrı bir arkadaş edinme deneyimi ve grup Plans sistemiyle geliştiriyor. [Bumble](https://bumble.com/bff/join-plans?utm_source=chatgpt.com)

---

# 73. WIZZ'DEN ALINACAK FİKİR: MESSAGE-FIRST

Wizz klasik like-first yerine sohbet başlatmayı daha merkezi hale getiriyor.

Profili görüyorsun.

Direkt request gönderiyorsun.

Karşı taraf Request inbox'ından kabul/cevap veriyor. [Wizz App](https://wizzapp.com/how-it-works?utm_source=chatgpt.com)

Senin uygulamada ayrı bir mod olabilir:

**Swipe modu**

ve

**Mesajla Tanış**

Bu ikinci model özellikle friendship için iyi.

---

# 74. YUBO'DAN ALINACAK FİKİR

Yubo:

Swipe

Live

Tags

Friend system

üzerinden sosyal discovery yapıyor. [Yubo Destek](https://support.yubo.live/hc/en-us/articles/115003767811-How-to-add-a-friend?utm_source=chatgpt.com)

Dating dışında arkadaş bulma tarafına geçersen ilgi tag'leri önemli hale gelir.

Örneğin:

# Gaming

sekmesine bas.

Gaming tag'li insanları gör.

---

# 75. WEEKLY CHALLENGE

Wizz 2026'da tüm topluluğa aynı sorunun verildiği Weekly Challenges özelliğini kullanıyor. [Wizz App](https://wizzapp.com/news/blog/1-hour.-1-day.-thousands-of-voices-how-wizz-weekly-challenges-turn-vibes-into-community?utm_source=chatgpt.com)

Sen:

# Haftanın Sorusu

> İlk buluşmada kahve mi yemek mi?

Herkes cevaplar.

Cevapları görür.

Cevaptan profile gider.

Mesaj gönderir.

Bu community + dating'i çok güzel bağlar.

---

# 76. PHOTO / PROFILE REACTIONS

Swipe yerine:

Fotoğraf ❤️

Prompt 😂

Interest 👋

Voice prompt 🔥

şeklinde reaction.

Bu kullanıcıya neden beğenildiğini gösterir.

Ayrıca:

> Ahmet senin seyahat fotoğrafını beğendi.

bildirimi sıradan:

> Ahmet seni beğendi.

bildiriminden daha konuşulabilir.

---

# 77. PROFILE BADGES

Güven ve statü.

✓ Verified

🔥 Active

🆕 New

💯 Complete Profile

🌟 Premium

🎂 Birthday

🏆 Community contributor

🌍 Traveler

Ama Premium rozetini çok gösterişli yapmak dating deneyimini iki sınıfa ayırabilir.

---

# 78. MATCH EXPIRES

Bumble bazı bağlantılarda zaman sınırlı conversation mechanics kullanıyor.

Sen istersen:

24 saat içinde ilk mesaj.

48 saat içinde cevap.

Ama bu bazı kullanıcıları gereksiz strese sokabilir.

Alternatif:

Match silinmez ama:

> “Ayşe ile henüz konuşmadın.”

hatırlatması.

Daha kullanıcı dostu.

---

# 79. GHOSTING AZALTMA

İleride:

Conversation health.

Örneğin:

7 gündür cevap yok.

> Sohbeti kapatmak ister misin?

veya

> Hâlâ ilgileniyor musun?

Böylece inbox mezarlığa dönüşmez.

---

# 80. ARCHIVE

Chat:

Active

Archived

Match Requests

Groups

şeklinde ayrılabilir.

Jaumo özel grupları Inbox içinde normal konuşma gibi yönetiyor. [Jaumo](https://www.jaumo.com/en/help/59b0b122-52e6-42b6-b901-a9e5eb725a23/creating-and-managing-private-groups?utm_source=chatgpt.com)

---

# 81. FAVORİLER

Profili:

⭐ Kaydet

Sonra:

Favorilerim.

Dating app'te swipe kararını anında vermek istemeyen kullanıcı için iyi.

---

# 82. NOTES

Kullanıcı bir profil hakkında özel not tutabilir.

Sadece kendisi görür.

Örneğin:

> “Müzik konuşmuştuk.”

Daha çok ağır kullanıcı özelliği.

---

# 83. SEARCH

Dating uygulamalarının çoğunda doğrudan isim arama yok.

Badoo örneğin kullanıcı adı/telefon ile aktif profil aramasını desteklemediğini söylüyor. [support.badoo.com](https://support.badoo.com/hc/en-us/articles/32089144062493-Using-the-Encounters-Tab?utm_source=chatgpt.com)

Bu privacy açısından mantıklı.

Sen de:

**Kullanıcı arama**

yerine filtre + discovery kullan.

Ancak kullanıcıların birbirini uygulamaya davet etmesi için:

**Profil kodu**

veya

**QR**

kullanılabilir.

---

# 84. PRIVATE SHARE LINK

Kullanıcı:

> Profilimi paylaş.

Link:

`app.com/u/abc123`

Arkadaşına gönderir.

İstersen uygulama dışından profil tamamen görünmez; önce uygulama indir/kayıt ol ister.

---

# 85. REFERRAL

> Arkadaşını getir.

Arkadaş kayıt olur ve profile tamamlar:

Sen +100 coin.

O +100 coin.

Viral büyüme.

Ama abuse önlemek için:

telefon doğrulama

device fingerprint

payment fraud kontrolleri

gereklidir.

---

# 86. RECOMMENDATION ENGINE İÇİN DATA

Zamanla algoritma şu sinyalleri öğrenebilir:

Kimlere bakıyor?

Kimleri beğeniyor?

Hangi profilde ne kadar kalıyor?

Hangi yaş aralığı?

Hangi distance?

Hangi interests?

Kim ona like atıyor?

Kimle match oluyor?

Kimle konuşuyor?

Kaç mesaj?

Conversation devam ediyor mu?

Block/report oluyor mu?

Ama hassas veri ve privacy tarafı çok dikkatli tasarlanmalı.

---

# 87. DISCOVERY SKORLAMASI

Basit örnek:

`candidateScore =`

%25 tercih uyumu

%20 mutual attraction probability

%15 activity

%15 location

%10 shared interests

%10 profile quality

%5 randomness.

Randomness önemlidir.

Yoksa aynı tip insanları sonsuza kadar göstermeye başlarsın.

---

# 88. COLD START

Yeni kullanıcı hakkında data yok.

Çözüm:

Yaş

cinsiyet

distance

relationship goal

interests

profile questions.

İlk 20–50 swipe'tan sonra personalization başlar.

---

# 89. PROFILE QUALITY

Algoritmada:

Fotoğraf sayısı.

Bio.

Verification.

Prompt.

Interests.

Activity.

Report history.

Spam score.

gibi sinyaller olabilir.

Ama sırf çok güzel fotoğraf alan kişiyi yukarı çıkaran sistem oluşturmak istemezsin.

---

# 90. ANTI-SPAM

Dating uygulamasında mutlaka.

Kullanıcı 3 saniyede 100 like?

Risk.

Aynı mesajı 50 kişiye gönderiyor?

Risk.

Telegram/WhatsApp linkini herkese atıyor?

Risk.

Kripto konuşması?

Risk.

Para istiyor?

Risk.

Çok sayıda block/report?

Risk.

Bunların hepsi Trust Score'a girebilir.

---

# 91. TRUST SCORE

Kullanıcıya göstermene gerek yok.

Backend'de:

Verification

Account age

Device integrity

Spam score

Report rate

Block rate

Message behavior

Photo moderation

Login anomalies.

Buna göre:

Discovery reach

message limits

manual review

belirlenebilir.

---

# 92. MODERATION PIPELINE

Fotoğraf upload:

Upload

→ NSFW detection

→ face detection

→ duplicate/scam check

→ banned content

→ yayınla.

Bio:

Text toxicity

Spam

contact information

scam keywords.

Chat:

Normalde private.

Ama risk işareti veya report durumunda moderation workflow.

---

# 93. AGE SEGMENTATION

Özellikle friendship/social discovery yaparsan çok kritik.

Wizz kullanıcıları yaş gruplarına ayırıyor ve kendi yaş çevrelerindeki insanlarla bağlantı kurduruyor. [Wizz App](https://wizzapp.com/safety-hub?utm_source=chatgpt.com)

Dating için en temiz yaklaşım:

**18+ only.**

18 altını hiç kabul etmemek.

Bu ürün ve moderasyon açısından hayatı çok kolaylaştırır.

---

# 94. LOCATION PRIVACY

Kesin GPS göstermemelisin.

Yanlış:

> Ayşe 162 metre ileride.

Daha güvenli:

> 2 km uzakta.

veya:

> Yakınında.

Grindr relative distance kullanıyor ve exact konum yerine yaklaşık uzaklık mantığında çalışıyor. [Grindr Yardım Merkezi](https://help.grindr.com/hc/en-us/articles/1500012478721-What-is-Grindr?utm_source=chatgpt.com)

happn da haritanın gerçek zamanlı kesin konumu göstermediğini özellikle belirtiyor. [Happn Destek Merkezi](https://support.happn.fr/hc/en-us/articles/15703705375517-I-do-not-want-to-appear-on-other-users-happn-Maps-What-Can-I-do?utm_source=chatgpt.com)

---

# 95. PROFİL GÖRÜNÜRLÜĞÜ

Ayar:

Herkese açık.

Sadece beğendiklerim.

Sadece verified users.

Discovery'den gizle.

Hesabı dondur.

Badoo Premium kullanıcıları profili mevcut match'ler dışındakilerden gizleyebiliyor ve Snooze kullanabiliyor. [support.badoo.com](https://support.badoo.com/hc/tr/articles/32090645184925-Badoo-nun-%C3%BCcretli-%C3%B6zelliklerini-anlamak?utm_source=chatgpt.com)

---

# 96. PAUSE DATING

Kullanıcı ilişki buldu.

Uygulamayı tamamen silmesine gerek yok.

**Dating'i duraklat**

Mevcut chat'ler durur/görünür.

Discovery'den çıkar.

Daha sonra geri açar.

Retention açısından account delete'ten daha iyi.

---

# 97. COUPLES / NON-MONOGAMY

Feeld burada en gelişmişlerden biri.

2026'da Constellations ile kullanıcı bir profile **5'e kadar partner profili bağlayabiliyor**; herkes ayrı hesabını ve private activity'sini koruyor. Ayrıca grup sohbeti yapılabiliyor. [Feeld](https://feeld.co/ask-feeld/how-to/how-do-paired-accounts-work-on-feeld?utm_source=chatgpt.com)

Feeld ayrıca 20+ cinsiyet/cinsel kimlik seçeneği ve Interests/Desires sistemi sunuyor. [Feeld](https://feeld.co/about/faq?utm_source=chatgpt.com)

Bu senin hedef kitlene bağlı.

MVP'de şart değil.

---

# 98. PRIVATE DESIRES / INTENT

Feeld'in güzel özelliği:

Interest ve Desire ayrımı.

Interest:

Müzik.

Oyun.

Seyahat.

Desire:

İlişki biçimi / nasıl bir bağlantı aradığı.

30+ desire seçeneği ve ortak desire gösterimi bulunuyor. [Feeld](https://feeld.co/ask-feeld/how-to/how-to-create-a-feeld-profile?utm_source=chatgpt.com)

Sen daha genel versiyon kullanabilirsin:

**İlgiler**

ve

**Aradıkların**

ayrı olsun.

---

# 99. DATING + SOCIAL ÜRÜNÜNÜN EN İYİ ALT MENÜSÜ

Uzun vadede ben şu yapıya geçerdim:

| Tab          | İçerik                |
| ------------ | --------------------- |
| 💕 Keşfet    | Dating discovery      |
| 🌎 Topluluk  | Feed/community/events |
| ❤️ Beğeniler | Likes/matches         |
| 💬 Sohbet    | DM/groups             |
| 👤 Profil    | Profile/settings      |

Bu aşamada uygulaman Tinder'dan farklılaşmaya başlar.

---

# 100. TAM ÜRÜN YOL HARİTASI

Bunu nihayet tek tabloda toparlayayım.

| Aşama   | Yapılacak                                                |
| ------- | -------------------------------------------------------- |
| **MVP** | Auth, profil, fotoğraf, bio, interest, relationship goal |
| **MVP** | Age/gender/distance filters                              |
| **MVP** | Swipe/discovery                                          |
| **MVP** | Like/pass                                                |
| **MVP** | Match                                                    |
| **MVP** | Text chat                                                |
| **MVP** | Photo chat                                               |
| **MVP** | Push                                                     |
| **MVP** | Block/report/unmatch                                     |
| **MVP** | Selfie verification                                      |
| **MVP** | Moderation/admin                                         |
| **MVP** | Analytics                                                |
| **V1**  | Who liked me                                             |
| **V1**  | Premium                                                  |
| **V1**  | Unlimited likes                                          |
| **V1**  | Rewind                                                   |
| **V1**  | Advanced filters                                         |
| **V1**  | Super Like                                               |
| **V1**  | Boost                                                    |
| **V1**  | Coins                                                    |
| **V1**  | Pre-match message                                        |
| **V1**  | Read receipts                                            |
| **V1**  | Incognito                                                |
| **V1**  | Travel                                                   |
| **V1**  | Profile Score                                            |
| **V1**  | Daily reward                                             |
| **V1**  | Voice messages                                           |
| **V2**  | Compatibility questions                                  |
| **V2**  | Compatibility score                                      |
| **V2**  | Daily best match                                         |
| **V2**  | Selected daily profiles                                  |
| **V2**  | Grid discovery                                           |
| **V2**  | Nearby / crossed paths                                   |
| **V2**  | Voice call                                               |
| **V2**  | Video call                                               |
| **V2**  | AI conversation starter                                  |
| **V2**  | AI profile coach                                         |
| **V2**  | Private album                                            |
| **V2**  | Expiring photo                                           |
| **V2**  | Screenshot protection                                    |
| **V2**  | Safety date sharing                                      |
| **V3**  | Communities                                              |
| **V3**  | Community chats                                          |
| **V3**  | Social feed                                              |
| **V3**  | Group chats                                              |
| **V3**  | Events                                                   |
| **V3**  | Friendship mode                                          |
| **V3**  | Weekly questions/challenges                              |
| **V3**  | Stories                                                  |
| **V3**  | Virtual gifts                                            |
| **V3**  | Avatar/cosmetics                                         |
| **V3**  | Double Date                                              |
| **V3**  | Voice matchmaking                                        |
| **V3**  | Random video                                             |
| **V3**  | Live translation                                         |
| **V4**  | AI profiles                                              |
| **V4**  | Advanced recommendations                                 |
| **V4**  | Behavioral matching                                      |
| **V4**  | Automatic anti-scam                                      |
| **V4**  | Live/community moderation                                |
| **V4**  | Creator/live economy                                     |