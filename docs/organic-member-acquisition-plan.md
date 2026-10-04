# Lovask Organik Üye Kazanım Planı

**Sürüm:** 1.2 — Instagram başlangıç sistemi işlendi  
**Tarih:** 2026-08-16  
**Son durum güncellemesi:** 2026-08-17  
**Ana hedef:** Çok düşük bütçeyle, spam yapmadan ve güveni zedelemeden ilk yoğun Lovask topluluğunu kurmak.  
**İlk çalışma varsayımı:** İstanbul, 18+ kullanıcılar, ciddi veya anlamlı ilişki niyeti, başvuru/davet modeli. Şehir veya hedef kitle değişirse plan aynı yapıyla yeniden daraltılmalıdır.

---

## 0. Güncel ilerleme durumu

**Özet:** Teknik büyüme ve üyelik altyapısı tamamlandı, migration uygulandı, sistem canlıya alındı ve gerçek başvuru ile uçtan uca test edildi. Organik erişim için ilk kampanya kodu ve ilk 10 topluluk hedefi hazırlandı. Henüz gerçek DM, içerik yayını, topluluk anlaşması veya elçi aktivasyonu başlamadı.

Tek bir genel yüzde yanıltıcı olacağı için ilerleme üç ayrı eksende tutulur:

- **Teknik altyapı:** %100
- **Pazarlama/erişim hazırlığı:** yaklaşık %35
- **Gerçek erişim ve 30 günlük büyüme operasyonu:** %0 — test hesabı organik kazanım sayılmaz
- **Ana sonuç:** 200 gerçek ve aktif profil hedefi henüz başlamadı

### Aşama durumu

| Aşama | Durum | Açıklama |
|---|---|---|
| Kampanya teklifi | Tamamlandı | İstanbul, ilk 200 Kurucu Üye, profil tamamlayana 30 gün Noir |
| Başvuru ve davet altyapısı | Tamamlandı | Turnstile, kurul onayı, e-posta, 24 saatlik güvenli hesap açma ve şifre belirleme |
| Kurucu üye aktivasyonu | Tamamlandı | Onboarding sonunda Kurucu Üye kaydı, sıra numarası ve Noir hakkı |
| Kişisel referans sistemi | Tamamlandı | Üyeye özel `LVK-...` bağlantısı; başarılı aktivasyonda iki tarafa 7 gün Noir |
| Açık/kontrollü üyelik modu | Tamamlandı | Kontrollü modda Kurucu Üyelik; açık modda standart kayıt ve normal ana sayfa CTA'sı |
| Yönetim ve ölçüm | Tamamlandı | Başvuru yönetimi, büyüme hunisi, UTM, kodlar, aktivasyon ve ödül takibi |
| Hukuki ve güvenlik yüzeyi | Teknik olarak tamamlandı | 18+, gizlilik, koşullar, topluluk ilkeleri, ayrı pazarlama izni ve rate limit canlı |
| İlk kampanya kodu | Tamamlandı | `KURUCU50` aktif ve 50 tamamlanmış aktivasyonla sınırlı |
| Hedef kitle araştırması | Başladı | İlk 10 topluluk/yönetici ve kişisel mesajları hazır; hedef 30 kaynak |
| Sıcak aday ve elçi listesi | Başlamadı | 50 sıcak aday ve 20 Kurucu Elçi henüz belirlenmedi |
| Instagram hesap hazırlığı | Kısmen hazır | Biyografi, üç sabit gönderi ve profil akışı `docs/instagram-organik-buyume-ve-icerik-plani.md` içinde hazır; hesaba henüz uygulanmadı |
| Organik erişim operasyonu | Başlamadı | Henüz DM gönderilmedi, görüşme veya topluluk anlaşması yapılmadı |
| İçerik üretimi | Kısmen hazır | 30 günlük takvim ve ilk 7 günün üretim paketi hazır; 5 Reels ve 2 carousel henüz üretilmedi/yayımlanmadı |
| Botlarla ilgili karar | Ertelendi | 2026-08-17 kullanıcı kararıyla mevcut hâli şimdilik korunacak; bugünkü Instagram operasyonuna dahil edilmeyecek ve AI/bot profiller içerikte gerçek kullanıcı kanıtı olarak kullanılmayacak |

### Tamamlanan teknik teslimler

- [x] `039_organic_growth_foundation.sql` migration'ı uygulandı.
- [x] `/kurucu-uye` kampanya sayfası ve canlı kontenjan altyapısı yayınlandı.
- [x] Başvuru formu, Turnstile ve spam/rate-limit koruması canlıya alındı.
- [x] Admin başvuru inceleme, kabul ve yeniden davet akışı çalışıyor.
- [x] Kabul e-postasına doğrudan hesap açma bağlantısı eklendi.
- [x] E-posta tarayıcılarının tek kullanımlık bağlantıyı tüketmesini önleyen ara onay ekranı eklendi.
- [x] Lovask erişim bağlantısı 24 saat geçerli olacak şekilde kuruldu.
- [x] Şifre belirleme, profil tamamlama ve onboarding yönlendirmesi doğrulandı.
- [x] Giriş ekranına ve geçersiz bağlantı ekranına görünür “Yeni bağlantı gönder” alanı eklendi.
- [x] Kurucu üyeye her yeni uygulama/site oturumunda kişisel davet özelliğini hatırlatan modal eklendi.
- [x] Kurucu Üye için 30 gün Noir ve kişisel referansta iki tarafa 7 gün Noir otomasyonu kuruldu.
- [x] Admin büyüme paneli, kaynak hunisi, kod ve ödül ölçümü canlıya alındı.
- [x] Ana sayfa ve giriş/kayıt deneyimi açık/kontrollü admin anahtarına bağlandı.
- [x] Gerçek başvuru → onay → e-posta → şifre → onboarding akışı canlıda sorunsuz test edildi.
- [x] `KURUCU50` kampanya kodu oluşturuldu.
- [x] İlk 10 kamuya açık topluluk/yönetici araştırıldı ve özel mesaj taslakları hazırlandı: `docs/organic-outreach-targets-2026-08-16.md`.
- [x] TypeScript, ESLint ve production build kontrolleri geçti.

