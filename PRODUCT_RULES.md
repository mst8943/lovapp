# Lovask ürün kuralları

Son güncelleme: 15 Ağustos 2026 (Europe/Istanbul)

Bu belge, kullanıcı uygulamasındaki üyelik, keşfet, beğeni, mesajlaşma,
doğrulama, bildirim ve güvenlik davranışlarının ürün sözleşmesidir. Kod ve
veritabanı davranışı bu kurallarla çelişmemelidir.

## Üyelik hakları

- Standart kullanıcı günde 10 normal Beğeni kullanabilir. Haklar İstanbul
  saatiyle 00.00'da 10/10 olur ve devretmez. Geç işlemi kotadan düşmez.
- Noir normal Beğenileri sınırsızdır.
- Standart kullanıcı haftada 1, Noir kullanıcı günde 1 Süper Beğeni kullanır.
- Süper Beğeni ayrı kotadır ve gönderildikten sonra geri alınamaz.
- Standart kullanıcı günde toplam 25, Noir kullanıcı 100 mesaj gönderebilir.
  Metin ve sesli mesaj aynı ortak kotayı kullanır.
- Her başarılı mesajdan sonra gerçek kalan değer `kalan/limit` biçiminde
  gösterilir.

## Mesaj isteği

- Eşleşme olmadan gönderilen ilk mesaj ayrı bir Mesaj İsteğidir.
- Standart kullanıcı günde 1, Noir kullanıcı günde 3 yeni Mesaj İsteği
  gönderebilir. İlk mesaj hem istek hem toplam mesaj kotasından düşer.
- Kabul öncesinde yalnızca bir metin mesajı gönderilebilir; ikinci mesaj ve
  sesli mesaj gönderilemez.
- Kabul, normal sohbeti açar fakat romantik eşleşme oluşturmaz. Romantik
  eşleşme yalnızca karşılıklı Beğeni/Süper Beğeniyle oluşur.
- İstek reddedilir, geri çekilir veya engelleme gerçekleşirse hak iade edilmez.
- Cevaplanmayan istek gönderildikten 24 saat sonra kapanır. Aynı kişiye tekrar istek
  gönderilemez; sonradan karşılıklı beğeni oluşursa normal sohbet açılabilir.
- Gönderici kapanma nedenini görmez; yalnızca “Mesaj isteği kapandı” görür.
- Mesaj isteği Beğeni sayılmaz.
- Bekleyen istek sırasında karşılıklı beğeni oluşursa ilk mesaj korunur ve tek
  konuşma romantik eşleşme sohbetine dönüşür.

## Keşfet ve beğeni yaşam döngüsü

- Beğeni hakkı bittiğinde Keşfet açık kalır ve Geç kullanılabilir. Beğen
  girişlerinin tamamı aynı `0/10` ve yenilenme zamanlı modalı açar.
- Geç kararı 30 gün sonra yeniden gösterilebilir. Karşılıksız Beğeni ve Süper
  Beğeni 30 gün sonra sona erer, hak iade edilmez ve profil yeniden
  karşılaşabilir.
- Noir Geri Al yalnızca Geç ve eşleşmeye dönüşmemiş normal Beğeni için
  kullanılabilir. Süper Beğeni ve oluşmuş eşleşme geri alınamaz.
- Temel uygunluk çift taraflıdır: iki kullanıcının yaş ve ilgilendiği cinsiyet
  tercihleri birbirini kapsamalıdır. Bu kural yeni beğeni ve mesaj isteklerinde
  sunucuda tekrar doğrulanır; mevcut sohbetler sonradan değişen tercihlerden
  etkilenmez.

## Bot etkinlik ritmi

- Bot profillerinin mevcut kullanıcı sunumu şimdilik korunur.
- Kullanıcı kararından bağımsız, günlük otomatik bot beğenisi üretilmez.
  Bot eşleşmesi yalnızca aşağıdaki pozitif karar eşiklerinden doğar.
