# Lovask proje devri

## 2026-10-06 yerel satış özellikleri ve APK dağıtım engeli

- Yerel kaynakta admin kullanıcı/bot sekmeleri ile insan/bot ve son 7/30 gün aktif insan sayıları eklendi. Kullanıcıya dönük web/Android metinlerinde bot ayrımı eklenmedi.
- Kaydedilmiş marka adı, slogan, destek e-postası ve logo web metadata/açılış, ortak marka bileşeni ve Android'in belirgin yüzeylerine bağlandı. Bazı hukuki/ürün ve sabit bildirim metinleri hâlâ Lovask adını kullanır; tam beyaz etiket dönüşümü değildir.
- Web ve Android keşfine ortak ilişki hedefi veya şehir verisiyle açıklanan günlük uyum kartı eklendi; mevcut keşif sırası ve kaydırma/geri alma akışı korunur. Günlük gösterim cihazdaki yerel kayıtla sınırlanır; cihazlar arası tek seçim garantisi yoktur.
- Etkinlik/katılım, özel buluşma planı/gönüllü durum/geri bildirim, Noir paket ve onaylı brüt gelir yönetimi, kupon taslakları ve zamanlanmış kampanya kartı yerel kaynakta hazırlandı. Kuponlar tahsilatta uygulanmaz; ödeme sağlayıcısı bağlantısı bekletildi. Bunların veritabanı geçişleri `072_community_events.sql`–`075_app_campaigns.sql` **üretime uygulanmadı**; web/API ve yeni Android kaynakları canlıya yayımlanmadı.
- Yerel `npm run verify` geçti (önceden bulunan 7 lint uyarısı); `flutter analyze --no-pub lib` temiz. Yeni veritabanı akışları henüz çalışan bir veritabanında uçtan uca denenmedi.
- Önceki 1.9.11 (39) imzalı APK'nin yerel SHA-256 özeti `91196A9A08DA1E97AD40289FA569971EECE9F2518ED8EB1D6EA312E0AC1FE0ED`. `lovask-apk.tgz` SCP ile sunucunun `/tmp` klasörüne aktarıldı; SSH parola isteminden sonra `Connection closed by 129.121.139.23 port 22` ve çıkış kodu 255 verdi. İstenen hata kuralı nedeniyle yeniden denenmedi. Canlı `/api/download/android` hâlâ `v=38`; `apk-20261004` başarı çıktısı veya `/var/www/lovask/.deploy-backups/pre-apk-20261004` yedeği doğrulanmadı. Aşağıdaki **Web canlıda (APK hariç)** maddesi bu yüzden tamamlandı olarak değiştirilmedi.

## 2026-10-04 genel denetim: Google girişi, admin yerleşimi, gerçek zamanlı akış

- Google: Açık kayıt açıkken yeni kullanıcı "Google ile giriş yap"a basınca hesap oluşturulup siliniyor ve "başvuru gerekli" hatası veriliyordu. Web `/auth/callback` ve mobil `/api/auth/mobile-oauth` artık açık kayıtta iki akışta da üyeliği onaylıyor. Başarısız denemede yalnızca o denemenin oluşturduğu (yalnız Google kimlikli, 10 dakikadan yeni) hesap siliniyor. İstemci Supabase yetkilendirme adresine doğru yönleniyor; Supabase Google sağlayıcısı ve yönlendirme izin listesi (`https://lovask.com.tr/**`, `lovask://auth-callback`) panelden ayrıca doğrulanmalı.
- Google sağlayıcısı Supabase'te kapalı: canlıda buton `Unsupported provider: provider is not enabled` (400) sayfasına gidiyordu. Web giriş sayfası ve `/api/auth/register` (Android bunu okur) artık `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` ile birlikte Supabase `/auth/v1/settings` içindeki `external.google` değerine bakıyor (5 dk önbellek); sağlayıcı kapalıysa buton "yakında"/"kullanılamıyor" olarak pasif. Girişi açmak için Supabase → Authentication → Providers → Google açılmalı, Google Cloud OAuth istemci kimliği/sırrı girilmeli ve Google istemcisine `https://jagqvyfnychnoxarebgv.supabase.co/auth/v1/callback` yönlendirmesi eklenmeli.
- Admin: `ops-stage` altında `.ops-content` dışında içerik kullanan sayfalarda (Büyüme, Başvurular, Fotoğraflar, Ödemeler, Blog) masaüstünde çift 240 px boşluk ve sağ taşma vardı; düzeltildi. 390 px'te Ayarlar ve Bot stüdyosu sekmelerindeki taşma giderildi.
- Keşif: Şehir merkezli mesafe aynı şehirde "≈ 0 km" gösteriyordu; 5 km altı "Yakınında" olarak gösteriliyor (web ve Android aynı API metnini kullanır).
- Gerçek zamanlı: Web'de yeni eşleşmeler `matches` INSERT ile anında listeye düşüyor. Android mesaj listesi `messages`/`matches` INSERT ile yenileniyor; yükleme sürerken gelen olay kaybolmuyor. Android Beğeniler sekmesine web ile aynı okunmamış beğeni rozeti eklendi.
- Demo: Oturumsuz `/demo` hikâye şeridi `/api/stories` 401 üretmiyor.
- Doğrulama: `npm run verify` geçti (mevcut 7 uyarı). `flutter analyze lib` temiz. `flutter test`'teki 19 başarısız test değişiklikten önce de aynıydı (golden/platform farkları). Canlıya yayın ve APK yapılmadı; veritabanı değişmedi.
- **Web canlıda (APK hariç).** 2026-10-04'te `remote-deploy.sh` ile `web-20261004b` etiketiyle yayımlandı (aşama derlemesi sunucuda ~18 dk). İlk deneme (`web-20261004`) servis 3005 dışında bir portta dinlediği için sağlık kontrolünde otomatik geri döndü; betik artık portu servisten okur. Canlı doğrulama: `/`, `/login`, `/download`, `/noir`, `/api/auth/register` 200; admin masaları 240 px'ten başlıyor; keşif mesafesi "Yakınında"; `/demo` hatasız. İndirme hâlâ `v=38` / 1.9.10 — sürüm metinleri ve 1.9.11 (39) APK bilerek gönderilmedi. Geri dönüş: `/var/www/lovask/.deploy-backups/pre-web-20261004b` (`source.tar`, `new-files.txt`, `next`).
- APK yayını için: Windows'ta `apps\mobile\build-release.ps1` ile 1.9.11 (39) derlenip imzalanmalı; ardından `public/lovask.apk`, `app/api/download/android/route.ts`, `app/download/page.tsx`, `components/landing-page.tsx` aynı betikle birlikte gönderilmeli (`scripts\deploy\deploy-release.ps1` bunu tek komutta yapar). Bulut oturumundan `129.121.139.23:22` erişilemiyor.
- Bilinen açık: Admin "Marka ve sistem ayarları" kaydediliyor ama web/Android bu değerleri okumuyor.

## 2026-10-03 web sohbet taşması ve sesli biyografi görünümü