### Kısmen hazır olanlar

- Davet kodu standardı ve ölçüm altyapısı hazır; topluluk ve elçilere özel kodlar anlaşma geldikçe üretilecek.
- Takip altyapısı admin panelinde hazır; manuel DM yanıtları için basit operasyon tablosu gerçek gönderim başladığında doldurulacak.
- Instagram biyografisi, sabit gönderiler, ilk 7 günlük üretim paketi, 30 günlük takvim ve günlük 5 DM sistemi `docs/instagram-organik-buyume-ve-icerik-plani.md` içinde hazır; hesaba henüz uygulanmadı.
- Spam olmayan DM kuralları ve kişiselleştirilmiş ilk 10 topluluk mesajı hazır; mesajlar henüz gönderilmedi.

### Devam edeceğimiz kesin nokta

Bir sonraki çalışma `docs/organic-outreach-targets-2026-08-16.md` dosyasındaki ilk dört hedefe manuel ve bağlantısız izin mesajı göndermekle başlayacak:

1. Gamze Küçük / Sayfa Arası Kitap Kulübü
2. The Social Edit Istanbul
3. Fatma Atas / Turkish–English Language Exchange Istanbul
4. Betül Akgül / Istanbul Ladies Kitap Kulübü

Olumlu yanıt gelmeden bağlantı veya kampanya kodu gönderilmeyecek. İş birliği kabul edilirse her topluluğa ayrı takip kodu açılacak.

---

## 1. Planın kısa özeti

Lovask başlangıçta Türkiye'nin tamamına yayılmaya çalışmayacak. İlk olarak tek şehirde yeterli sayıda gerçek ve aktif profil oluşturacak. Büyüme beş motorla sağlanacak:

1. Kurucu Üye teklifi
2. Kurucu Elçi programı
3. İzinli ve düşük hacimli Instagram DM operasyonu
4. Her gün yayımlanan kısa video ve Story içerikleri
5. Yerel topluluklar, küçük içerik üreticileri ve üye davetleri

İlk 30 günlük hedef:

- 200 tamamlanmış gerçek profil
- En az 100–120 haftalık aktif üye
- En az 20 aktif Kurucu Elçi
- Yeni üyelerin en az %25'inin davet veya topluluk koduyla gelmesi
- Yeni üyenin ilk 72 saatte anlamlı bir gerçek etkileşim yaşaması

Buradaki “üye”, yalnızca e-posta bırakan kişi değildir. Ana büyüme birimi şudur:

> Başvurusu kabul edilmiş, profilini tamamlamış ve ilk 72 saatte gerçek bir kullanıcıyla beğeni, eşleşme veya mesaj etkileşimi yaşamış kişi.

---

## 2. Değişmez ilkeler

### 2.1. Önce yoğunluk, sonra yayılma

Her şehirde birkaç profil olması ürünün çalıştığı anlamına gelmez. İlk şehirde eşleşme havuzu yeterince yoğunlaşmadan ikinci şehir açılmamalıdır.

Önerilen sıra:

1. İstanbul
2. Ankara veya İzmir
3. Birinci şehirdeki veriye göre üçüncü şehir

Yeni şehir açma koşulları:

- İlk şehirde en az 150 haftalık aktif gerçek profil
- Yeni kullanıcının ilk gerçek etkileşime ulaşma süresinin medyanı 72 saatin altında
- Tercih havuzlarında ağır bir dengesizlik olmaması
- Davet ve içerikten düzenli organik başvuru gelmesi

### 2.2. Güven büyümeden önce gelir

Lovask'ta bot veya sentetik profiller bulunuyorsa bunlar gerçek insan gibi sunulmamalıdır. Rekrutman başlamadan önce iki yoldan biri uygulanmalıdır:

- Botlar gerçek kullanıcı keşfinden tamamen kaldırılır, veya
- Profil kartı ve sohbet ekranında açık, sürekli ve kolay anlaşılır “AI profil” etiketi gösterilir.

Gizli botlar kısa vadede uygulamayı dolu gösterebilir; uzun vadede güveni, tavsiyeyi ve kullanıcı tutmayı bozar. Organik büyümenin yakıtı ağızdan ağıza tavsiye olduğu için bu konu pazarlama öncesi kapıdır.

### 2.3. Spam büyüme değildir

Kısa sürede çok sayıda aynı mesajı göndermek hedef değildir. Hedef, doğru kişilere kişisel ve izin isteyen bir ilk temas kurmaktır. Bir kişi cevap vermiyorsa ısrar edilmez.

### 2.4. Takipçi değil aktif üye ölçülür

İçerik erişimi, beğeni ve takipçi yalnızca ara göstergedir. Asıl sonuç tamamlanmış ve aktif profildir.

---

## 3. Kampanya teklifi

### Kampanya adı

**Lovask İstanbul Kurucu Üyeliği**

### Ana vaat

> İstanbul'da ciddi ve anlamlı bir bağ arayan ilk 200 kişi başvuruyla kabul edilecek. Kabul edilen Kurucu Üyeler 30 gün ücretsiz Noir kullanacak.

### Kimlik cümlesi

> Daha çok profil değil; niyetini açıkça söyleyen doğru insanlar.

