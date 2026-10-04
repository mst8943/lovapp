# Lovask Temizlik ve İnceleme Adayları Raporu

Bu doküman, Lovask projesi disk dizinlerinde yapılan doğrudan dosya taramaları ve kod referans aramaları sonucunda tespit edilen; geliştirme sürecinden kalan test çıktıları, geçmiş oturum belgeleri, eski dağıtım dosyaları ve harici veri artıklarını listelemektedir.

> **Önemli Hatırlatma:** Bu raporda yer alan **HİÇBİR DOSYA SİLİNMEMİŞ VEYA TAŞINMAMIŞTIR**. Kod referansının bulunmaması, bir dosyanın kesin olarak silinebileceği anlamına gelmez. Tarihsel dokümantasyon, manuel inceleme referansı veya harici çalışma yedeği olarak tutuluyor olabilirler.

---

## 1. Doğrulanmış Mevcut Temizlik ve İnceleme Adayları

Aşağıdaki dosyaların tamamının disk üzerinde şu anda **fiziksel olarak mevcut olduğu** doğrulanmıştır:

| Dosya | Neden aday? | Referans aramasının sonucu | Silinirse olası etkisi |
| :--- | :--- | :--- | :--- |
| `apps/mobile/test/failures/chat-request-large-text_isolatedDiff.png` | Test Çıktısı: Geçmiş başarısız Flutter golden testinden kalan fark görseli. | Kod ve testlerde referansı bulunamadı (Flutter test koşucusu çıktısıdır). | Saklama gerekçesi bilinmiyor. Test geçtikten sonra Flutter tarafından tekrar okunmaz; geçmiş görsel regresyonu incelemek için tutulmuyor ise depolamayı rahatlatır. |
| `apps/mobile/test/failures/chat-request-large-text_maskedDiff.png` | Test Çıktısı: Golden test piksel maskesi görseli. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor; başarısız test anının kaydıdır. |
| `apps/mobile/test/failures/chat-request-large-text_masterImage.png` | Test Çıktısı: Test anında karşılaştırılan ekran referansı kopyası. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor; asıl master görseller `goldens/` altında mevcuttur. |
| `apps/mobile/test/failures/chat-request-large-text_testImage.png` | Test Çıktısı: Test anında yakalanan render görüntüsü. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor. |
| `apps/mobile/test/failures/chat_isolatedDiff.png` | Test Çıktısı: Eski sohbet golden test fark maskesi. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor. |
| `apps/mobile/test/failures/chat_maskedDiff.png` | Test Çıktısı: Eski sohbet golden test maskeleme görseli. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor. |
| `apps/mobile/test/failures/chat_masterImage.png` | Test Çıktısı: Eski sohbet golden test master kopyası. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor. |
| `apps/mobile/test/failures/chat_testImage.png` | Test Çıktısı: Eski sohbet test render görseli. | Kod ve testlerde referansı bulunamadı. | Saklama gerekçesi bilinmiyor. |
| `docs/cleanup-candidates-2026-09-28.csv` | Geçmiş Oturum Çıktısı: 28 Eylül tarihli önceki dosya taramasından kalan geçici liste. | Kod, test veya CI tarafından okunmamaktadır. | Saklama gerekçesi bilinmiyor; önceki analiz oturumuna ait bir dökümdür. |
| `docs/DISCOVERY_FIX_HANDOFF_2026-09-18.md` | Tarihsel Belge: 18 Eylül tarihli keşif kaydırma hatası devir teslim notu. | Kodda veya scriptlerde referansı yoktur. | Tarihsel süreç takibi dışında fonksiyonel etkisi yoktur; proje tarihçesi amacıyla saklanıp saklanmadığı bilinmemektedir. |
| `docs/sync-handoff-2026-09-28.md` | Tarihsel Belge: 28 Eylül tarihli senkronizasyon oturumu devir teslim notu. | Kodda referansı yoktur. | Tarihsel süreç takibi amacıyla saklanıyor olabilir. |
| `artifacts/bots-after.png`, `artifacts/bots-normalized.png` | Görsel Artefakt: Manuel bot sayfası denetiminden kalan ekran görüntüleri. | Kodda referansı yoktur. | UI tasarım geçmişi incelemesi amacıyla tutulup tutulmadığı bilinmemektedir. |
| `artifacts/dashboard-after.png` | Görsel Artefakt: Eski admin dashboard denetim görseli. | Kodda referansı yoktur. | Saklama gerekçesi bilinmiyor. |
| `artifacts/lovask-160-*.png` (6 dosya: emulator, profile, profile2, profile3, profile4, voice) | Görsel Artefakt: Sürüm 160 test ekran görüntüleri (~5.5 MB toplam). | Kodda referansı yoktur. | Eski sürüm inceleme kaydı niteliğindedir; saklama gerekçesi bilinmiyor. |
| `artifacts/noir-mobile-payment.png` | Görsel Artefakt: Noir mobil ödeme ekran görüntüsü. | Kodda referansı yoktur. | Saklama gerekçesi bilinmiyor. |
| `artifacts/snap-tabs.js` | Yardımcı Betik: Sekme ekran görüntüsü alma scripti. | Kodda ve test paketlerinde referansı yoktur. | Geliştirici tarafından manuel ihtiyaç anında çalıştırılmak üzere tutuluyor olabilir. |
| `tmp/cihaz-pasaportu-leads-raw.json`, `tmp/cihaz-pasaportu-google-maps-input.json`, `tmp/build-cihaz-pasaportu-leads.mjs` | Harici Proje Artığı: Başka bir projeye ait Google Maps kazıma verileri. | Lovask projesinde hiçbir referansı bulunmuyor. | Geliştiricinin bu verileri geçici çalışma amacıyla bu dizine koyup koymadığı veya yedeğinin başka yerde bulunup bulunmadığı bilinmemektedir; silinmeden önce kullanıcı teyidi gerekir. |
| `tmp/saas-reddit-input.json` | Harici Veri: Reddit veri kazıma girdisi. | Lovask projesinde referansı yoktur. | Saklama gerekçesi bilinmiyor. |
| `tmp/deploy172.py`, `tmp/deploy173.py`, `tmp/deploy174.py`, `tmp/deploy174signed.py`, `tmp/deploy_160.py`, `tmp/deploy_170_final.py`, `tmp/deploy_170_web.py` | Eski Dağıtım Betikleri: Geçmiş sürümlere özel tek seferlik SSH/sunucu dağıtım dosyaları. | Kod tabanında çağrılmamaktadır (güncel dağıtım `deploy-sync-20260928.py` veya release scriptleri ile yapılmaktadır). | Geçmiş sunucu dağıtım parametrelerinin arşiv amaçlı tutulup tutulmadığı bilinmemektedir. |
| `tmp/profile-axe.json` | Geçmiş Test Çıktısı: Eski erişilebilirlik denetim raporu. | Kodda referansı yoktur. | Saklama gerekçesi bilinmiyor. |
| `tmp/ui-review-checkpoint.md`, `tmp/finish-review.json` | Geçici İnceleme Dosyaları: UI kontrol noktası kayıtları. | Kodda referansı yoktur. | Saklama gerekçesi bilinmiyor. |

