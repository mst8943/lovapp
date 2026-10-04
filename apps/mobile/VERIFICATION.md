# Flutter doğrulama

## 26 Eylül 2026 — Keşfet kart tepkisi

- Beğen/geç/süper beğen sırasında `Kaydediliyor…` katmanı kaldırıldı. Kart 360 ms yönlü geçişle çıkar; sonraki profil ağ yanıtından bağımsız olarak geçiş sonunda görünür. Hata durumunda eski profil geri gelir ve hata açıklanır; aynı anda ikinci karar engellenir.
- Keşfet kartlarındaki fotoğraflar ekran çözünürlüğüne uygun boyutta decode edilir; tam profil görüntüleme akışı değişmedi.
- `flutter analyze --no-pub`: sorun yok. `flutter test --no-pub --concurrency=1 --reporter expanded`: **34 geçti, 1 canlı API testi atlandı**. Altı yön/başarı-hata senaryosu, küçük ekran ve golden karşılaştırmaları geçti. Çıktı: `build/swipe-full-tests.log`. Gerçek cihaz kare hızı ölçülmedi.
- Android release APK güncel kaynaklardan üretildi: `build/app/outputs/flutter-apk/app-release.apk`. `emulator-5554` üzerine kuruldu, ana Activity ön planda açıldı ve açılış logunda AndroidRuntime/flutter hatası görülmedi. Canlı profilde karar gönderilmedi.

## 26 Eylül 2026 — Son görsel rötuşlar

- Kartlarda ortak hafif gölge, koyu kapaklarda ince kenar vurgusu, profil kapağında yörünge motifi ve bilgi satırlarında lavanta ikon zeminleri eklendi. Buton derinliği ve onboarding ilerlemesinin 180 ms geçişi düzenlendi; hareket azaltma desteklenir.
- `flutter analyze --no-pub`: sorun yok. `flutter test --no-pub --reporter expanded`: **30 geçti, 1 canlı API testi atlandı**. Çıktı: `build/polish-tests.log`; güncel görseller: `test/goldens/`.
- `flutter emulators` mevcut cihazı `codex-lovask` olarak listeliyor. Android'de güncel kaynakları çalıştırma: `powershell -ExecutionPolicy Bypass -File .\run.ps1 -Device android` (bu dizinden).
- C: sürücüsünde 250 MB'dan az boş alan var; önceki emülatör açılışı disk yetersizliğiyle sonlandı. Bu tur emülatörde çalıştırılmadı ve APK yeniden üretilmedi; mevcut APK önceki kart revizyonuna aittir.
- Kaynak yedeği: `../../tmp/mobile-before-polish-20260926.zip`.

## 26 Eylül 2026 — Profil ve form kartları

- Ortak `LovaskFormCard` ile sabit alan başlıkları, ince alt çizgiler ve odak vurgusu eklendi. Giriş, onboarding/profil düzenleme ve üyelik başvurusu mevcut alanları kullanır.
- Profilde isim, şehir ve cinsiyet satırları mevcut düzenleme akışını açar. Kaydetme, doğrulama ve API davranışları korunur.
- `flutter analyze --no-pub`: sorun yok. `flutter test --no-pub --reporter expanded`: **30 geçti, 1 canlı API testi atlandı**. Çıktı: `build/card-tests.log`.
- Küçük ekran, büyük metin, klavye ve golden karşılaştırmaları geçti. Gerçek cihaz doğrulaması bu revizyonda yapılmadı.
- Güncel kaynaklardan Android release APK yeniden derlendi: `build/app/outputs/flutter-apk/app-release.apk`.
- Değişiklik öncesi yedek: `../../tmp/mobile-before-card-update-20260926-002916.zip`.

## 26 Eylül 2026 — Lovask Orbit mobil yeniden tasarımı

- Yeni mobil tasarım doğrudan mevcut Flutter ekranlarına uygulandı. Tasarım sistemi: `DESIGN.md`; gerçek widget görüntüleriyle önizleme: `design-preview.html`.
- `flutter analyze --no-pub`: hata ve uyarı yok.
- Son normal `flutter test --reporter expanded` koşusu: **30 geçti, 1 atlandı**. Golden görüntüler karşılaştırıldı. Çıktı: `build/redesign-final-tests.log`.
- Ekran kapsamı: 320/390/480 px genişlik; 320×568 küçük ekran; 1.6 metin ölçeği; 220 px klavye inset; altı onboarding adımı; safe area ve azaltılmış hareket ile sekme geçişleri; ayarlar sayfasına giriş ve görünürlük değişikliği. Fotoğraf, boş, yükleniyor ve hata durumları dahil.
- Kaydırma başarısı/hata geri dönüşü, çift karar engeli, mesaj taslağını koruma ve aynı kimlikle tekrar gönderme, filtre değişikliklerini kaydetmeden çıkış ve kendi profilini önizleme davranışları geçti.
- Son kaynaklardan Android release APK üretildi: `build/app/outputs/flutter-apk/app-release.apk` (58.437.328 bayt). Mevcut public bağlantı yapılandırması ve imzalama ayarı kullanıldı; APK yayımlanmadı.
- `lib/api.dart`, `lib/models.dart`, güvenlik ve sesli mesaj kaynakları çalışma öncesi yedekle bayt düzeyinde aynı. Backend ve web kaynakları değiştirilmedi; yeni bağımlılık eklenmedi.
- Canlı API testi çalışma zamanı test hesabı verilmediği için atlandı. Gerçek ödeme, OAuth, mikrofon ve iki cihazla mesajlaşma bu turda doğrulanmadı.
- Android emülatörü başlatılmaya çalışıldı ancak yetersiz disk alanı nedeniyle açılamadı. Bu sürümün cihaz üzerindeki açılışı doğrulanamadı; alttaki eski cihaz doğrulamaları önceki sürümlere aittir.
- Çalışma öncesi kaynak/test yedeği: `../../tmp/mobile-before-redesign-20260925-235421.zip`.