### Birincil CTA

> “DAVET” yaz veya Kurucu Üye başvurunu gönder.

### Kurallar

- Yalnızca 18+
- İlk aşamada İstanbul
- Başvuru ve profil incelemesi
- Profil tamamlama zorunluluğu
- Kontenjanın gerçek olması; sahte kıtlık kullanılmaması
- Kurucu Üye ödülünün kabul sonrası açılması
- Kullanıcı fotoğrafı veya yorumu yalnızca açık izinle paylaşılması

### Başlangıç teklifi

- Kabul edilen ilk 200 kişiye 30 gün Noir
- “Kurucu Üye” rozeti
- Ürün geri bildiriminde öncelik
- Bir aktif arkadaş davetinde iki tarafa 7 gün ek Noir

Ödül, davet edilen kişi yalnızca kayıt olduğunda değil, profilini tamamlayıp aktive olduğunda açılmalıdır.

---

## 4. Üye kazanım hunisi

Her kanal aynı hunide izlenmelidir:

```text
İçerik / DM / Elçi / Topluluk
            ↓
       Başvuru sayfası
            ↓
      Başvurunun kabulü
            ↓
      Profilin tamamlanması
            ↓
  İlk 72 saatte gerçek etkileşim
            ↓
          7. gün aktifliği
            ↓
      Bir arkadaşını davet etme
```

Her başvuruda aşağıdaki kaynak bilgileri tutulmalıdır:

- Kaynak kanalı
- Davet veya topluluk kodu
- İlk temas tarihi
- Başvuru tarihi
- Kabul durumu
- Profil tamamlama durumu
- Aktivasyon durumu
- 7. gün aktiflik durumu
- Davet ettiği aktif üye sayısı

Başlangıçta basit bir elektronik tablo yeterlidir. Kişisel veri yalnızca gerekli olduğu kadar tutulmalı ve erişim sınırlandırılmalıdır.

---

## 5. İlk 30 günün çalışma planı

## Gün 1–3: Temel hazırlık

### Ürün ve güven kontrolü

- [ ] Botlar kapatıldı veya açıkça AI olarak etiketlendi. — **2026-08-17 kullanıcı kararıyla ertelendi; bugünkü Instagram işlerine dahil değil.**
- [ ] Gerçek kullanıcıya ait sahte izlenim yaratacak demo verileri canlı deneyimden ayrıldı. — **Bot kararıyla birlikte ertelendi; içeriklerde gerçek kullanıcı kanıtı olarak kullanılmayacak.**
- [x] Başvuru sayfasında 18+ koşulu görünür.
- [x] Gizlilik/aydınlatma bağlantısı görünür.
- [x] Pazarlama izni zorunlu üyelik koşulu yapılmadı.
- [x] Ana CTA kontrollü modda Kurucu Üye teklifine bağlandı; açık modda standart kayda dönüşüyor.

### Operasyon hazırlığı

- [x] `KURUCU200`, `KURUCU50` ve kişi bazlı `LVK-...` davet kodu standardı hazırlandı.
- [x] Üye/kampanya takibi admin büyüme panelinde oluşturuldu.
- [ ] 20 Kurucu Elçi adayı listelendi.
- [ ] 50 sıcak aday listelendi.
- [ ] 30 topluluk ve küçük içerik üreticisi listelendi. — **10 hedef tamamlandı; 20 hedef kaldı.**
- [x] Instagram profil metni ve sabitlenmiş üç içeriğin üretim metinleri hazırlandı; hesaba uygulama ve görsel/video üretimi bekliyor.

### Instagram profil metni

> İstanbul'da niyetini açıkça söyleyenlerin eşleşme topluluğu.  
> İlk 200 Kurucu Üye için başvurular açık. 18+  
> “DAVET” yaz veya başvur 👇

### Sabitlenecek üç gönderi

1. Lovask nedir ve kimler içindir?
2. Kurucu Üyelik nedir?
3. Güvenlik, moderasyon ve ilişki niyeti nasıl çalışır?

## Gün 4–7: Kontrollü başlangıç

Günlük çalışma:

- Toplam 5 kişiye kişisel DM; sıcak kişiler, topluluk/üretici mesajları ve takipler aynı günlük kotaya dahil
- 1 ana içerik; ilk hafta toplam 5 Reels ve 2 carousel
- 3–5 Story
- Hedef hesaplarda 5 gerçek ve konuya katkı sağlayan yorum
- Gelen tüm gerçek yorum ve mesajlara aynı gün yanıt
- Yeni kabul edilen her üyeye kişisel karşılama

Birinci hafta hedefi yeni hesabın baseline dönemidir:

- 35 kişiselleştirilmiş DM; takip mesajları bu sayıya dahil
- 7 ana içerik: 5 Reels ve 2 carousel
- En az 21 Story ve 35 nitelikli hedef hesap yorumu
- Üç sabit gönderinin profilde tamamlanması
- İlk nitelikli konuşma, DAVET mesajı, başvuru ve profil tamamlama sayılarını ölçmek
- 50 başvuru ve 30 tamamlanmış profil birinci hafta tahmini değildir; ancak topluluk ve sıcak çevre dağıtımı beklenenden güçlü çalışırsa erişilebilecek esnek büyüme hedefidir

## Hafta 2: Elçi ve topluluk dağıtımı

- 20 kişilik Kurucu Elçi grubunu tamamla.
- Her elçiye kişisel kod ve basit paylaşım paketi ver.
- Beş yerel toplulukla özel kontenjan görüşmesi yap.
- En iyi iki içerik formatını yeni örneklerle tekrarla.
- İlk kullanıcı görüşmelerini yap ve itirazları kaydet.