---

## 2. Önceki Listeden Çıkarılan Dosyalar (Fiziksel Olarak Diskte Bulunmayanlar)

Önceki geçici envanter CSV'sinde listelenen ancak disk taramasında **fiziksel olarak mevcut olmadığı** saptanan aşağıdaki dosyalar aktif temizlik listesinden çıkarılmıştır:
- `tmp/community-150.tgz` (Diskte mevcut değil)
- `tmp/emulator-current.apk` (Diskte mevcut değil)
- `tmp/deploy172.log`, `tmp/deploy172.pid` (Diskte mevcut değil)
- `tmp/deploy173.log`, `tmp/deploy173.pid` (Diskte mevcut değil)
- `tmp/deploy174.log`, `tmp/deploy174signed.log` (Diskte mevcut değil)

---

## 3. Karar ve İnceleme Gerektiren Şüpheli Dosyalar

1. **`tmp/deploy-sync-20260928.py` & `tmp/lovask.nginx.conf`:**
   - En son kullanılan dağıtım betiği ve sunucu Nginx yapılandırma şablonudur. `tmp/` dizininde yer almalarına karşın operasyonel referans değerleri bulunmaktadır.
2. **Pazarlama Belgeleri (`docs/instagram-*.md`, `docs/organic-*.md`):**
   - Kod tabanıyla bağı olmayan ancak iş ve büyüme stratejisi içeren belgelerdir. Teknik temizlik kapsamında değerlendirilmemeli, ürün yönetimi arşivinde korunmalıdır.
3. **`scripts/rename-bots-female.mjs` & `scripts/capture-mobile-reference.mjs`:**
   - Günlük test döngüsünde koşulmayan fakat veritabanı tohumlama veya tasarım denetimi anında gerekebilecek operasyonel araçlardır.

---

## 4. Kesinlikle Dokunulmayacak Kritik Dosyalar

Aşağıdaki dosya grupları hiçbir koşulda temizlik adayı yapılamaz:
- `supabase/migrations/*` ve `supabase/INSTALL.sql` (Veritabanı bütünlüğü).
- `.env`, `.env.local`, `.env.production` (Ortam konfigürasyonları).
- `apps/mobile/android/app/google-services.json` (Firebase bildirim kimliği).
- `apps/mobile/test/goldens/*.png` (Flutter altın ekran referansları).