- `hatalar/tasma-sorunu.png` görselindeki dar ekran sohbet taşması grid sütununun içerik tarafından genişletilmesinden kaynaklanıyordu. Sohbet sütunu ve iç bölgelerinin minimum genişliği sınırlandı; 320, 372, 390, 768 ve 1024 px yerel kontrollerde gönder düğmesi görünür ve yatay taşma yok. Canlı 372 px demo sohbet kontrolü de geçti.
- `hatalar/siyah-kısım.png` görselindeki koyu sesli biyografi kartı açık profil temasıyla uyumlu beyaz/lila karta dönüştü. Yerel açılır seçim yerine üç erişilebilir seçim düğmesi var; kayıt/yayınlama işlevi korunuyor. Canlı demo profilde üç seçim ve eski `select` bulunmaması doğrulandı.
- Yerel `npm run verify` ve sunucu aşama `npm run build` geçti; yalnız mevcut 7 lint uyarısı var. Canlı `/`, `/demo`, `/download` 200 ve `lovask.service` aktif. Veritabanı ve APK değişmedi. Geri dönüş: `/var/www/lovask/.deploy-backups/pre-ui-fixes-20261003` (`source.tar`, `next`).

## 2026-10-03 Android indirme çağrıları ve bot fotoğraf iltifatı düzeltmesi

- Ana sayfa ve giriş ekranında Android indirme çağrıları güçlendirildi. Giriş sonrası web uygulamasındaki kapatılabilir Android çağrısı tarayıcıda mobil ve masaüstünde görünür; Android uygulamasında gösterilmez. İndirme bağlantısı mevcut `/api/download/android` üzerinden kalır. Ana sayfadaki sürüm metni 1.9.10 olarak güncellendi; 3 günlük Noir koşulu ilk uygun cihaz kurulumu ve tamamlanan profille sınırlandı.
- Bot yanıtları için ortak yönerge profil fotoğrafına gelen genel iltifatları bağlama oturtuyor; metin/görsel yeteneği hakkında uygunsuz ret üretilirse yalnız genel iltifatta kısa teşekkür kullanılıyor. Görülmeyen fotoğraf ayrıntıları uydurulmuyor.
- `npm run verify`, aşama sunucusunda `npm run build` ve `scripts/test-bot-photo-compliment.mjs` geçti. Canlı `/` ve `/login` 200, yeni metinler sayfalarda görünüyor; APK yönlendirmesi `v=38`. Veritabanı ve APK değişmedi. Geri dönüş: `/var/www/lovask/.deploy-backups/pre-android-promo-20261003` (`source.tar`, `next`).

## 2026-10-03 Hermes Telegram yönetimi ve Android 1.9.10 (38)

- 2026-10-03 canlı destek bildirimi denemesi: işaretli QA kadın hesabı gerçek `/api/profile/support` POST ile talep açtı (201); Hermes `/lovask cevap` işleyicisi aynı talebe yönetici yanıtı kaydetti ve QA hesabının GET sonucunda yanıt görüldü. Hermes servisleri aktif, gönderim hatası loglanmadı. Geçici destek talebi ve mesajları temizlendi; yönetici denetim izi korundu. Telegram uygulamasındaki insan tarafı teslim görüntüsü sunucudan doğrulanamıyor.
- Lovask kayıt, ödeme bildirimi, destek/şikâyet, şifre sıfırlama/değiştirme ve sistem sağlığı olayları Hermes üzerinden Telegram'a bağlandı. Şifre değişikliği bildirimi yalnız başarılı sunucu güncellemesinden sonra gönderilir; sıfırlama ve şikâyet istekleri hız sınırındadır. Canlı bildirim HTTP 202 ile doğrulandı. `lovask`, `hermes-notifier` ve `hermes-gateway` servisleri aktif.
- Hermes'in tek izinli kullanıcısının özel sohbetine `/lovask destek`, `/lovask talep <id>`, `/lovask cevap <id> <yanıt>`, `/lovask odeme`, `/lovask onay <id> <Shopier-no> <tutar>` ve `/lovask bakiye` komutları eklendi. Destek/ödeme okuma komutları ve geçersiz siparişin reddi canlı sunucuda doğrulandı; gerçek destek yanıtı veya tahsilat onayı gönderilmedi. Shopier onayı yeni 071 geçişindeki servis işleviyle sipariş no/tutarı eşleştirir ve Noir hakkını atomik açar; gerçek ödeme panelde owner tarafından ayrıca doğrulanmalıdır.
- `/ai_bakiye` ve `/lovask bakiye` bot konuşma sağlayıcılarının bakiyesini okur; yeni kullanım limiti koymaz. DeepSeek bakiyesi okunabildi. OpenRouter hesap bakiyesi için `OPENROUTER_MANAGEMENT_KEY` sunucu ortamına eklenmeli; mevcut konuşma API anahtarı yalnız kendi kullanımını gösteriyor.
- İmzalı Android 1.9.10 (38) `https://lovask.com.tr/lovask.apk?v=38` adresinde. Yerel, sunucu ve CDN SHA-256: `7206081139B373A6E7B193AC9C1D7E633516BBAE1B08788080AC4155DFC7FF63`. Emülatör 5556'ya kuruldu, açıldı ve sürüm 38 görüldü. Next üretim derlemesi, tür denetimi, ilgili Flutter analizi, `scripts/test-ops-health.mjs`, Telegram komut kontrolü ve yetkisiz istek kontrolü geçti. Web/APK geri dönüşleri `/var/www/lovask/.deploy-backups` altında.

## 2026-10-02 canlı QA kontrolü

- Tam canlı rapor: `artifacts/qa/2026-10-02T20-49-22-928Z-e21ecf40/report.html`. 21 geçti, 0 başarısız, 5 engelli. Web doğrulaması, Flutter analizi ve 45 widget testi geçti; canlı web/API/admin, QA web→mobil mesaj ve Android 1.9.9 (37) üzerinde iki QA hesabının sırayla giriş/sekme gezintisi geçti.
- QA hesaplarıyla fotoğraflı sohbet, şifre kurtarma, yeni şifreyle giriş ve eski şifreye dönüş ayrı denendi. Geçici fotoğraf/eşleşme/mesaj temizlendi; QA çifti arasında kalan eşleşme, beğeni ve engel sayısı sıfır.
- CDN'den indirilen 62.270.056 bayt APK'nin SHA-256 özeti yerel iki yayın paketiyle eşleşti: `D1BC012726A0394AB04025C381A7E9D1BFF926250AB4FA6369EEA0B3A1CE9CE4`. İndirmeler bu bağlantıda 14,8–21,6 saniye sürdü; bir deneme bağlantı kesintisiyle sonlandı. İndirme güvenilirliği ve hızı izlenmeli.
- Beş engel: ikinci bağlı Android cihaz, gerçek push teslimi, gerçek Shopier tahsilatı, iki cihaz arasında canlı mesaj ve kontrollü otomasyon yanıtı. Fiziksel cihazla ilk kurulum/Noir hediyesi, Resend/Netgsm, gerçek selfie onayı ve gerçek üyelerle Boost sıralaması ayrıca açık. Bu kontrolde üretim kodu veya kalıcı üye verisi değiştirilmedi; yalnız `apps/mobile/test/goldens/noir-orders-bottom.png` güncel Noir görünümüne göre yenilendi.