İkinci hafta sonu hedefi:

- 100 tamamlanmış profil
- 10 aktif elçi
- En az 3 çalışan topluluk kodu
- Başvurudan profil tamamlamaya en az %50 dönüşüm

## Hafta 3: Davet döngüsünü açma

- Aktif üyelere “bir arkadaşını getir” çağrısı gönder.
- Onaylanıp aktive olan arkadaş için iki tarafa 7 gün Noir ver.
- En fazla kaliteli üye getiren elçileri izinleriyle öne çıkar.
- Küçük bir çevrim içi sohbet veya düşük maliyetli fiziksel buluşma düzenle.
- Etkinliğe özel QR/davet kodu kullan.

Üçüncü hafta sonu hedefi:

- 150 tamamlanmış profil
- Yeni üyelerin %20–25'inin davetle gelmesi
- İlk gerçek etkileşime ulaşma medyanının 72 saatin altında olması

## Hafta 4: Kazananları büyütme

- En iyi iki içerik serisine üretim zamanının %60'ını ayır.
- En iyi iki topluluk/elçi kaynağına operasyon zamanının %20'sini ayır.
- Sonuç getirmeyen kanalları durdur.
- Kurucu Üye kontenjanının gerçek doluluk durumunu paylaş.
- Aktivasyonu düşük segmentlerde yeni üye alımını geçici olarak yavaşlat.

Ay sonu hedefi:

- 200 tamamlanmış gerçek profil
- 100–120 haftalık aktif üye
- En az %25 davet/topluluk kaynaklı kazanım
- En az %30 yeni üye 7. gün aktifliği

---

## 6. Instagram DM operasyonu

## 6.1. Instagram'ın resmî yaklaşımı

Instagram herkese uygulanan sabit bir “günde en fazla X DM” sayısı yayımlamamaktadır. Uygulanan kısıtlar hesap geçmişi, davranış biçimi, alıcı tepkileri ve diğer güven sinyallerine göre değişebilir. Bu nedenle internetteki “günde 50/100 DM kesin güvenlidir” türü rakamlar platform garantisi değildir.

Instagram'ın resmî Topluluk Kuralları şunları spam davranışı olarak ele alır:

- Tekrarlanan içerik veya yorumlar
- Yapay etkileşim toplama
- İnsanlarla ticari amaçla, rızaları olmadan tekrar tekrar iletişim kurma

Instagram Kullanım Koşulları ve Meta'nın otomatik veri toplama koşulları, açık izin olmadan otomatik erişim/veri toplama ve yetkisiz araç kullanımını yasaklar.

Bu nedenle Lovask'ın DM politikası platformun muhtemel teknik sınırından daha sıkı olacaktır.

## 6.2. Temas önceliği

DM adayları şu sırayla ele alınır:

### A. İzinli/inbound temas — en güvenli

- Gönderiye “DAVET” yazan kişi
- Story anketine veya soru kutusuna cevap veren kişi
- Lovask hakkında soru soran kişi
- Bir topluluk yöneticisinin duyurusundan sonra bilgi isteyen kişi
- Mevcut üyenin, arkadaşına Lovask'ın iletişim kurabileceğini açıkça sorduğu ve arkadaşın kabul ettiği durum

Bu kişilere cevap vermek soğuk satış değildir; yine de konuşma kişisel ve amaca uygun tutulmalıdır.

### B. Sıcak temas

- Kurucunun veya elçinin gerçekten tanıdığı kişi
- Daha önce Lovask içeriğiyle anlamlı biçimde etkileşmiş kişi
- Ürünün çözmeye çalıştığı sorun hakkında açık paylaşım yapmış kişi

İlk mesajda ilişki kurulma nedeni açıkça belirtilir.

### C. Soğuk temas — son seçenek

- Hiç ilişki veya izin sinyali bulunmayan kişi

Soğuk temas yalnızca sınırlı, elle seçilmiş ve yüksek uygunluk gösteren hesaplarda kullanılır. Toplu liste satın alınmaz; profiller otomatik toplanmaz.

## 6.3. Lovask iç operasyon limitleri

Aşağıdaki sayılar Instagram'ın resmî limitleri değildir. Lovask'ın spam riskini ve kullanıcı rahatsızlığını azaltmak için koyduğu daha muhafazakâr iç sınırlardır.

| Dönem | Yeni sıcak temas | Yeni soğuk temas | Açıklama |
|---|---:|---:|---|
| Gün 1–3 | 0–5/gün | 0 | Profil ve içerik güveni oluşturulur; inbound cevaplanır. |
| Gün 4–7 | 5–8/gün | En fazla 3/gün | Her mesaj elle ve kişiye özel yazılır. |
| Hafta 2 | 8–12/gün | En fazla 5/gün | Yalnızca uyarı yoksa ve cevap kalitesi sağlıklıysa. |
| Hafta 3+ | 10–15/gün | En fazla 5/gün | Toplam yeni temas tercihen 15'i geçmez. Inbound ayrı yönetilir. |

Ek kurallar:

- Yeni temaslar gün içine 2–3 gerçek çalışma oturumuna yayılır.
- Arka arkaya aynı metin gönderilmez.
- Aynı kişiye en fazla bir ilk mesaj ve bir takip mesajı gönderilir.
- Takip mesajı 4–7 gün sonra gönderilir.
- İkinci mesajdan sonra cevap yoksa iletişim tamamen durur.
- “İlgilenmiyorum”, “yazmayın” veya benzeri bir cevap anında kalıcı ret olarak işaretlenir.
- İlk soğuk mesajda link gönderilmez; önce izin istenir.
- Kişinin medeni durumu, yalnızlığı, cinsel yönelimi veya özel hayatı hakkında varsayım yapılmaz.
- Profilde 18 yaş altı olabileceğine dair bir işaret varsa temas kurulmaz.
- Toplu grup DM'si açılmaz.
- Gece geç saatlerde mesaj gönderilmez.

