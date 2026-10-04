# Lovask Script ve Test Dosyaları Envanteri

Bu doküman, Lovask projesi bünyesinde yer alan tüm otomatik test, denetim, Flutter mobil testleri ve bakım/yapı araçlarının kapsamlı envanterini, hedef ortamlarını, veritabanı etkilerini, temizlik mekanizmalarını ve çıkış kodu güvenilirlik analizini içermektedir.

---

## 1. Envanter Sayısal Özeti

- **Taranan Toplam Dosya:** 52 dosya
  - `scripts/` dizini altında: 47 dosya
  - `apps/mobile/test/` dizini altında: 5 Flutter test dosyası
- **Gerçek Test ve Denetim Dosyaları:** **40 dosya** (35 script + 5 Flutter test)
- **Birleşik test koşucusu:** **1 dosya** (`scripts/test-full.mjs`; kendisi test senaryosu değildir)
- **Yapı, Bakım, Varlık Üretimi ve Tohumlama Araçları:** **11 dosya** (*Test değildir*, geliştirme/derleme araçlarıdır)

---

## 2. Detaylı Script ve Test Envanteri Tablosu

| Dosya | Amaç | Hedef ortam/port | Gerekli araçlar | Veri değiştiriyor mu? | Temizlik var mı? | Başarısızlıkta çıkış kodu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `scripts/audit-accessibility.mjs` | Genel sayfaları ve canlı hedefte QA hesabının profil kontrastını axe-core ile denetler. | Verilen web URL'si; canlı hedefte QA oturumu | Node.js, Playwright | Hayır (salt okuma ve oturum) | Gereksiz (veri üretmez) | `1` (ihlalde veya giriş hatasında) |
| `scripts/audit-admin-surface.mjs` | Admin paneli rotalarının (`/admin/lovask-control/*`) yüklenme durumlarını ve konsol hatalarını doğrular. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt okuma) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-apk-download.mjs` | Mobil APK indirme rotasını (`/api/mobile/apk`), HTTP başlıklarını ve dosya akışını kontrol eder. | Local Web (Port 3000) | Node.js, fetch | Hayır (salt okuma) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-bot-behavior.mjs` | Bot profillerinin kişilik şablonlarını ve DB kayıt tutarlılığını analiz eder. | Supabase Cloud / DB | Node.js, Supabase Client | Hayır (yalnızca DB okur) | Gereksiz (veri üretmez) | `0` (**DİKKAT:** Assert veya exit kodu içermez; hata loglansa bile Node 0 döner) |
| `scripts/audit-core-local.mjs` | Yerel Next.js ortamında temel kullanıcı akışını (landing, onboarding, keşif kart tıklamaları) test eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (demo/mock modunda) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-discovery-flow.mjs` | Keşfet akışındaki kart kaydırma, beğeni, pas, super like ve geri al işlemlerini tarayıcıda test eder. | Production / Staging | Node.js, Playwright | Evet (swipe ve like kayıtları atar) | Kısmi (oluşturulan kayıtları silme adımı var; hata kontrolü yapılmaz) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-light-overlays.mjs` | Açık tema modunda modal pencerelerin, popover'ların ve filtrelerin görünürlüğünü denetler. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt görsel denetim) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/audit-live-auth.mjs` | Canlı sunucu üzerinde kayıt, e-posta doğrulama ve giriş akışlarını doğrular. | Production (lovask.com) | Node.js, Playwright, Supabase Client | Evet (canlı auth kullanıcısı ve oturum açar) | Hayır (canlıda test verisi kalır) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-match-push.mjs` | Karşılıklı beğeni sonrasında oluşan eşleşme ve FCM push bildirim verilerini doğrular. | Production / Supabase DB | Node.js, Playwright, Supabase Client | Evet (eşleşme ve bildirim kaydı atar) | Hayır (kuyrukta kayıt bırakır) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-mobile-performance.mjs` | Mobil viewport boyutunda sayfa yüklenme sürelerini, layout kaymalarını (CLS) ve performans metriklerini ölçer. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt performans okuması) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-noir-catalog.mjs` | `/api/noir` uç noktasının VIP paket kataloğunu ve fiyatlarını JSON formatında kontrol eder. | Local Web (Port 3000) | Node.js, fetch | Hayır (salt HTTP GET) | Gereksiz (veri üretmez) | `1` (Uncaught HTTP/JSON hatasında exit 1) |
| `scripts/audit-payment-claim.mjs` | Kullanıcıların Noir VIP ödeme talebi oluşturmasını API seviyesinde test eder. | Supabase DB / Local API | Node.js, Supabase Client | Evet (`payment_claims` tablosuna yazar) | Kısmi (silme sorgusu var, Supabase dönüş hatası kontrol edilmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/audit-payment-demo-local.mjs` | Demo modunda ödeme diyaloglarının canlı API'yi kirletmediğini mock ile test eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (istekler Playwright route ile mocklanır) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/audit-profile-ui.mjs` | Profil düzenleme, sessiz saatler ve hesap dondurma formlarını mock isteklerle test eder. | Local Web (Port 3100) | Node.js, Playwright | Hayır (tüm API yazmaları route ile yakalanır) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/audit-public.mjs` | Halka açık sayfaları (Landing, Gizlilik, Şartlar, Blog) HTTP 200 ve kanonik URL açısından denetler. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt okuma) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-qa-dating-flow.mjs` | İki test hesabı arasında tam randevu akışını (beğeni, mesaj, ses) simüle eder. | Local Web (Port 3000) / Supabase DB | Node.js, Playwright, Supabase Client | Evet (ortamdaki Supabase DB'ye yazar) | Kısmi (`finally` bloğu var ancak Supabase silme hataları denetlenmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/audit-realtime.mjs` | Supabase Realtime kanallarını dinleyerek presence ve mesaj iletim olaylarını test eder. | Supabase Realtime (WSS) | Node.js, Supabase Client | Evet (presence yayını yapar) | Kısmi (bağlantı kapatılır) | `1` (Zaman aşımı/hata anında exit 1) |
| `scripts/audit-ui-ux.mjs` | UI regresyonlarını, buton hizalamalarını ve viewport taşmalarını kontrol eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt görsel denetim) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/smoke-blog-seo.mjs` | `/blog`, `/robots.txt` ve `/sitemap.xml` uç noktalarının HTTP 200 durumunu kontrol eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt okuma) | Gereksiz (veri üretmez) | `0` (**DİKKAT:** Sayfa açılamasa bile assert/exit kodu yok; 0 dönebilir) |
| `scripts/smoke-discovery.mjs` | Keşfet ekranının açılışını ve kart etkileşimini kontrol eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (demo modunda) | Gereksiz (veri üretmez) | `0` (**DİKKAT:** `isVisible()` false çıksa bile assert/exit kodu yok; 0 döner) |
| `scripts/smoke-messaging-admin.mjs` | Admin paneli konuşmalar sekmesinin açıldığını ve mesaj listesini denetler. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt okuma) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/smoke-notification-badges.mjs` | Bildirim ve eşleşme rozet sayaçlarının navigasyonda render edildiğini kontrol eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (salt okuma) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/smoke-onboarding.mjs` | Onboarding adımlarının geçişlerini hızlıca test eder. | Local Web (Port 3000) | Node.js, Playwright | Hayır (mock session) | Gereksiz (veri üretmez) | `1` (`process.exitCode = 1` ile kontrollü) |
| `scripts/test-chat-actions.mjs` | Sohbet içi mesaj, emoji tepkisi, sesli mesaj ve silme akışlarını test eder. | Localhost:3015 / Supabase DB | Node.js, Supabase Client | Evet (`messages`, `matches`, `voice` tablolarına yazar) | Kısmi (`finally:90-99` içinde `delete()` çağrılır; Supabase dönüş hataları denetlenmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-community.mjs` | Hikâye ve buluşma planı oluşturma, süre sonu ve plan kaldırma akışlarını test eder. | Supabase DB / Local Web | Node.js, Playwright, Supabase Client | Evet (`stories`, `meetings` tablolarına yazar) | Kısmi (`finally:101-107` içinde silme var; Supabase hata dönüşleri kontrol edilmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-conversation-reopen.mjs` | Arşivlenen bir konuşmanın yeniden açılma mantığını Node VM üzerinde test eder. | Yerel Ortam (Bağımsız Node VM) | Node.js, TypeScript Compiler API | Hayır (in-memory test) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-fcm.mjs` | FCM HTTP v1 OAuth imzasını, bildirim gövdesini ve token önbelleğini mock isteklerle doğrular. | Yerel, dış ağa çıkmaz | Node.js | Hayır | Gereksiz | `1` (assert hatası) |
| `scripts/test-full.mjs` | Web, Flutter, API, canlı denetim ve Android APK kontrollerini tek komutta toplar; HTML ve JSON rapor üretir. | Yerel ve canlı hedef | Node.js, npm, Flutter, ADB, Playwright | Alt testlerden biri yalnızca ayrılmış QA profilini geçici günceller | Alt testlere bağlı | Başarısız veya engelli adım varsa `1` |
| `scripts/test-mobile-apk.mjs` | QA hesaplarıyla APK oturum açma ve dört sekmeyi ADB erişilebilirlik ağacında doğrular. | Android emülatörü + canlı kimlik doğrulama | Node.js, ADB | Emülatör uygulama verisini sıfırlar; sunucuya QA oturumu açar | Sunucuda test kaydı oluşturmaz | `1` (assert veya ADB hatası) |
| `scripts/test-e2e-sync.mjs` | Mobil istemci ile Web oturumu arasındaki veri senkronizasyonunu test eder. | Production / Supabase DB | Node.js, Playwright, Supabase Client | Evet (canlı profil alanlarını günceller) | Hayır (önceki değere geri döndürme garantisi yoktur) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-ghost-request-wingman.mjs` | Hayalet mod görünmezliğini ve AI Wingman günlük kullanım kotasını test eder. | Supabase DB | Node.js, Supabase Client | Evet (istek ve kota kayıtları atar) | Kısmi (`finally` bloğunda siler; hata denetimi yapılmaz) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-handoff.py` | Dağıtım devir teslim mock kontrollerinin doğruluğunu test eder. | Yerel Ortam (Bağımsız) | Python 3, unittest | Hayır (mock test) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-profile-contracts.mjs` | Profil şemalarını ve presence sözleşmesini in-memory doğrular. | Yerel Ortam (Bağımsız Node VM) | Node.js, TypeScript Compiler API | Hayır (izole sözleşme testi) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-qa-cross-client.mjs` | QA A web mesajının QA B mobil API ve admin kaydına yansımasını doğrular. | Canlı web ve Supabase Cloud | Node.js, Playwright, Supabase | Evet (geçici eşleşme, mesaj) | Evet; eşleşme/mesaj ve sayaç temizliği doğrulanır | `1` (assert veya Supabase hatası) |
| `scripts/test-registration-session.mjs` | Kayıt oturumu çerezi ve callback güvenlik parametrelerini 6 senaryoda test eder. | Yerel Ortam (Bağımsız Node VM) | Node.js, TypeScript Compiler API | Hayır (mock session) | Gereksiz (veri üretmez) | `1` (AssertionError durumunda exit 1) |
| `scripts/test-wingman-live.mjs` | AI Wingman canlı API uç noktasını çağırarak öneri üretimini test eder. | Production / Supabase DB | Node.js, Supabase Client | Evet (günlük Wingman sayacını artırır) | Kısmi (sayacı eski haline getirmeye çalışır) | `1` (AssertionError durumunda exit 1) |
| `apps/mobile/test/live_api_test.dart` | Mobil API istemcisinin canlı backend üzerindeki okuma akışlarını doğrular. | Supabase Cloud / Production | Flutter SDK, flutter_test | Hayır (yalnızca oturum açar ve okur) | Evet (`tearDown` ile oturumu kapatır) | `1` (`flutter test` başarısızlıkta exit 1 verir) |
| `apps/mobile/test/model_media_url_test.dart` | Göreli API görsel yollarının mobilde tam URL'ye çevrildiğini doğrular. | Yerel Flutter testi | Flutter SDK, flutter_test | Hayır | Gereksiz | `1` (assert hatası) |
| `apps/mobile/test/screen_layout_test.dart` | Tüm mobil ekranların layout, loading, error ve golden görünümlerini headless test eder. | Flutter Test Koşucusu (Mock HTTP) | Flutter SDK, flutter_test | Hayır (tüm veriler in-memory mocklanır) | Gereksiz (veri üretmez) | `1` (`flutter test` başarısızlıkta exit 1 verir) |
| `apps/mobile/test/ux_interaction_test.dart` | Buluşma planı seçme/kaldırma ve sohbet etkileşimlerini widget testleriyle doğrular. | Flutter Test Koşucusu (MockClient) | Flutter SDK, flutter_test | Hayır (in-memory mock) | Gereksiz (veri üretmez) | `1` (`flutter test` başarısızlıkta exit 1 verir) |
| `apps/mobile/test/widget_test.dart` | Çevrimiçi durum çözücü, güvenlik şikâyet modalı ve mesaj kuyruğu birim mantığını test eder. | Flutter Test Koşucusu (İzole Unit) | Flutter SDK, flutter_test | Hayır (izole birim testi) | Gereksiz (veri üretmez) | `1` (`flutter test` başarısızlıkta exit 1 verir) |

---

## 3. Test Olmayan Bakım, Yapı ve Varlık Araçları (11 Script)

Aşağıdaki dosyalar otomatik test koşucularına **dahil edilmemelidir**. Bunlar derleme, veri tohumlama veya operasyonel amaçlı scriptlerdir:

1. `scripts/build-install-sql.mjs`: `supabase/migrations/` altındaki SQL geçişlerini birleştirerek `supabase/INSTALL.sql` üretir.
2. `scripts/build-mobile-release.ps1`: Flutter Android release APK'sını derler, imzalar ve web indirme klasörüne kopyalar.
3. `scripts/capture-mobile-reference.mjs`: Tasarım karşılaştırması için canlı siteden referans mobil ekran görüntüleri çeker.
4. `scripts/create-live-test-accounts.mjs`: Supabase veritabanında test amacıyla sahte profiller oluşturur.
5. `scripts/create-qa-dating-accounts.mjs`: E2E testleri için karşılıklı iki test kullanıcısı (qa-user-a, qa-user-b) oluşturur.
6. `scripts/debug-browser.mjs`: Geliştiricinin yerel tarayıcıda DOM incelemesi yapması için Chromium başlatır.
7. `scripts/fix-next-runtime-links.mjs`: Windows/Linux sembolik bağlantı ve Next.js runtime uyumsuzluklarını onarır.
8. `scripts/generate_launcher_icons.py`: Android mipmap klasörleri için uygulama simgelerini yeniden boyutlandırır.
9. `scripts/import-bot-seeds.mjs`: JSON dosyasından hazır bot profillerini veritabanına aktarır.
10. `scripts/optimize-public-images.mjs`: Web görsellerini WebP formatına dönüştürür.
11. `scripts/rename-bots-female.mjs`: Veritabanındaki bot cinsiyet ve isim alanlarını güncelleyen tek seferlik bakım scriptidir.

---

## 4. Temizlik ve Veritabanı İzolasyonu Analizi

### "Garantili Temizlik" Yanılgısı
`test-chat-actions.mjs`, `test-community.mjs`, `test-ghost-request-wingman.mjs` ve `audit-qa-dating-flow.mjs` scriptlerinde `finally` bloklarının bulunması, geride artık veri kalmayacağını **garantilemez**:
- Supabase JS kütüphanesinde `await supabase.from(...).delete()` çağrısı bir JavaScript hatası fırlatmaz; `{ data, error }` nesnesi döndürür.
- İlgili scriptlerde `error` nesnesi kontrol edilmemekte ve `.throwOnError()` zincirlenmemektedir.
- Silme işlemi RLS yetkisi, ağ kopması veya yabancı anahtar (foreign key) kısıtı nedeniyle başarısız olursa, script sessizce tamamlanır ve veritabanında sahte test kayıtları kalır.

### "İzole DB Testi" Yanılgısı
Port 3000 veya 3015 gibi yerel adreslere HTTP isteği atan scriptler (`test-chat-actions.mjs`, `test-community.mjs`), arka planda `.env.local` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY` anahtarını kullanmaktadır:
- Eğer geliştirme ortamı yerel Docker/Supabase (Port 54321) yerine Supabase Cloud projesine bağlıysa, bu testler doğrudan uzaktaki canlı/staging veritabanı tablolarını (`messages`, `matches`, `profile_stories`) mutasyona uğratır.
- Bu nedenle bu scriptler "izole veritabanı testi" olarak nitelendirilemez; hedef ortam doğrudan ortam değişkenlerinin işaret ettiği veritabanıdır.

### Çıkış Kodu Güvenilirlik Riski
- `smoke-discovery.mjs`, `smoke-blog-seo.mjs` ve `audit-bot-behavior.mjs` scriptlerinde `assert` veya `process.exitCode = 1` denetimi bulunmamaktadır.
- `smoke-discovery.mjs` içinde aranan kart veya eşleşme başlığı ekranda bulunamasa bile `isVisible()` yalnızca `false` döner; script konsola `{ firstMatch: false }` yazdırarak **exit code 0 (başarılı)** ile kapanır.
- Bu scriptlerin CI boru hatlarında başarılı sonuç vermesi, testin geçtiğinin kesin bir kanıtı değildir.