## 2026-10-02 mevcut kaynak yayını

- Yerel web doğrulaması (lint, tür denetimi ve Next üretim derlemesi) geçti; yalnız mevcut 7 lint uyarısı kaldı. Canlı veritabanı migration kuru çalıştırması güncel bulundu; yeni migration uygulanmadı.
- Canlıdan farklı 16 kaynak dosyası geri dönüş arşivi alınarak yayımlandı: ödeme alanı, destek e-posta görünümü, ana sayfa güncellemesi ve yönetim/QA betikleri. Yayın sonrası kaynak karşılaştırması boş döndü. `lovask.service` aktif; `/download` ve `/noir` 200 döndü.
- Android 1.9.9 (37) APK yeniden imzalandı ve canlı paketle aynı SHA-256 özetini verdi: `D1BC012726A0394AB04025C381A7E9D1BFF926250AB4FA6369EEA0B3A1CE9CE4`. Canlı APK 62,270,056 bayt. Sunucu geri dönüş arşivi: `/var/www/lovask/.deploy-backups/current-20261002.tar.gz`.

## 2026-10-02 51 tek resimli bot profilinin eklenmesi (24 erkek, 27 kadın)

- Kullanıcının talimatıyla `botlar` klasöründeki numaralı çoklu klasörler atlanarak yalnızca şu 5 klasördeki tekil fotoğraflar işlendi: `erkek/20-28/tek-resim-erkek` (15), `erkek/40-55/tek-resim-erkek` (9), `kadın/18-30/tek-resim-kadın` (10), `kadın/40-50/tek-resim-kadın` (8) ve `kadın/50-60/tek-resim-kadın` (9). Toplam 51 yeni bot profili oluşturuldu.
- Canlı keşfedilebilir bot sayısı 383'ten 434'e çıktı (24 yeni erkek, 27 yeni kadın profili).
- Kullanıcının "bot test falan yazma" kuralına tam uyuldu: Hiçbir profil adında, bio'sunda, personasında veya buzkıran yanıtında "bot", "test", "demo", "yapay zeka" vb. ifadeler kullanılmadı; tüm profiller doğal ve özgün Türkçe kimliklerle yapılandırıldı.
- Her profile cinsiyet, yaş aralığından türetilen doğum tarihi, şehir, ilçe, boy, ilişki hedefi, medeni durum, çocuk tercihi, alışkanlıklar, niyet rozetleri (`profile_intentions`) ve buzkıran soru-cevapları (`profile_answers`) tanımlandı.
- Fotoğraflar Sharp ile 480, 960 ve 1440 px WebP formatında optimize edilerek Supabase Storage `profiles` bucket'ına yüklendi ve `profile_photos` tablosuna onaylı birincil görsel olarak işlendi (`moderation_status='approved'`, `processing_status='ready'`).
- `bot_personas` ve `bot_persona_versions` tablolarına `deepseek-v4-flash` / `inherit` ile uyumlu Türkçe sohbet direktifleri kaydedildi.
- Profiller `is_discoverable=true` ve `onboarding_completed=true` yapılarak web ve Android emülatöründe keşfedilebilir hale getirildi; karşılıklı keşif uygunluğu (`mutually_eligible`) doğrulandı.
- Betik `scripts/import_single_photo_bots.mjs` içinde arşivlendi. Uygulama kodu veya APK yayımlanmadı.

## 2026-10-02 kısa Noir paketi kapatıldı

- Kullanıcının “günlük paketi sil” talebindeki en yakın plan, uygulamada “1 Saatlik Noir” olarak gösterilen `noir-hourly` idi (`duration_days=1`, `duration_minutes=60`). 070 geçişiyle yeni satış için pasife alındı; sipariş ve hak geçmişi korundu. Web API'nin varsayılan listesi ve yeni sipariş şeması da saatlik paketi çıkardı. Haftalık ve aylık paketler aktif. Canlı API paket listesi `noir-weekly`, `noir-monthly`; `lovask.service` aktif.
- Yerel Next üretim derlemesi ve canlı web derlemesi geçti. Android yeniden derlenmedi; mobil plan listesi API'den geldiği için kapalı paket yeni oturumda gösterilmez.

## 2026-10-02 Shopier ürün bağlantısıyla manuel Noir ödemesi — 1.9.9 (37) canlı

- Shopier API'nin Lovask satışına uygun olmadığı yanıtı üzerine haftalık (`49985664`, 199 TL) ve aylık (`49836409`, 599 TL) Shopier ürün bağlantıları açıldı. Kullanıcı ödeme sonrası Shopier sipariş numarasını ve alıcı adını Noir ekranında bildirir; yalnız owner Shopier satıcı panelinde ödeme/tutarı doğrulayıp admin ödeme kuyruğundan Noir'ı açar. Aynı Shopier sipariş numarası ikinci kez inceleme/onay için kullanılamaz. Bildirim veya dekont tek başına erişim vermez; otomatik yenileme yoktur.
- 069 geçişi canlıya uygulandı; mevcut ödeme kayıtlarını ve Noir haklarını değiştirmedi. Shopier API OAuth bağlantı ve webhook uçları 410 döner; yönetim arayüzünden API bağlantısı kaldırıldı. Web ve imzalı Android 1.9.9 (37) yayımlandı. APK SHA-256 `D1BC012726A0394AB04025C381A7E9D1BFF926250AB4FA6369EEA0B3A1CE9CE4`; indirme `v=37`. Canlı `/noir` ve `/download` 200, eski API uçları 410, CDN APK özeti eşleşti, veritabanı migration listesi güncel. APK emülatör 5554'e kuruldu ve 1.9.9 (37) açıldı. Web geri dönüş arşivi `/var/www/lovask/.deploy-backups/pre-link37-20261002.tar`; önceki `.next` ayrıca `/var/www/lovask/.next-pre-link37` içinde.
- Gerçek Shopier kart tahsilatı ve owner panelinden sipariş karşılaştırıp onaylama henüz yapılmadı. Statik Shopier ürün başlıklarında eski sabit `LVK-C1C149FCED` ve `LVK-330E2043A7` kodları var; Shopier panelinde ürün adları bu kodlar olmadan güncellenmeli. Uygulamanın oluşturduğu Lovask kodu yalnız uygulama içi takip kodudur; Shopier sipariş numarası ödeme bildiriminde ayrıca girilir.

## 2026-10-02 Shopier API kapsamı düzeltmesi

- Shopier, Geliştirici Programı/API'nin kendi ürünümüzü kendi sitemizde satma amacıyla kullanılamayacağını yazılı bildirdi. Önceki OAuth kimlik bilgisi toplama ve API üzerinden otomatik Noir onayı planı iptal edildi; ilgili uçlar kapatıldı. Client ID/Secret aranmamalı ve bu entegrasyon etkinleştirilmemeli.
- Shopier'in normal ürün bağlantılarıyla manuel onaylı ödeme akışı canlıya alındı. Ürün bağlantısı ödeme sonucunu uygulamaya güvenilir biçimde bildirmez; otomatik tanımlama için kendi site/uygulama satışına uygun, imzalı ödeme bildirimi veren başka bir sağlayıcı gerekir.