## 6.4. Mesajın kişisel olması için minimum standart

Her ilk mesajda en az iki gerçek kişiselleştirme unsuru bulunmalıdır:

1. Neden o kişiye ulaşıldığı
2. Lovask ile gerçek bağlantısı

Kötü örnek:

> Selam, yeni flört uygulamamıza katılmak ister misin? Link burada.

İyi örnek:

> Selam Ece, İstanbul'daki kitap ve etkinlik paylaşımlarını gördüm. Biz de kalabalık profil havuzundan çok, niyetini açıkça söyleyen insanlara odaklanan küçük bir eşleşme topluluğu kuruyoruz. Uygun gelirse Kurucu Üyelik hakkında kısa bilgi gönderebilir miyim?

Mesajın ilk amacı kayıt almak değil, bilgi göndermek için izin almaktır.

## 6.5. DM şablonları

### Sıcak kişi

> Selam [isim], İstanbul'da ciddi ve anlamlı ilişki arayanlar için başvuruyla üye alan Lovask topluluğunu açıyoruz. Seni uygun bulduğum için ilk Kurucu Üyeler arasına davet etmek istedim. İstersen detayları göndereyim.

### İçerikle etkileşen kişi

> Selam [isim], [konu] hakkındaki yorumunu gördüm; bizim Lovask'ta çözmeye çalıştığımız mesele de tam olarak bu. İstanbul'daki ilk Kurucu Üyeleri seçiyoruz. İstersen nasıl çalıştığını kısaca anlatayım.

### Topluluk yöneticisi

> Selam [isim], [topluluk adı] içinde kurduğunuz ortamı bir süredir takip ediyorum. İstanbul'da niyet açıklığı ve güvenliğe odaklanan başvurulu bir eşleşme topluluğu kuruyoruz. Grubunuza özel 20 kişilik Kurucu Üye kontenjanı ve özel kod açmayı önermek istiyorum. Uygunsa iki dakikalık özeti gönderebilir miyim?

### Küçük içerik üreticisi

> Selam [isim], [belirli video/paylaşım] içindeki [özgün nokta] Lovask'ın yaklaşımıyla çok örtüşüyor. Ücretli reklam yerine İstanbul'da gerçek bir kurucu topluluk oluşturuyoruz. Sana satış metni okutmak istemiyoruz; fikrini ve uygun görürsen topluluğuna özel davet kodunu konuşmak isteriz. Detayları göndermem uygun olur mu?

### Birinci ve tek takip mesajı

> Selam [isim], mesajım arada kaynamış olabilir diye bir kez hatırlatmak istedim. Uygun değilse sorun değil; tekrar yazmayacağım. Kurucu Üyelik özetini istersen buradayım.

### Olumsuz yanıta cevap

> Anladım, teşekkür ederim. Tekrar iletişim kurmayacağız. Güzel bir gün dilerim.

## 6.6. DM kalite ve durdurma kuralları

Haftalık olarak şu oranlar izlenir:

- Yanıt oranı
- Olumlu/izin veren yanıt oranı
- Profile veya başvuruya geçen kişi oranı
- Şikâyet, engelleme veya olumsuz tepki

İç durdurma eşikleri:

- Soğuk DM yanıt oranı iki hafta üst üste %10'un altındaysa soğuk DM durdurulur.
- Mesajların %5'inden fazlası açık rahatsızlık/ret içeriyorsa metin ve hedefleme yeniden değerlendirilir.
- Herhangi bir spam uyarısı, özellik kısıtı veya “çok hızlı işlem yaptın” mesajında yeni outbound tamamen durdurulur.
- Uyarı sonrasında alternatif hesap, VPN, cihaz değiştirme veya yeni hesapla devam etme denenmez.
- Hesap durumu kontrol edilir, platformun gösterdiği süre/itiraz akışı izlenir ve neden çözülmeden outbound yeniden başlamaz.

Bu eşikler platformun ceza eşikleri değil, Lovask'ın daha erken frene basma kurallarıdır.

## 6.7. Kesinlikle yapılmayacaklar

- DM botu, scraper veya otomatik tarayıcı eklentisi kullanmak
- Kullanıcı adı/şifreyi otomasyon hizmetine vermek
- Takipçi, beğeni, yorum veya hesap satın almak
- İnternetten kullanıcı listesi satın almak
- Aynı mesajı yüzlerce kişiye göndermek
- Çoklu hesapla aynı kişileri hedeflemek
- Kısıtı aşmak için VPN, cihaz veya IP rotasyonu yapmak
- İnsanları sahte kişisel hesaplarla yönlendirmek
- Ürünün kurucusu veya Lovask bağlantısını gizlemek
- Link kısaltıcıyla hedefi gizlemek
- Cevap vermeyen kişiye tekrar tekrar yazmak
- Arkadaşının iletişim bilgisini izin almadan Lovask'a aktarmasını istemek

---

## 7. İçerik sistemi

## 7.1. İçerik dağılımı

| İçerik sütunu | Pay | Amaç |
|---|---:|---|
| İlişki soruları ve tartışmalar | %35 | Paylaşım ve yorum |
| Faydalı/güvenli tanışma içeriği | %25 | Güven ve kaydetme |
| Sokak/insan görüşleri | %15 | Doğal erişim |
| Lovask'ı kurma süreci | %15 | Şeffaflık ve bağ |
| Ürün/Kurucu Üye çağrısı | %10 | Başvuru |