- İlk 100 pozitif beğeni içinde kullanıcıya özel, kalıcı ve kontrollü dört
  rastgele eşik üretilir: 6–15, 25–45, 50–75 ve 76–100.
- Aynı gün birden fazla eşik geçilse bile 24 saatte en fazla bir otomatik bot
  eşleşmesi/ilk mesajı teslim edilir. İlk teslim 30 dakika–6 saat, sonrakiler
  6–24 saat gecikmelidir.
- İlk 100'den sonra her 60–120 yeni pozitif beğenide bir ek eşik üretilir;
  haftada en fazla bir ek bot eşleşmesi teslim edilir.
- Yalnızca kullanıcının daha önce olumlu karar verdiği bot seçilebilir. Gerçek
  kullanıcı eşleşmeleri bu sınırlardan etkilenmez.

## Profil alanları ve filtreler

- Zorunlu alanlar: cinsiyet, doğum tarihi, şehir, ilişki amacı, medeni hâl,
  mevcut çocuk durumu ve gelecekte çocuk isteği.
- Opsiyonel alanlar: ilçe, alkol, sigara, evcil hayvan, spor, boy, eğitim ve
  diller. Burç doğum tarihinden hesaplanır; yaş doğum tarihinden üretilir.
- Cinsiyet seçeneklerinde “Belirtmek istemiyorum” yoktur. Kadın, Erkek,
  Non-binary ve “Kendimi farklı tanımlıyorum” seçenekleri vardır.
- İlişki amacı tek seçimdir: Evlilik, Ciddi ilişki, Tanışma ve flört, Kısa
  süreli ilişki, Arkadaşlık, Henüz emin değilim.
- Medeni hâl tek seçimdir: Hiç evlenmedi, Boşanmış, Eşi vefat etmiş, Ayrı
  yaşıyor, Evli.
- Çocuk bilgisi iki ayrı zorunlu alandır: mevcut çocuk durumu ve gelecekteki
  çocuk tercihi.
- Standart filtreler: cinsiyet, yaş, şehir, yaklaşık mesafe ve ilişki amacı.
- Noir filtreleri: medeni hâl, çocuk alanları, alkol, sigara, evcil hayvan,
  spor, burç, boy, eğitim, diller ve yalnızca fotoğrafı doğrulanmış profiller.
- Aynı başlıktaki çoklu seçimler VEYA, farklı başlıklar VE mantığıyla çalışır.
  Filtreli alanı boş olan profil sonuçtan çıkarılır. Sıfır sonuçta filtreler
  otomatik değiştirilmez; kullanıcıya temizleme seçeneği sunulur.
- Mesafe kesin konumla değil, standart şehir/ilçe merkezleri üzerinden yaklaşık
  hesaplanır. Kesin adres veya canlı GPS paylaşılmaz.
- Standart kullanıcı profilin temel bilgilerini görür. Noir yaşam tarzı ve
  ileri uyumluluk alanlarını net görür; Standart kullanıcı bu bölümü kilitli
  görür. Fotoğraf doğrulama rozeti herkese açıktır.

## Fotoğraf moderasyonu ve doğrulama

- Fotoğraf içerik moderasyonu ile selfie doğrulaması farklı işlemlerdir.
- Fotoğrafı incelemede olan kullanıcı etkileşim yapabilir; etkileşim kotadan
  rezerve edilir ve en az bir güvenli ana fotoğraf onaylanınca teslim edilir.
- Rozetin adı “Fotoğrafı Doğrulandı”dır. Yalnızca güncel selfie ile profil
  fotoğraflarındaki kişinin aynı olduğu anlamına gelir; kimlik, yaş veya geçmiş
  doğrulaması değildir.
- Doğrulama selfiesi özel alanda tutulur, kullanıcılara gösterilmez ve karar
  sonrasında en geç 30 gün içinde silinir. Admin manuel silebilir; medya silme
  ile rozeti kaldırma farklı, denetimli işlemlerdir.