## 2026-10-02 önceki Shopier API hazırlığı — artık geçersiz geçmiş kayıt

- Kullanıcının ödeme entegrasyonunu tamamlama talimatıyla `067_shopier_oauth_connection.sql` canlıya uygulandı. Öncesi `public,auth,storage` yedeği `/root/.lovask-secrets/pre-shopier-20261002.dump` içinde (118 tablo verisi kaydı); geçiş önce geri alınan işlemde denendi. Canlı migration kayıtları 067 ve 068 ile eşleşiyor. Yeni `shopier_connection` tablosu boş; mevcut ödeme siparişleri ve Noir hakları değiştirilmedi.
- Shopier OAuth, webhook, haftalık/aylık ödeme arayüzü ve yönetim bağlantısı için gereken web dosyaları canlı `129.121.139.23` sunucusuna aktarıldı. Aşama derlemesi ve HTTP denetimi geçti; canlı `/noir` 200, yapılandırılmamış webhook 503, oturumsuz yönetici bağlantısı 401. `lovask.service` aktif; havale açık, Papara/kripto kapalı, Shopier kart düğmesi bağlantı kurulana kadar gizli. APK 1.9.8 (36) değişmedi; SHA-256 `ED37C2BD4AC447AB94F95F91B7B1323131EFDD7FF6CB2B296587464B6D599ED4`, indirme `v=36`. Geri dönüş sürümü `/var/www/lovask-pre-shopier-ready-20261002` içinde.
- Shopier haftalık/aylık ürünlerinin herkese açık sayfalarında 199/599 TRY doğrulandı. Sunucudaki eski `SHOPIER_ACCESS_TOKEN` Shopier API'den 401 alıyor. Yeni bağlantı için `SHOPIER_CLIENT_ID`, `SHOPIER_CLIENT_SECRET` ve ilgili uygulamanın `SHOPIER_WEBHOOK_TOKEN` değeri gerekiyor; kullanıcı bunları bulacak. Shopier'de kayıtlı kök Redirect URI `https://lovask.com.tr/`, webhook `https://lovask.com.tr/api/shopier/webhook` (`order.created`), izinler `orders:read` ve `shop:read` olmalı. Shopier'in resmi dokümanına göre uygulama kimlik bilgileri oluşturulurken yalnız bir kez gösteriliyor; kayıpsa yeni uygulama/kimlik oluşturmak gerekir. Bilgiler geldikten sonra gizli sunucu ortamına kurulmalı, owner hesabıyla yönetim ekranında OAuth bağlantısı açılmalı, gerçek tahsilat/tekrar webhook/yanlış tutar-e-posta/iade kontrol edilmeli. İade hakkı otomatik geri alınmıyor.
- Yerel 9 Shopier doğrulama senaryosu ve tür denetimi geçti. Fiziksel cihazla ödeme akışı ve gerçek tahsilat olmadan otomatik hak tanımlaması doğrulanmış sayılmaz.
- Sunucu diskinde iki tam geri dönüş kopyası tutulduğu için yayın sonrası yaklaşık 6.6 GB boş alan (%93 doluluk) kaldı. Yeni tam aşama kopyası oluşturmadan önce eski sürüm yedeklerini gözden geçir.

## 2026-10-02 1.9.8 (36) canlı yayın — cihaz hediyesi ve kayıt geri dönüşü

- Kullanıcının açık talimatıyla Android kayıt adımlarına üst ok ve sistem geri hareketi eklendi; fotoğraf adımından önceki adıma dönülünce seçili bilgiler ve fotoğraflar korunuyor. Galeri/kırpma iptali fotoğraf eklemiyor. İmzalı 1.9.8+36 APK canlı `https://lovask.com.tr/lovask.apk?v=36` adresinde; SHA-256 `ED37C2BD4AC447AB94F95F91B7B1323131EFDD7FF6CB2B296587464B6D599ED4`.
- Canlı `129.121.139.23` sunucusunda yalnız Android Noir API, indirme ve gizlilik sayfaları ile APK güncellendi. Sunucu aşama derlemesi, `/download` 200, oturumsuz hediye isteği 401, yönlendirme `v=36`, CDN'den tam APK indirme özeti ve `lovask.service` aktifliği doğrulandı. İlk geçişte erken sağlık kontrolü otomatik geri döndü; bekleme düzeltmesinden sonraki ikinci geçiş başarılı oldu. Geri dönüş sürümü `/var/www/lovask-pre-device36-20261002` içinde.
- Canlı veritabanı `public,auth,storage` yedeği `/root/.lovask-secrets/pre-device-welcome-20261002.dump` içinde (117 tablo verisi kaydı). 068 geçişi önce geri alınan işlemde denendi; aynı cihaz kimliğinde ilk hesap `granted: true`, ikinci hesap `false`. Sonra yalnız 068 canlıya uygulandı; 067 Shopier geçişi bekliyor. Önceki Android Noir ödülleri 7, yeni cihaz rezervasyonu yayın hemen sonrasında 0. Gerçek cihazda iki e-posta/yeniden kurulum ve yetki kontrolü henüz yapılmadı. Doğrudan APK'de istemci cihaz kimliği değiştirilebildiği ve fabrika sıfırlaması kimliği değiştirebildiği için bu sınır kesin cihaz kanıtı değildir.
- Yerel `npm run verify` geçti (önceden mevcut 7 lint uyarısı), Flutter kayıt ekranı yerleşim testleri 10/10 ve geri hareketi/fotoğrafı koruma kontrolü geçti; analiz temiz. APK `emulator-5554` üzerine kuruldu, 1.9.8 (36) MainActivity ön planda açıldı. Fiziksel cihaz testi açık.

## 2026-10-02 Android cihaz başına tek Noir hediyesi — 1.9.7 (35) yerel aday