Her içerikte ürün satılmamalıdır. Her hafta yalnızca 1–2 güçlü başvuru çağrısı yeterlidir; diğer içerikler yorum ve paylaşım üretmelidir.

## 7.2. Ana içerik serileri

1. **İstanbul'a sorduk:** İlk buluşmada en büyük red flag nedir?
2. **Niyetini tek cümlede söyle:** İnsanların aradığı ilişkiyi açıkça anlatması.
3. **Sağa mı sola mı?:** Anonim ve izinli profil açıklaması değerlendirmeleri.
4. **İlk mesaj mahkemesi:** Anonim ilk mesajlara yapıcı yorum.
5. **Güvenli buluşma:** Mekân, sınır ve güvenlik önerileri.
6. **Lovask Günlüğü:** Kurucu topluluğun nasıl inşa edildiği.
7. **Topluluktan:** İzinli kullanıcı sözü, geri bildirim veya başarı anı.

## 7.3. Kısa video formatı

Önerilen yapı:

```text
0–2 sn: Görsel + sözlü + yazılı kanca
2–10 sn: Sorun veya tartışma
10–25 sn: Görüş / örnek / Lovask yaklaşımı
25–30 sn: Tek CTA
```

Tek videoda tek fikir kullanılmalıdır. Dikey 9:16, anlaşılır ses ve ekranda kısa altyazı olmalıdır.

Örnek:

> “Flört uygulamalarında sorun insan azlığı değil.”  
> “İnsanların ne aradığını söylememesi.”  
> “Lovask'ta ilişki niyeti profilin başında görünüyor.”  
> “İstanbul'daysan ‘DAVET’ yaz.”

## 7.4. İlk 14 video

1. Flört uygulamalarında seni en çok ne yoruyor?
2. İlk buluşmada en büyük red flag nedir?
3. Ciddi ilişki isteyenler neden uygulamalardan sıkıldı?
4. Niyetini profilde açıkça söylemek neden önemli?
5. Bu profil açıklamasına sağa mı kaydırırsın?
6. İlk mesajda yapılmaması gereken üç şey.
7. Kurucu Üyelik nedir?
8. İstanbul'da güvenli ilk buluşma için üç kural.
9. Bir profil fotoğrafı neyi göstermeli?
10. “Selam” yerine kullanılabilecek üç ilk mesaj.
11. Lovask'ta başvuru neden var?
12. İnsanlara sorduk: Ciddi ilişki ne demek?
13. Uygulama yapılırken üyelerden gelen en iyi fikir.
14. İlk Kurucu Üye kontenjanının güncel durumu.

## 7.5. Haftalık yayın takvimi

| Gün | Ana içerik | Story | Dağıtım |
|---|---|---|---|
| Pazartesi | İlişki sorusu Reel | Anket | 10 değerli yorum |
| Salı | Eğitici carousel | Soru kutusu | 3 topluluk teması |
| Çarşamba | Sokak görüşü Reel | Çekim arkası | Yanıtlardan DM |
| Perşembe | Lovask Günlüğü Reel | Kurucu notu | 3 creator teması |
| Cuma | Red flag/green flag Reel | Oylama | Topluluk kodu duyurusu |
| Cumartesi | Profil/ilk mesaj serisi | Kullanıcı soruları | Etkinlik/yerel dağıtım |
| Pazar | Haftanın özeti | Sonuçlar | Veri inceleme ve planlama |

Bir içerik Instagram Reels, TikTok ve YouTube Shorts'ta platforma uygun başlıkla yeniden kullanılabilir. Başka platform filigranı taşımamalıdır.

---

## 8. Kurucu Elçi programı

## 8.1. Elçi profili

- Sosyal çevresinde güvenilen
- Lovask'ın yaklaşımını gerçekten benimseyen
- İstanbul'da uygun çevreye erişebilen
- Spam yapmayacak ve kuralları kabul edecek
- Mümkünse farklı semt, yaş ve ilgi topluluklarını temsil eden

## 8.2. İlk hedef

20 elçi × 10 aktive edilmiş üye = 200 kişilik ilk havuz.

Bu matematik üst sınır değildir; her elçinin 10 kişi getirmesi beklenmemelidir. Bu nedenle 30 adaydan 20 aktif elçi çıkarmak daha gerçekçidir.

## 8.3. Elçiye verilen araçlar

- Kişisel davet kodu
- Bir Story görseli
- Bir kısa açıklama
- Başvuru bağlantısı
- Kimlerin uygun olduğuna dair kısa rehber
- Spam ve izin kuralları
- Haftalık sonuç özeti

## 8.4. Elçi ödülü

- Elçi rozeti
- 30 gün Noir
- Her aktive arkadaş için +7 gün Noir
- Ürün kararlarına erken katılım
- Özel buluşma erişimi

Nakit ödül başlangıçta önerilmez. Nakit, düşük kaliteli ve izinsiz toplu daveti teşvik edebilir.

## 8.5. Elçi kuralları

- Arkadaşın iletişim bilgisi Lovask'a izin olmadan verilmez.
- Elçi, Lovask adına toplu mesaj göndermez.
- Ürünün ücretleri ve kabul koşulları doğru anlatılır.
- Kabul garantisi verilmez.
- Sahte profil veya çoklu hesap oluşturulmaz.
- Ödül yalnızca aktive edilmiş gerçek üyede açılır.

---

## 9. Topluluk ve küçük creator işbirlikleri

## 9.1. Hedef topluluklar

- Kitap kulüpleri
- Koşu ve spor grupları
- Dans ve dil toplulukları
- Coworking toplulukları
- Üniversite mezun ağları
- Girişimcilik ve genç profesyonel toplulukları
- İstanbul etkinlik sayfaları
- Podcast ve küçük YouTube kanalları