- Ana doğrulanmış fotoğrafların tümü değişirse rozet askıya alınır ve yeniden
  doğrulama gerekir.

## Bildirimler ve mahremiyet

- Bildirim türleri: Beğeni, Eşleşme, Profil Ziyareti, Mesaj, Mesaj İsteği,
  Admin/Sistem ve Hesap Güvenliği.
- Standart Beğeni/Ziyaret bildirimi kimlik ve sayı vermez, günde en fazla bir
  kez gönderilir. Noir tercih açıksa kimlikli bildirim alabilir.
- Kritik güvenlik ve ödeme olayları uygulama içi bildirim merkezinde her zaman
  bulunur. Sosyal bildirimler ayrı ayrı kapatılabilir. Sessiz saatler sosyal
  bildirimlere uygulanır, kritik güvenlik olaylarını geciktirmez.
- Gizli Gezinti yalnızca Noir içindir. Açıkken kullanıcı başkalarının ziyaretçi
  listesinde görünmez ve kendisini ziyaret edenlerin kimliğini de göremez.
  Gizli dönemdeki kimlikler sonradan açığa çıkmaz.

## Güvenlik ve hesap yaşam döngüsü

- Şikâyette varsayılan eylem “Şikâyet et ve engelle”dir; yalnızca şikâyet et
  seçeneği ayrıca sunulur.
- 24 saatte üç farklı gerçek kullanıcıdan ciddi şikâyet alan profil geçici
  olarak Keşfet ve mesajlaşmadan çıkar, acil moderasyona girer; kalıcı kararı
  moderatör verir.
- Aynı kullanıcı/profil çifti için bir açık şikâyet dosyası bulunur; ek bilgiler
  aynı dosyaya bağlanır. Reddedilen çok sayıda asılsız bildirim ayrıca incelenir.
- Görünürlüğü kapatmak yeni keşif, istek ve bot işlerini durdurur; mevcut kabul
  edilmiş sohbetleri kapatmaz.
- Engel kaldırmak eski sohbeti açmaz. İlişki durumu sıfırlanır ve profiller 30
  gün sonra yeniden karşılaşabilir.
- Eşleşmeyi kaldırmak sohbeti kapatır ve profilleri 90 gün ayırır. Engelleme,
  kaldırılana kadar süresiz ve iki yönlü gizlemedir. Eski mesajlar yeniden
  eşleşmede kullanıcıya açılmaz.
- Hesap silme anında hesabı kapatır, kişisel profil/medya verilerini temizler ve
  oturumu sonlandırır. Zorunlu ödeme/güvenlik kayıtları yayımlanmış saklama
  politikasına göre kimliksizleştirilir.
- Telefon doğrulaması sonraki aşamadır. Şimdilik e-posta doğrulaması zorunludur;
  kayıt ve hassas mutasyonlarda CAPTCHA/hız sınırı uygulanır.

## XP ve görevler

- “3 sağa kaydır” yerine “3 profil hakkında karar ver” kullanılır; Beğen veya
  Geç birlikte sayılır.
- “Sohbet başlat” yalnızca kabul edilmiş mesaj isteğinde veya eşleşmede ilk
  mesajla tamamlanır.
- XP Noir haklarını açmaz. Seviyeler yalnızca profil çerçevesi, unvan ve
  kozmetik rozet gibi ödüller verir; bir sonraki ödül kullanıcıya gösterilir.

## Hukuki ve rıza sözleşmesi

- Kayıt öncesinde Kullanım Koşulları ve Gizlilik/Aydınlatma metinleri açıkça
  kabul edilir; metin sürümü ve zaman damgası saklanır.
- Pazarlama izni ayrı ve opsiyoneldir. Topluluk Kuralları ile Noir
  ödeme/iptal metinleri erişilebilir olmalıdır.
- Nihai metinler ve veri saklama süreleri canlıya alınmadan önce hukuk uzmanı
  tarafından onaylanmalıdır.