- Önceki oturumda `botlar` içindeki 52 fotoğraflı klasör canlıya kadın bot olarak aktarıldı (24/15/13 yaş grubu klasörü, 119 fotoğraf); canlı keşfedilebilir bot sayısı 331'den 383'e çıktı. `tek-resim` ve boş `18-30/25–30` klasörleri atlandı. Gerçek üye arzı işi hâlâ açık.
- Android cihazda ilk onaylı oturum açan hesaba, profilini tamamlayınca bir kez 3 gün Noir verecek akış yerelde hazırlandı. Android `ANDROID_ID` sunucu tarafında HMAC ile özetleniyor; `068_android_welcome_one_device.sql` cihaz başına ilk oturum kaydını ve ödülü atomik olarak tutuyor, eski doğrudan istemci RPC iznini kaldırıyor. Aynı cihazda ikinci e-posta ödülü alamıyor. Mevcut 7 ödül kaydı korunuyor; önceki cihazlarla ilişkilendirilemedikleri için eski alıcılar yeni APK ile ilk açılışlarında cihazlarına bağlanıyor.
- Yerel imzalı APK `artifacts/release/lovask.apk` ve `public/lovask.apk` içinde 1.9.7+35; SHA-256 `6BD204FABBA1DCBE1EEE23A9B44542216616625B75AAEE2931624732ADFA38D6`. Önceki 34 APK `artifacts/release/lovask-v34.apk` içinde. Web `npm run verify` geçti (önceden mevcut 7 uyarı); Flutter analizi, Android release derlemesi ve eski sertifika kontrolü geçti. `supabase/INSTALL.sql` 068 dahil yeniden üretildi.
- **Canlıya uygulanmadı.** `root@lovask.com.tr:22` SSH bağlantısı zaman aşımına uğradı. Sunucu API, 068 migration ve yeni APK birlikte yayımlanmalı. 066/067 geçişleri de yerelde beklediğinden toplu `supabase db push` bunları da uygular; yayın kapsamı ayrı değerlendirilmeli. Doğrudan APK dağıtımında Android kimliği normal e-posta değiştirme ve yeniden kurmayı sınırlar; değiştirilmiş istemci/fabrika sıfırlaması karşısında kesin cihaz kanıtı vermez. Gerçek cihazda iki e-posta ve yeniden kurma senaryosu hâlâ doğrulanmalı.

## 2026-10-02 1.9.6 (34) yerel aday ve test sonucu

- Android 1.9.6+34 eski yayın sertifikasıyla imzalandı; yerel `artifacts/release/lovask.apk` ve `public/lovask.apk` SHA-256 `B3E158501317128CC5B38CA2B6491BA926FA9CACB2C9F35F0EAFF40E2D48AD0E`. 5554 emülatöründe 33 üzerine güncelleme, 5556'da temiz kurulum ve iki cihazlı giriş/gezinme geçti. 5554'te uygulama ön planda; release sürümündeki `FLAG_SECURE` nedeniyle ADB ekran görüntüsü siyah, bu sürümün görsel incelemesi ayrıca açık.
- Tek komut raporu `artifacts/qa/2026-10-02T13-40-40-998Z-6784adfb/report.html`: 20 geçti, 4 engelli, 0 başarısız. Flutter analiz temiz; 45 widget testi geçti, 1 atlandı. Web lint/tür/üretim derlemesi geçti (önceden mevcut 7 lint uyarısı). Dokuz Shopier doğrulama senaryosu geçti.
- Bir fotoğraf kuralının Android açıklaması düzeltildi; destek e-postasının açık temadaki karşıtlığı, dar ekrandaki sohbet hata alanı ve eski Noir API yanıtında Android Shopier planlarının görünmesi düzeltildi. Widget testinin boş Supabase tanımlarıyla çalışması test komutuna eklendi. Yerel indirme yönlendirmesi `v=34`.
- **Bu aday canlıya aktarılmadı.** Shopier OAuth/webhook ve gerçek tahsilat/iade mutabakatı doğrulanmadı; 067 migration ve sunucu kurulumu açık. Gerçek push teslimi, otomatik iki cihazlı mesaj senaryosu ve canlı otomasyon yanıtı da raporda engelli. Fiziksel Android cihaz yok; Resend/Netgsm bilgileri kullanıcı isteğiyle şimdilik bekliyor ve doğrulama kanalları kapalı. Önceki 33 APK yedeği proje dışında `C:\MAMP\htdocs\lovask-apk-backup-20261002-v33` içinde. Kullanıcı arayüzüne bot etiketi eklenmedi.

## 2026-10-02 1.9.5 (33) yerel yayın adayı ve kalan doğrulamalar

- Bot etiketi kapsam dışı bırakıldı. Web doğrulaması ve 44 Flutter testi geçti (1 atlandı). Canlı QA hesaplarıyla web–mobil–admin eşleşmesi, metin/fotoğraf sohbeti, 13 admin sayfası ve dönüşüm API'si doğrulandı. Testler sonrası geçici kayıtlar temizlendi; 10 yetim QA dönüşüm olayı da kaldırıldı. Gerçek keşfedilebilir insan profili hâlâ 7, aktif Boost 0.
- İmzalı 1.9.5 (33) APK yerelde `artifacts/release/lovask.apk` ve `public/lovask.apk` içinde, SHA-256 `65B407FF60158F8BAEAB70AF1E8D2721E67505F9F78BF46DB060057227A1903D`. Birinci emülatörde güncelleme, ikincisinde temiz kurulum ve süreç açılışı doğrulandı; önceki 32 adayının görsel ana ekranı doğrulanmıştı. 33'ün görsel açılışı ve fiziksel cihaz testi açık. Ayrıntılar `docs/qa/release-candidate-20261002.md`.
- Üye edinimi için `docs/marketing/real-member-acquisition-20261002.md` planı hazır; kampanya/harcama başlamadı. QA kurtarma bağlantısıyla webde parola değişimi ve eski parolaya geri dönüş geçti. Kullanıcı güncel **6–128 karakter** şifre kuralını onayladı; eski “tam 6” notu geçersiz. Resend/Netgsm bilgileri yok ve kullanıcı bunların şimdilik kalmasını istedi; doğrulama kanalları kapalı. Gerçek cihazda Noir hediyesi/push/kırpma/hız, gerçek selfie onayı, şifre sıfırlama e-postası, gerçek Boost sıralaması ve Shopier canlı mutabakatı açık. **Bu aday canlıya alınmadı.**

## 2026-10-02 Shopier yerel entegrasyon adayı

- Haftalık/aylık Shopier ürün bağlantıları, mevcut `orders:read`/`shop:read` izinleri ve kayıtlı kök Redirect URI ile OAuth bağlantı akışı yerelde hazırlandı. `products:write` ve `refunds:read` kullanılmıyor. İmzalı webhook, Shopier sipariş/işlem doğrulaması ve e-posta eşleşmesiyle Noir onayı eklendi; saatlik Shopier kapalı.
- `067_shopier_oauth_connection.sql` migration'ı, gizli token saklama ve yönetim ekranı bağlantısı hazır. `docs/qa/shopier-integration-20261002.md` yayın öncesi adımları ve engelleri içeriyor. Lint, tür, üretim derlemesi, 9 ödeme senaryosu ve Flutter Noir ekranı analizi geçti.
- **Canlıya alınmadı.** OAuth yetkilendirmesi, ürün fiyatları, gerçek webhook/ödeme ve iade etkisi doğrulanmadı. Sağlayıcı sırları kaynak dosyalarına yazılmadı; sunucu ortamına kurulmaları gerekiyor.
- Shopier'e geçmeden önce Lovask `LVK-...` referansı web ve Android'de gösterilir. Sabit ürün linki referansı Shopier'e otomatik taşımaz; farklı ödeme e-postası otomatik Noir onayı vermez. Yayın adımında web/API, migration, imzalı APK ve indirme bağlantısı birlikte güncellenmeli.

## 2026-10-01 Android hız ve fotoğraf kırpma adayı — 1.9.3 (31)