## 9.2. Teklif

> Topluluğunuza özel 20 kişilik Lovask Kurucu Üye kontenjanı açalım. Size özel kodla gelen başvurular öncelikli incelensin; kabul edilenler 30 gün Noir kullansın.

İşbirliği topluluğun güvenini sömürmemelidir. Yönetici onayı olmadan grubun içine tanıtım bırakılmaz.

## 9.3. Küçük creator modeli

Öncelik 2 bin–50 bin takipçili, gerçek yorum alan yerel hesaplaradır. İlk aşamada ücret yerine şu değiş tokuşlar kullanılabilir:

- Topluluğuna özel kontenjan
- Kurucu Elçi statüsü
- Ürün geliştirmede söz hakkı
- Ortak soru/araştırma içeriği
- İzinli ortak canlı yayın

Creator'a hazır reklam metni okutmak yerine şu brief verilir:

> “Flört uygulamalarında seni en çok ne yoruyor?” sorusunu kendi görüşünle anlat. Lovask'ın niyet açıklığı ve başvuru yaklaşımını yalnızca gerçekten uygun buluyorsan paylaş. İzleyicilerine özel kodu açıkça belirt.

---

## 10. Düşük maliyetli fiziksel dağıtım

- Partner kafede QR kodlu küçük masa kartı
- Kitapçı veya coworking alanında izinli afiş
- Topluluk etkinliğinde özel davet kodu
- “Niyetini tek cümlede yaz” kartları
- Güvenli tanışma temalı küçük buluşma
- Kampanya bazlı kartpostal veya sticker

Her lokasyon için ayrı kod kullanılmalıdır:

- `KADIKOY01`
- `BESIKTAS01`
- `BOOKCLUB01`
- `RUNCLUB01`

İzinsiz afiş veya sticker yapıştırılmamalıdır.

---

## 11. Yeni üye aktivasyonu

Üye kazanmak tek başına yeterli değildir. Yeni üyenin ilk deneyimi elle desteklenmelidir.

## Kabul sonrası akış

### İlk 10 dakika

- Kabul mesajı
- Profil tamamlama bağlantısı
- “İlk üç adım” özeti

### İlk 24 saat

- Eksik profil varsa nazik hatırlatma
- Niyet, fotoğraf ve profil cevabı için örnekler

### İlk 72 saat

- Gerçek etkileşim yaşamayan kişiye ürün içi rehber
- Uygun aday havuzu yetersizse dürüst açıklama
- Sahte eşleşme veya gizli botla aktivasyon yapılmaması

### 7. gün

- Kısa geri bildirim
- Deneyimi iyiyse bir arkadaş daveti
- Deneyimi kötüyse davet istemeden sorunu çözme

Karşılama mesajı:

> Hoş geldin [isim]. Kurucu Üyeliğin açıldı. Önce fotoğraflarını, ilişki niyetini ve profil sorularını tamamla. Profilin ne kadar açık olursa doğru kişilerin seni anlaması o kadar kolay olur. Takıldığın yerde bu mesaja cevap verebilirsin.

Davete geçiş mesajı:

> Lovask'ta ilk haftanı tamamladın. Deneyimini paylaşmak istediğin, İstanbul'da niyetini açıkça söyleyen bir arkadaşın varsa sana kişisel davet hakkı açabiliriz. Önce arkadaşına sor; kabul ederse kodunu gönder.

---

## 12. Ölçüm sistemi

## 12.1. Günlük metrikler

- Yeni başvuru
- Kabul edilen başvuru
- Tamamlanan profil
- Aktive edilen profil
- Kaynak/davet kodu
- DM sayısı ve yanıt sayısı
- İçerik yorum, paylaşım ve kaydetme sayısı

## 12.2. Haftalık metrikler

- Başvuru → kabul oranı
- Kabul → profil tamamlama oranı
- Profil tamamlama → 72 saat aktivasyon oranı
- 7. gün aktiflik oranı
- İlk gerçek etkileşime kadar geçen medyan süre
- Kaynak bazında aktive üye sayısı
- Davet eden aktif üye oranı
- Şikâyet, engelleme ve güvenlik olayı oranı

## 12.3. Basit karar kuralları

- Bir içerik formatı üç denemede hiç paylaşım/kaydetme üretmiyorsa kancası değiştirilir.
- Bir topluluk 30 başvuru getirip çok az tamamlanmış profil getiriyorsa hedefleme veya vaat yanlıştır.
- Bir elçi düşük kaliteli/sahte başvuru getiriyorsa kodu durdurulur.
- Üye sayısı artarken ilk etkileşim süresi uzuyorsa havuz dengesi incelenir.
- Ret ve şikâyet artıyorsa outbound hacmi hemen azaltılır.

---

## 13. Günlük operasyon rutini

Tek kişiyle yaklaşık 2,5–3 saat:

### Sabah — 45 dakika

- Gelen DM ve yorumlara cevap
- Yeni başvuruları inceleme
- Aktivasyon problemi yaşayan üyeleri belirleme

### Öğlen — 45 dakika

- Hedef hesaplarda 5–10 anlamlı yorum
- 3 topluluk/creator ilişkisi
- Yalnızca planlanan kişisel DM'ler

### Akşam — 60 dakika

- Bir kısa video çekim/yayın
- Story anketi veya soru kutusu
- İlk saat yorumlarına cevap

### Gün sonu — 20 dakika

- Başvuru ve kaynak tablosunu güncelleme
- DM yanıtlarını kaydetme
- Ertesi günün adaylarını seçme