---

Önceki sürümlerin doğrulama kayıtları:

## 24 Eylül — genişletilmiş ekran denetimi

- Açılış durumlarına ek olarak kaydırılabilir içerikler dört kaydırma ile kontrol edildi; profil, ödeme siparişleri, tercihler ve destek alt bölümleri golden görüntüye alındı.
- 320x568 küçük ekran; 390x844 / 1.6 yazı ölçeği; 320x568 / 1.2 yazı ölçeği ve 220px klavye inset senaryoları eklendi. Klavye senaryosu giriş, sohbet, tercihler, başvuru, onboarding, destek ve recovery üzerinde çalışıyor; fiziksel klavye/IME testi değildir.
- Altı onboarding adımı 320x568 / 1.4 yazı ölçeğinde geçildi. Son adım buton taşması düzeltildi. Ortak butonlar metne göre büyüyebiliyor; minimum dokunma yükseklikleri korunuyor.
- Büyük yazıda Explore başlık taşması düzeltildi.
- Dokuz API ekranında gecikmiş yanıt/yükleniyor durumu ve ekran kapandıktan sonra yanıt gelmesi kontrol edildi.
- Repo içindeki `public/profiles/lara.webp` yalnızca testte yerel HTTP üzerinden sunularak gerçek fotoğraf decode/kırpma/kontrast incelemesi yapıldı. Test profili veya fotoğrafı üretim uygulamasına eklenmedi.
- Swipe fotoğrafında yükleniyor göstergesi ve repaint sınırı; onboarding fotoğraf hatasında fallback eklendi.
- Sohbet isteğinde kabul/reddet yerleşimi Wrap oldu; devre dışı gönder butonu görsel olarak ayrıldı. Kaydırmada Material AppBar renk değişimi kaldırıldı; ödeme bekliyor kontrastı artırıldı.
- Yeni görseller: `test/goldens/photo-card.png`, `photo-card-large-text.png`, `chat-request-large-text.png`, `profile-bottom.png`, `noir-orders-bottom.png`.
- Bu denetim bütün olası sunucu yanıtlarını veya gerçek cihazdaki tüm akışları kapsadığı anlamına gelmez. Canlı hesap, gerçek ödeme, mikrofon ve fiziksel cihaz FPS ölçümü yapılmadı.

## 24 Eylül — UI/UX iyileştirmeleri

### Kaydırma animasyonu devamı

- Başarılı swipe ve aksiyon butonları 240ms yönlü kart çıkışı kullanıyor. API isteği animasyonla eşzamanlı başlıyor; sonraki karta geçiş başarı yanıtından sonra yapılıyor.
- Hata durumunda aynı kart spring ile geri geliyor; beklerken ikinci karar engelleniyor ve kaydetme durumu görünür.
- Sekme girişi FadeTransition/SlideTransition kullanıyor; hareket azaltma korunuyor.
- Başarı/hata yanıtları geciktirilerek çıkış, geri dönüş ve çift işlem engeli widget testinde doğrulandı.
- Kullanıcının isteğiyle fiziksel cihaz performans ölçümü eklenmedi; FPS veya ölçülmüş hızlanma iddiası yok.