- Android açılışındaki 2760 ms zorunlu bekleme kaldırıldı. Üyelik durumundan sonra hesap ve profil sorguları eşzamanlı başlıyor. Ana sekmeler ilk ziyarette oluşturuluyor; ziyaret edilen sekmenin durumu korunuyor. Mesaj listesi ve buluşma zamanlayıcıları sekme görünmüyorken sorgu yapmıyor. Keşifte sıradaki kart fotoğrafı önden belleğe alınıyor. Küçük ekrandaki sohbet hata alanı kaydırılabilir yapıldı.
- Kayıt ve profil fotoğrafı ekleme akışlarına Android kırpma ekranı eklendi. Emülatör `emulator-5554` üzerinde galeri → “Fotoğrafı kırp” ekranı açıldı; iptal sonrası yükleme başlamadı. Seçilen JPG, PNG, WebP ve HEIC/HEIF kaynakları profil fotoğrafı API'sinde 480/960/1440 px WebP olarak saklanıyor; başka biçimler kabul edilmiyor. Önceki canlı PNG yükleme testi `docs/qa/auth-20260930.md` içinde.
- Flutter analiz temiz; izole ayarla (`--dart-define=SUPABASE_URL= --dart-define=SUPABASE_ANON_KEY=`) tam Flutter test takımı **44 geçti, 1 atlandı**. Eski varlık/görünüm beklentileri güncellendi; küçük ekranda sohbet satırı taşması düzeltildi. Web `npm run verify` geçti (önceden var olan 7 lint uyarısı). Fiziksel cihaz performans ölçümü henüz yapılmadı.
- İmzalı 1.9.3 (31) APK `artifacts/release/lovask.apk` ve yerel `public/lovask.apk` içinde; SHA-256 `C83C8E6A6478ABEA4DFE4D12859B03DBE3C90B290D74C32121B16172CF336218`. Emülatörde güncelleme sonrası keşif/mesaj/profil açıldı. Eski yerel APK `C:\MAMP\htdocs\lovask-mobile-pre-20261001\lovask-public-v30.apk` içinde.
- Canlı sunucuda `/var/www/lovask/.deploy-backups/pre-mobile-1.9.3-20261001` içine önceki APK, indirme yönlendirmesi ve `.next` derlemesi kopyalandı. Ayrı `/var/www/lovask-stage-ux31` derlemesi geçince APK ve yönlendirme yayına alındı; çalışma derlemesindeki `sharp` bağı canlı `node_modules` içine bağlandı. `lovask.service` aktif. `https://lovask.com.tr/api/download/android` 302 ile `lovask.apk?v=31` adresine gidiyor, indirme sayfası 200 dönüyor; CDN'den tam APK indirme özeti yerel imzalı paketle eşleşti. Veritabanı migration'ı yapılmadı. Geri dönüşte yedekteki `route.ts`, `lovask.apk` ve `next` kopyalanıp hizmet yeniden başlatılabilir.

## 2026-09-30 canlı kullanıcı yolculuğu

- Gerçek web kayıt formu, canlı kayıt/giriş/profil/fotoğraf doğrulamaları, web üzerinden bot beğenisi, iki işaretli QA hesabı arasında web→mobil sohbet ve Android 1.9.2 (30) emülatör girişi/sekme gezintisi denendi. Ayrıntı ve kapsam dışı kontroller: `docs/qa/live-user-journey-20260930.md`.
- Test hesapları ve etkileşim kayıtları temizlendi. İşaretli QA A/B ve adı açıkça test profili olan sekiz profil keşfedilebilir olmaktan çıkarıldı. Canlı keşifte tamamlanmış 7 insan ve 331 bot profil kaldı.
- QA A hesabının canlı keşif listesindeki ilk 12 profilin tamamı bot; API `isBot` gönderiyor ama Android/web ekranında yapay zekâ etiketi görünmüyor. Reklamı ölçeklemeden önce bu açıklık ve düşük gerçek üye arzı çözülmeli.

## 2026-09-30 kayıt akışı canlı düzeltmesi — 1.9.2 (30)

- Bu tarihli kayıt akışında **tam 6 karakter** kullanıldı; 2026-10-02'de kullanıcı güncel **6–128 karakter** kuralını onayladı. Mevcut uzun şifreli üyelerin girişi sürüyor. Kayıt, giriş, profil ve fotoğraf için eksik/geçersiz alan hataları kullanıcıya gösteriliyor. İndirme yönlendirmesi eski `v=28` yerine `https://lovask.com.tr/lovask.apk?v=30-final` adresine döndü.
- Canlıda üç ayrı geçici QA hesabıyla kayıt, giriş, profil kaydı ve PNG fotoğraf yükleme geçti. Kısa/uzun/eşleşmeyen şifre, geçersiz e-posta, yanlış giriş, eksik profil/fotoğraf, geçersiz fotoğraf ve onay bekleyen fotoğraf hataları kontrol edildi. Üç QA hesabı, test storage dosyaları ve altı QA dönüşüm olayı silindi; kalan `QA Live Test` profili 0. Fotoğraf onayı verilmedi, keşfe çıkmadılar.
- Web lint/tür/derleme, Flutter analiz ve canlı public denetim geçti. APK 1.9.2 (30) eski yayın sertifikasıyla imzalandı; sunucu/CDN SHA-256 `51B44765608E261F8287A9EB835F10FC6AC28B44AB9CF0C434374D0AACD99E9F`. Emülatöre kuruldu, kayıt ekranı ve alan hatası pencere görüntüsüyle doğrulandı: `artifacts/release/emulator-registration-1.9.2-final.png`. ADB screencap siyah döndüğünden pencere yakalama kullanıldı. Gerçek cihaz testi henüz yapılmadı.
- Kaynak/servis geri dönüşü: `/var/www/lovask/.deploy-backups/pre-auth-1.9.2-20260930.tgz`, `next-pre-1.9.2-20260930`, `next-pre-download-v30-20260930`, önceki APK `lovask-pre-1.9.2.apk`. Bu yayında DB migration yok. Ayrıntılı canlı test raporu: `docs/qa/auth-20260930.md`.

## 2026-09-30 canlı yayın — 1.9.1 (29)

- Kullanıcının açık yayın talimatıyla web/API, Supabase 064–065 geçişleri ve imzalı Android 1.9.1 (29) `https://lovask.com.tr/lovask.apk?v=29` canlıya alındı. APK SHA-256: `C69700CD9BAA835A73EE30402D4EFDEB48EADDAC5B131D4E6F3EBBED6F2416A7`. CDN tam indirme özeti eşleşti; public denetim ve yetkisiz admin 401 kontrolü geçti.
- Geçişlerden önce canlı `public,auth,storage` veritabanı dökümü `/root/.lovask-secrets/pre-release-20260930-full.dump`, web yedeği `/var/www/lovask/.deploy-backups/pre-1.9.1-20260930.tgz`, önceki APK `/var/www/lovask/.deploy-backups/lovask-pre-1.9.1.apk` ve önceki `.next` `/var/www/lovask/.deploy-backups/next-pre-1.9.1-20260930` alındı. Döküm storage dosya içeriklerini kapsamaz.
- 064 ve 065 önce canlı veritabanında geri alınan işlemle denendi, ardından `supabase db push --linked --yes` ile uygulandı. Web aşama derlemesi ve HTTP denetimi geçti. Sunucudaki `lovask.service` aktif.
- İmzalı APK emülatöre kuruldu ve süreç açıldı; uygulama ekran görüntüsü siyah kaldı. Emülatör ana ekranı normaldi. Impeller kapalı 1.9.2 deneme paketi de siyah kaldığından yayımlanmadı; kaynak ve yerel yayın APK'si 1.9.1'e geri getirildi. Görsel açılış ve gerçek cihaz akışları doğrulanmış sayılmaz.
- Bilinen yayın riskleri ve test kapsamı `docs/qa/release-20260930.md` ile `docs/qa/security-20260930.md` içindedir. Önceki aşağıdaki “yayın adayı/canlıya alınmadı” kaydı yayın öncesi durumdur.

