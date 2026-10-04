# Web–admin–mobil doğrulaması — 28 Eylül 2026

Kontroller ek ajan kullanılmadan yapıldı. Bu dizinde `.git` bulunmadığından önceki değişikliklere karşı Git diff üretilemedi.

## Düzeltilenler

- Web keşif düğmeleri mutlak konumlandırma nedeniyle alt menünün altında kalıyordu. `components/lovask-app-light.css` içinde normal yerleşim akışına alındı. `scripts/audit-core-local.mjs` artık 320×568, 390×844 ve 480×844 ekranlarda dört düğmenin gerçek tıklama hedeflerini denetliyor.
- `scripts/test-e2e-sync.mjs` ayrı web ve mobil oturumlarını karşılaştırıyor. Admin giriş hatası veya eksik kimlik bilgisi atlanmıyor; 404 başarı sayılmıyor. Admin kullanıcı detayı, standart hesabın 403 yanıtı, hesap/tercih/sohbet verileri ve görünürlük değişikliğinin diğer oturumlara yansıması doğrulanıyor. Değişiklik yalnızca yapılandırılmış `codex-test-` hesabında yapılıyor ve `finally` ile geri yükleniyor.
- Aynı test oturumlu web profilini ve admin kullanıcılar ekranını Edge içinde açıp beklenen içerik ve çalışma zamanı hatalarını denetliyor. Yerel hedef için `LOVASK_BASE_URL` ortam değişkeni kullanılabiliyor.

## Geçen kontroller

- `npm run verify`: lint (0 hata, mevcut 6 img uyarısı), TypeScript ve üretim build geçti. CSS düzeltmesinden sonra build ve yerel tarayıcı kontrolü tekrar geçti.
- `flutter analyze`: sorun yok.
- `flutter test --reporter expanded`: 39 test geçti; varsayılan koşuda canlı test atlandı. Dar ekranlar, 1.6 yazı ölçeği, klavye, güvenli alanlar ve golden karşılaştırmaları geçti. Golden referansları değiştirilmedi; mevcut mobil düzeltmeler yeterliydi.
- `test/live_api_test.dart` ayrıca gerçek kimlik bilgileri ve yalnızca public Dart bağlantı tanımlarıyla çalıştırıldı: Flutter API istemcisinde giriş, veri okumaları, token yenileme, çıkış ve çıkıştan sonra 401 kontrolü geçti.
- Profil/presence/fotoğraf sözleşme testi, sohbet gizleme/yeniden açma hata yolları ve handoff dışlama testi geçti.
- Güçlendirilmiş oturumlu senkronizasyon testi hem `http://localhost:3100` hem `https://lovask.com.tr` üzerinde geçti. Test hesabının görünürlük değeri geri yüklendi.
- Yerel tarayıcı kontrolü: genel sayfalar/başlıklar, mobil keşif tıklamaları, demo eşleşme/mesajlaşma, onboarding yönlendirmesi ve yetki korumaları geçti.
- Canlı genel sayfa kontrolü: blog, metadata, canonical, sitemap, robots, görseller, manifest ve APK bağlantısı geçti.

## Temizlik ve teslim

- 42 dosya, toplam 34.136.395 bayt (32,6 MiB), Windows Geri Dönüşüm Kutusu'na taşındı; geri alınabilir.
- Bunlar 32 eski golden hata görseli, `tmp/community-150.tgz`, üç eski APK imza yan dosyası, iki `before-swipe` Dart kopyası, üç `live-*` kaynak kopyası ve `tmp/patch.diff` idi.
- Geçici dizindeki bakım/dağıtım betikleri, başka projeye ait araştırma verileri ve geliştirme bağımlılıkları korunmuştur. İlk aday CSV tarihsel envanterdir; tüm girdileri silme listesi değildir.
- `lovask-customer-handoff.zip` yeniden üretildi. Gerçek arşivin CRC bütünlüğü, yasak secret/build dosya yollarının bulunmaması ve imzalama betiğinin korunması doğrulandı. Bu kontrol, dosya içeriklerindeki her olası sırrı tarayan bir güvenlik denetimi değildir.

## Canlı sonuç ve sınırlar

- Canlı tarayıcı testi, keşif düğmelerinin alt menü tarafından engellendiğini doğruladı. CSS düzeltmesi yerelde test edildi; **bu çalışmada dağıtım yapılmadı ve hata canlıda sürüyor**.
- Canlı APK tam olarak 60.561.989 bayt indirildi ve doğru MIME türüyle sunuldu. Tek ölçüm 20,376 saniye / yaklaşık 2.903 KiB/sn oldu; mevcut 10 saniye eşiği geçilemedi. Tek istemci ölçümü sunucu darboğazını kanıtlamaz.
- Flutter canlı kontrolü test çalıştırıcısındaki gerçek istemciyle yapıldı. Fiziksel Android/iOS cihazında kurulu uygulamayı web/admin arayüzleriyle eşzamanlı kullanarak yapılan tam cihaz E2E testi değildir.
- Sonuçlar test edilen akışlara aittir; bütün ürün davranışları veya canlıdaki kodun yerel kaynakla birebir eşitliği için garanti oluşturmaz.