Haftada bir 2–3 saatlik toplu içerik çekimi yapılır. Yedi videonun ham çekimi tek oturumda tamamlanabilir.

---

## 14. Çok düşük bütçe kullanımı

Organik plan ücretsiz değildir; para yerine yoğun kurucu zamanı kullanır. Aylık mikro bütçe varsa öncelik sırası:

1. Basit tripod/yaka mikrofonu
2. Küçük fiziksel etkinlik masrafı
3. QR kartı/afiş baskısı
4. Elçi buluşması veya küçük ikram
5. Gerekirse temel video altyazı aracı

Takipçi satın alma, ücretli toplu DM aracı veya şüpheli otomasyon için bütçe ayrılmaz.

---

## 15. Uyum, izin ve kişisel veri

Bu bölüm hukuki danışmanlık değildir; canlı operasyon öncesinde Türkiye'de e-ticaret/KVKK konusunda uzman görüşü alınmalıdır.

Temel güvenli yaklaşım:

- Kişinin “bilgi gönder” demesi yalnızca o konuşmanın talebine yanıt verme iznidir; sınırsız pazarlama izni sayılmaz.
- Düzenli pazarlama iletileri için belirli, bilgilendirilmiş ve özgür iradeye dayalı izin alınmalıdır.
- Aydınlatma metni ile açık rıza metni ayrı tutulmalıdır.
- Pazarlama izni hizmetin zorunlu koşulu yapılmamalıdır.
- İzin kanıtı, kapsamı ve tarihi kaydedilmelidir.
- Ret talebi derhâl uygulanmalıdır.
- Arkadaş yönlendirmesinde iletişim bilgisi izinsiz toplanmamalıdır; mevcut üye kendi kodunu arkadaşına göndermelidir.
- Instagram kullanıcı adları otomatik toplanmamalı veya gereksiz süre saklanmamalıdır.
- Fotoğraf, video, yorum ve başarı hikâyesi için ayrıca açık yayın izni alınmalıdır.

KVKK'nın güncel duyuruları, üçüncü kişilerden “referans/tavsiye/marka elçiliği” yoluyla alınan iletişim bilgilerinin pazarlama için otomatik hukuki dayanak oluşturmadığını vurgulamaktadır. En güvenli yönlendirme modeli şudur:

```text
Mevcut üye → kendi davet kodunu arkadaşına gönderir
Arkadaş → kendi isteğiyle başvurur
Lovask → yalnızca başvurudan sonra iletişim kurar
```

---

## 16. İlk 48 saatte yapılacaklar

### Gün 1

- [x] İstanbul + ilk 200 + 30 gün Noir teklifini kesinleştir.
- [ ] Botların canlı kullanıcı deneyimindeki durumunu düzelt. — **2026-08-17 kullanıcı kararıyla şimdilik ertelendi.**
- [x] Takip tablosunu/admin büyüme hunisini oluştur.
- [ ] 20 elçi adayı ve 50 sıcak aday yaz.
- [x] Davet kodu standardını belirle.

### Gün 2

- [ ] Instagram biyografisini güncelle.
- [x] Üç sabit gönderinin metnini ve üretim yönlendirmesini hazırla.
- [ ] İlk haftanın 5 Reels ve 2 carousel içeriğini üret.
- [ ] İlk beş kişiselleştirilmiş sıcak mesajı gönder.
- [ ] Üç topluluk yöneticisine izin isteyen mesaj gönder. — **Mesajlar hazır; henüz gönderilmedi.**

Başlangıçta başka hiçbir kanala yayılmaya gerek yoktur. İlk iki hafta Instagram + elçiler + doğrudan topluluk ilişkileri yeterlidir.

---

## 17. Resmî kaynaklar ve referanslar

Politikalar değişebilir; uygulamadan önce kaynaklar yeniden kontrol edilmelidir.

- [Instagram Topluluk Kuralları — spam ve rızasız tekrarlanan ticari ileti](https://www.facebook.com/help/instagram/477434105621119/)
- [Instagram Kullanım Koşulları — izinsiz otomatik erişim/veri toplama](https://www.facebook.com/help/instagram/581066165581870)
- [Meta Otomatik Veri Toplama Koşulları](https://www.facebook.com/legal/automated_data_collection_terms)
- [KVKK — Açık rıza alınırken dikkat edilecek hususlar](https://www.kvkk.gov.tr/Icerik/2037/Acik-Riza-Alirken-Dikkat-Edilecek-Hususlar)
- [KVKK — Üçüncü kişilerden elde edilen kişisel verilerin reklam ve pazarlama amaçlı kullanımı](https://www.kvkk.gov.tr/Icerik/8830/ucuncu-kisilerden-elde-edilen-kisisel-verilerin-reklam-ve-pazarlama-amacli-kullanilmasina-iliskin-kamuoyu-duyurusu)
- [KVKK — Aydınlatma ve açık rıza metinlerinin ayrı düzenlenmesi](https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu)
- [Ticaret Bakanlığı — İleti Yönetim Sistemi](https://ticaret.gov.tr/ic-ticaret/ticari-elektronik-iletiler/ileti-yonetim-sistemi-iys)

---

## 18. Planın başarı tanımı

Plan, Lovask'ın 200 e-posta adresi toplamasıyla başarılı sayılmaz. Başarı şudur:

> İstanbul'da yeterli yoğunlukta, birbirine gerçekten erişebilen, kimliğine güvenen ve arkadaşını gönüllü olarak davet eden ilk topluluğun kurulması.

Bu noktaya ulaşıldığında ikinci şehir için aynı plan kopyalanmaz; ilk şehirde çalışan içerik, elçi profili, aktivasyon ve denge verileri kullanılarak uyarlanır.