## 2026-09-30 yayın adayı (canlıya alınmadı)

- Bir onaylı fotoğraf kuralı, admin edinim sayaçları ve ödeme/sağlık düzeltmeleri yerel kaynakta hazırlandı. `064_growth_metrics.sql` ve `065_single_approved_profile_photo.sql` canlı veritabanına uygulanmadı.
- İmzalı Android 1.9.1 (29) aday APK: `artifacts/release/lovask.apk`, SHA-256 `C69700CD9BAA835A73EE30402D4EFDEB48EADDAC5B131D4E6F3EBBED6F2416A7`. Canlıdaki `public/lovask.apk` değiştirilmedi.
- Test, güvenlik bulguları, yayın engelleri ve geri dönüş: `docs/qa/release-20260930.md` ve `docs/qa/security-20260930.md`. Yerel test raporu `artifacts/qa/latest.html`; 8 geçti, 1 başarısız, 4 engelli.
- Proje dışı kaynak yedeği: `C:\MAMP\htdocs\lovask-pre-release-20260930`. Geçici mükerrer dosya silmesi otomatik güvenlik incelemesinde reddedildi; envanter `artifacts/release/cleanup-inventory.txt`.

## Son aşamada yapılacaklar

- APK 1.9.11 (39) dağıtımı SSH bağlantısı parola sonrasında kapandığı için durdu. Sunucu SSH nedenini inceleyip kullanıcı talimatıyla aynı `remote-deploy.sh` adımını yeniden planla; başarılı yayın, `v=39` yönlendirmesi, CDN SHA-256 eşleşmesi ve `/var/www/lovask/.deploy-backups/pre-apk-20261004` yedeği doğrulanmadan APK canlı sayılmamalı.
- Yerel satış özellikleri için 072–075 veritabanı geçişlerini incele ve uygun yedek/test sürecinden sonra üretime uygula; etkinlik/özel plan/kampanya akışlarını gerçek hesapla uçtan uca doğrula. Yeni Android kaynaklarını yeni sürüm numarasıyla mevcut imzalama anahtarıyla derleyip ancak sonra yayımla. Kupon tahsilatı ödeme sağlayıcısı seçilene kadar taslak kalır.

- Telegram'daki `/lovask` komutunu owner hesabından gerçek mesajla dene; gerçek bir destek talebine yanıtı ve Shopier panelinde doğrulanmış gerçek ödemeyi Noir açılarak uçtan uca doğrula. OpenRouter hesap bakiyesinin Telegram'da görünmesi istenirse yönetim anahtarını sunucu ortamına güvenli biçimde ekle.

- Shopier haftalık/aylık ürün başlıklarındaki eski sabit `LVK-...` kodlarını kaldır; gerçek bir kart ödemesini satıcı panelinde sipariş numarası/tutar/durumla eşleştirip owner olarak Noir onayını uçtan uca doğrula. Shopier API/OAuth planı uygulanmamalı. Kart ve havale yöntemleri manuel onaylıdır.
- Reklam bütçesini ölçeklemeden önce gerçek üye arzını artır. Son canlı sayımda tamamlanmış 25 insan profili ve 434 bot var; keşfedilebilir gerçek insan sayısı ayrıca güncellenmeli. Bot etiketi son web/Android kullanıcı arayüzünde görünmüyor.
- Android 1.9.9 (37) sürümünde gerçek cihazla ilk kurulum ve indirme → kayıt → profil tamamlama → tek seferlik 3 gün Noir akışını doğrula; aynı cihazda ikinci e-posta, yeniden kurma, fotoğraf kırpma/iptal ve performansı da ölç. Emülatör ve geri alınan veritabanı işlemi cihaz başına ödül kuralının fiziksel cihaz kanıtı değildir. Admin indirme sayacı tamamlanmış kurulum sayısı değildir.
- Yönetim panelinde Resend/Netgsm bilgilerini kaydet ve gerçek ortamda e-posta/SMS gönderimini uçtan uca dene. Kullanıcı ayrıca istemedikçe iki doğrulama kanalını kapalı tut.
- Selfie onayı, fotoğraflı sohbet, şifre sıfırlama ve dönüşüm panelini gerçek hesaplarla uçtan uca doğrula. Boost başlatma ve haftalık hak kontrolü canlı veritabanında geri alınan işlemle doğrulandı; keşif sıralamasını gerçek üyelerle ayrıca kontrol et.

## 2026-09-30 keşif fotoğraf galerisi yayını

- 2026-09-30 yerel profil önizlemesi: Kullanıcının 03:36'da değiştirdiği `apps/mobile/lib/screens/profile_detail_screen.dart`, 03:21'deki APK'den yeniydi. Yeni imzalı yerel APK yeniden derlendi (`public/lovask.apk`, SHA-256 `79FEFE86B284DEE97D47D0E6AF65916491D75A894DEB8E535A233E6EC4F6405F`); canlı sürüm henüz bu yeniden derlemeyle değiştirilmedi. Android 37.1 önizleme emülatöründe Impeller açıkken siyah ekran görüldü; ayrı `lovask-render-check` emülatöründe Impeller kapalı debug profil önizlemesi açıldı ve `artifacts/qa/lovask-profile-preview.png` ile görsel kontrol edildi. Önizleme örnek profil verisi kullanır.
- Şehir bazlı mesafe metni kaldırıldı; keşif kartı ve profil ayrıntılarında yalnızca `≈ km` mesafesi gösteriliyor. Profilin “Onun dünyasında” bölümü web ve Android’de görsel referanstaki tek satırlı, ikonlu bilgi kartları düzenine getirildi. Web ve imzalı Android 1.9.0 (28) canlıda; APK SHA-256: `EA8DF2C8901605743BDD4701BB8161E88045D55953621E80C1F937D6AF0370FE`. Emülatör 5554'e kuruldu ve açıldı. Canlı public denetim geçti. Geri dönüş kopyası: `/var/www/lovask-pre-profile-layout-20260930`.
- Web ve Android profilleri, sohbet başlıkları, keşif kartları ve tanıtım metinlerinden karakter kaynaklı etiketler kaldırıldı. Web ve imzalı Android 1.8.9 (27) canlıda; APK SHA-256: `52956576F87E28EB3A10A14C02BCBB9F488B9FB676CA53143BE4DB339AD4CF57`. Emülatör 5554'e kuruldu ve açıldı. Canlı public denetim geçti. Geri dönüş kopyası: `/var/www/lovask-pre-remove-label-20260930`.
- Web ve Android keşif kartında her dokunuş sonraki fotoğrafı gösteriyor; son fotoğraftan sonraki dokunuş profil ayrıntısını açıyor. Karttaki çevrimiçi durum yeşil, kısa süre önce aktif olma durumu turuncu. Şehir ve mesafe metinleri keşif kartından kaldırıldı.
- Web ve imzalı Android 1.8.8 (26) canlıda. APK SHA-256: `EBCC9E8AA8906F81D3CE4DD9BFF41B91A8EACD0EF4F9CDAEF91805BB780D0951`; CDN tam indirme özeti eşleşti. Web `npm run verify`, Flutter analiz ve canlı public denetim geçti. Veritabanı değişmedi. Geri dönüş kopyası: `/var/www/lovask-pre-gallery-20260930`.