- Giriş ekranında logo/başlık aralığı kısaltıldı; giriş/kayıt açıklaması ve şifre placeholder'ı ayrıldı. Uydurma Google harf işareti kaldırıldı; buton metin olarak kaldı.
- Keşfet/liste geçişleri etiketlendi. Swipe rotasyonu sınırlandı, geri dönüş hız bilgisi kullanıyor; eşik geçişinde bir kez hafif haptic var (hareket azaltma açıkken kapalı). Kart gölge katmanının fotoğraf dokunuşlarını engellemesi düzeltildi. Arkadaki kart yalnızca gerçek sonraki profil varsa gösteriliyor.
- Sohbette gün ayraçları/grup aralıkları, eski mesajları okurken yeni mesaj düğmesi, mevcut içerik korunarak bağlantı uyarısı ve inline gönderim hatası/tekrar deneme eklendi. Tekrar deneme aynı clientId kullanıyor.
- Profil önizlemesi backend ziyareti oluşturmuyor ve kendine mesaj/güvenlik eylemi göstermiyor. Fotoğraf galerisi Noir teklifinden önce; XP/level alt bölümde.
- Tercihlerde kaydedilmemiş değişiklikleri terk etme onayı var. Ses kaydında süre ve gönderim/yükleme açıklamaları var.
- Noir rozet/gölgesi sadeleştirildi; avantajlar açılabilir, paket ve ödeme seçenekleri yukarı taşındı.
- Mevcut API/model/bileşenler kullanıldı; yeni dependency ve backend değişikliği yok.
- Normal `flutter test`: 21 geçti, canlı API testi atlandı. Layout/golden kapsamı 320/390/480px. Ek davranış testleri `test/ux_interaction_test.dart` içinde.
- Büyük sistem yazı boyutlarının tüm ekranlarda denetimi, fiziksel cihaz mikrofon/haptic denemesi ve gerçek hesapla uçtan uca test bu turun tamamlanmış kapsamına dahil değil.

## Bu turda yapılanlar

- Renk tokenları merkezileştirildi; ruby/gold ayrımı ve düşük kontrastlı metinler düzeltildi.
- Cormorant/Manrope asset fontları ve iki fontun OFL bildirimleri paketlendi.
- Match sheet iki avatar ve bağlantı çizgisi kullanıyor. Swipe geri dönüşü spring animasyonuna geçirildi; controller yaşam döngüsü hatası giderildi.
- Profil fotoğrafları tam ekran ve yakınlaştırılabilir görüntüleyiciyle açılıyor.
- Sohbet gerçek API presence değerini kullanıyor; sahte çevrimiçi göstergeleri kaldırıldı. Okunmamış toplamı navigation'a bağlandı; sesli mesaj ilerleme/kontrastı düzenlendi.
- Tercihlerde sabit kaydet eylemi ve Noir grubu, onboarding'de kalıcı hata/yükleme durumu ve kapak etiketi eklendi. Seçilebilir etiketler 44px hedef ve button semantics kullanıyor.
- Güvenlik işlemlerine vazgeçilebilir ayrı onay eklendi.
- Explore başlık/filtreleri boş ve hata durumunda da görünür; eksik fotoğrafta logo kullanılıyor.
- Backend route'ları, Supabase sorguları ve ödeme sözleşmeleri değiştirilmedi; yeni dependency eklenmedi.

## Doğrulananlar

- `flutter analyze`: hata/uyarı yok.
- `flutter test`: 17 başarılı test, 1 atlanan canlı API testi.
- Layout testindeki ekran ve durumlar 320, 390, 480px genişlikte çalıştırıldı. 390px golden görüntüler `test/goldens/` altında.
- Golden logo yükleme yarışı asset precache ile giderildi; normal karşılaştırma testi başarılı.
- Android release APK derlendi, Android 17 emülatörüne kuruldu ve giriş ekranı açıldı. Açılış log kontrolünde AndroidRuntime/flutter hata çıktısı yoktu.
- Açılış görüntüsü: `build/parity/android-release-check.png`.

## Henüz doğrulanmamış / tamamlanmamış kabul kriterleri

- Canlı API testi bu turda runtime test hesabı değişkenleri verilmediği için atlandı. Canlı giriş-sonrası tüm akışların başarılı olduğu sonucu çıkarılamaz.
- Gerçek mikrofon kaydı, iki cihazla realtime mesaj/presence, OAuth/deep link kurtarma ve ödeme sağlayıcısında uçtan uca işlem bu turda çalıştırılmadı.
- Layout kapsamı tüm olası API durumlarının, onboarding adımlarının ve ekranın aşağısındaki tüm scroll içeriğinin eksiksiz testi değildir.
- Web ile her ekranın piksel eşitliği doğrulanmadı. Mevcut webin global Manrope override'ı ile brief'in Cormorant display isteği farklı; native taraf açıkça istenen Cormorant yönünü kullanıyor.
- Premium olmayan likes/visitors yanıtları yüz fotoğrafı döndürmüyor. Sahte kişi/fotoğraf veya sahte sayı üretilmedi; gerçek yüzlü blur önizlemesi mevcut API ile sağlanamıyor.
- Release build mevcut debug imzasını kullanıyor. Play Store gerekmese de uzun vadeli dağıtım için kalıcı özel imza ve anahtar yedeği ayrıca ele alınmalı; mevcut kullanıcıların güncelleme zinciri bu turda değiştirilmedi.

Bu kayıt bütün brief'in tamamlandığına dair bir onay değildir; yapılan değişiklikler ile kanıtlanan kapsamı ayırır.