## 2026-09-30 keşif, çevrimiçi durum ve bildirim yayını

- Web keşif ekranı APK düzenine yaklaştırıldı; botların çevrimiçi/çevrimdışı bilgisi otomasyon saatlerinden keşif, beğeni ve mesaj listelerine taşındı. İnsan son görülme gizliliği için mevcut Noir kuralı korundu.
- Eşleşme penceresi ve kısa bildirimler yaklaşık 6 saniyede kapanıyor; X ve kaydırarak kapatma eklendi. Android SnackBar bildirimleri de 6 saniye, X ve yatay kaydırma kullanıyor.
- Web/API ile aynı yayın sertifikasıyla imzalı Android 1.8.7 (25) canlıda. APK: `https://lovask.com.tr/lovask.apk?v=25`; SHA-256: `139D093EEBB7A4C94C580F09C925FE9594E80D8644A4CCEF2F26194F9582EC3E`. CDN tam indirme özeti eşleşti.
- Yerel `npm run verify`, `flutter analyze lib`, ilgili Flutter testleri ve bildirim tarayıcı testi geçti. Canlı public denetim ve oturumlu keşif API kontrolü geçti. Emülatöre önceki 1.8.6 sürümü kuruldu, fakat emülatör ekranı siyah kaldığından son APK görsel olarak gerçek cihazda ayrıca kontrol edilmeli. Bu yayında veritabanı değişikliği yapılmadı.
- Geri dönüş kopyası: `/var/www/lovask-pre-notices-20260930`.

## 2026-09-29 Noir tanıtım yayını

- Ana sayfaya Noir menü bağlantısı, 3 gün hediye duyurusu, ücretsiz deneyim ile Noir farklarını anlatan bölüm ve Android alanına kısa Noir kartı eklendi. İndirme sayfasında hediye koşulu ve somut Noir avantajları gösteriliyor; tüm ayrıntılar `/noir` sayfasına bağlı.
- Yerel `npm run verify` geçti (yalnızca önceden var olan 6 `<img>` uyarısı). 390 px ve 1365 px ekranlarda görsel kontrol ve yatay taşma denetimi yapıldı. Canlı `audit-public` geçti; `/`, `/download`, `/noir` 200 döndü. Veritabanı, APK ve üyelik hakkı mantığı değişmedi.
- Geri dönüş kopyaları: `/var/www/lovask-pre-noir-promo-20260929` ve `/var/www/lovask-pre-noir-promo-fix-20260929`.

## 2026-09-29 Android edinim yayını

- Web/API ve aynı Lovask yayın sertifikasıyla imzalı Android 1.8.5 (23) canlıya alındı. Reklam için bağlantı: `https://lovask.com.tr/download?utm_source=instagram`.
- İndirme sayfası ve ana sayfa 3 günlük Noir hediyesini açık koşullarıyla anlatıyor. Hediye tamamlanmış insan profilinin ilk Android oturumunda, hesap başına bir kez tanımlanıyor. Keşif/profil/sohbet ekranlarında yapay zekâ karakterleri etiketleniyor.
- Admin büyüme sayfası APK indirme başlangıcı ve hediye tanımlanan hesap sayılarını gösteriyor. QA indirme/hediye kayıtları temizlendi; sayaç yayından sonraki izlenen bağlantılarla sıfırdan başlıyor.
- Canlı 063 geçişi uygulandı; 001–063 dosya/ledger karşılaştırmasında eksik, fazla veya isim uyuşmazlığı yok. Geçiş önce geri alınan işlemde, tek seferlik ödül akışı ayrıca canlı QA hesabında doğrulandı.
- Veritabanı yedeği: `/root/.lovask-secrets/pre-android-welcome-20260929.dump`. Eski web sürümü yedeği: `/var/www/lovask-pre-android-welcome-20260929`; yönlendirme düzeltmesi öncesi sürüm: `/var/www/lovask-pre-redirect-fix-20260929`.
- APK SHA-256: `A7E84FA6541F95EC3356129D255F051921D97C494FD4E09739AE533BFC571714`. CDN üzerinden tam indirilen dosya özeti yerel imzalı paketle eşleşti. Canlı public/API denetimleri ve admin büyüme API'si geçti.

## 2026-09-29 canlı yayın

- Web/API ve aynı yayın sertifikasıyla imzalı Android 1.8.4 (22) canlıya alındı. APK: `https://lovask.com.tr/lovask.apk?v=22`.
- Supabase 001–062 migration kayıtları ve dosya adları eşleşiyor; eksik sürüm yok. 059–062 bu yayında uygulandı. 062, Noir olmayan hesaplarda Boost hakkının `null` yerine `false` dönmesini sağlıyor.
- Üretim dosya yedeği: `/var/www/lovask/.deploy-backups/pre-release-20260929-183643.tgz`.
- Migration öncesi veritabanı yedeği: sunucuda `/root/.lovask-secrets/pre-migration-20260929-184940.dump`; ikinci kopyası yerel `C:\Users\USER\.lovask-secrets` içinde.
- `VERIFICATION_SETTINGS_KEY` sunucuda tanımlandı; güvenli kopyası sunucuda ve yerel `C:\Users\USER\.lovask-secrets\verification-settings-key` dosyasında. E-posta ve SMS doğrulaması kapalı; sağlayıcı anahtarları henüz verilmedi.
- Canlı QA hesabıyla hesap, Boost, doğrulama durumu, keşif, konuşmalar ve Noir API uçları 200 döndü; doğrulama kanalları kapalı doğrulandı. İmzalı APK 1.8.4 (22) emülatöre kuruldu. CDN üzerinden tam indirilen APK'nin SHA-256 özeti sunucudaki imzalı paketle eşleşti: `D9A6797257B39EBEEFEC957E2C45386629E7199815C7F796056F336DC5321D54`.

Bu işler uygulama geliştirmesinin sonunda ele alınacak üretim kurulum adımlarıdır. Tamamlanan maddeyi listeden çıkar.
