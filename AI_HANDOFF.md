# Lovask — AI devir özeti

> Snapshot tarihi: 14 Ağustos 2026, Europe/Istanbul  
> Canlı adres: https://lovask.com.tr  
> Bu dosya yeni bir geliştirici veya AI tarafından **ilk olarak** okunmalıdır.

## 1. Projenin mevcut durumu

Lovask; mobil öncelikli, premium görsel dile sahip bir tanışma uygulamasıdır. Üretim uygulaması Next.js 16 App Router, React 19, Supabase ve PM2 üzerinde çalışır. Web uygulaması aynı zamanda PWA'dır; Android sürümü Trusted Web Activity (TWA) olarak paketlenmiştir.

Snapshot alınırken aşağıdaki doğrulamalar başarılıydı:

- `npm run typecheck`: 0 hata
- `npm run build`: başarılı
- Canlı `/noir`: HTTP 200
- Canlı uygulama süreci: PM2 üzerinde `lovask`, online
- Canlı service worker: `/sw.js`
- Android Digital Asset Links: `/.well-known/assetlinks.json`

Bu paket canlı veritabanı satırlarını, kullanıcı medyalarını veya gerçek environment secret değerlerini içermez. Şema ve davranışın kaynağı `supabase/migrations` dizinidir.

## 2. Önce okunacak dosyalar

1. `AGENTS.md` — kullanılan Next.js sürümünün yerel kuralları
2. Bu dosya (`AI_HANDOFF.md`)
3. `RESTORE.md` — yerel kurulum ve doğrulama
4. `.env.example` — gereken environment değişkenlerinin yalnızca adları
5. `supabase/migrations/` — veritabanının gerçek tarihçesi
6. `README.md` ve `SUNUCU_KURULUM.md`

Kod değiştirmeden önce `node_modules/next/dist/docs/` içindeki ilgili Next.js 16 belgesini okuyun. Bu proje, eski Next.js varsayımlarıyla düzenlenmemelidir.

## 3. Ana mimari

- `app/`: App Router sayfaları ve Route Handler API'leri
- `components/`: uygulama, profil, mesaj, admin ve ödeme arayüzleri
- `lib/`: Supabase istemcileri, keşfet, botlar, push, Shopier ve ortak servisler
- `supabase/migrations/`: 001–045 numaralı sıralı şema ve RPC migration'ları
- `public/sw.js`: PWA/web push service worker
- `public/.well-known/assetlinks.json`: Android TWA alan adı doğrulaması
- `artifacts/android-twa/`: Android TWA kaynak projesi
- `artifacts/Lovask-1.0.0-release.apk`: imzalı Android APK çıktısı
- `scripts/`: smoke testleri, görsel optimizasyon ve bakım yardımcıları

Canlı sunucu uygulama dizini `/var/www/lovask`, uygulama portu `3005`, PM2 süreç adı `lovask` şeklindedir. Canlı Node 22 yolu snapshot tarihinde `/root/.hermes/node/bin` idi. Sunucu erişim bilgileri bu pakette kasıtlı olarak yoktur.

## 4. Çalışan ürün özellikleri

### Kullanıcı uygulaması

- E-posta/şifre ve yapılandırıldığında Google girişi
- Profil onboarding, çoklu fotoğraf, kırpma ve WebP dönüşümü
- Keşfet kart destesi, sağ/sol kaydırma, eşleşme ve geri alma
- Kalıcı gerçek zamanlı mesajlaşma, sesli mesaj ve okunma durumu
- Profil ziyaretçileri, beğenenler, engelleme ve şikâyet akışları
- Mobil performans için optimize edilmiş kart geçişleri ve görünürlük tabanlı işler
- Luxury Grouped Hub profil arayüzü

### Noir üyelik

- Noir üyeleri beğenenlerin ve ziyaretçilerin gerçek listesini görür.
- Standart üyeler bu alanları bulanık/kilitli görür; sunucu standart üyeye sayı veya kimlik sızdırmaz.
- Shopier kart ödemesi kullanıcı arayüzünde birincil yöntemdir ve doğrulanmış webhook sonrasında otomatik Noir aktivasyonu yapar.
- Havale/EFT ikincil yöntemdir. Her sipariş için sunucunun ürettiği değiştirilemez `LVK` referansı gösterilir.
- Dekont zorunlu değildir; arayüzde incelemeyi hızlandırmak için önerildiği belirtilir.
- Başarılı ödeme bildirimleri 4 saniyede kapanan modalda, hatalar kullanıcı kapatana kadar kalan modalda gösterilir.
- Papara ve kripto kullanıcı ödeme ekranında şu anda gösterilmez; altyapı ve admin ayar kayıtları korunmuştur.

### Admin alanı

- Roller: `owner`, `support`, `moderator`, `bot_editor`
- Kullanıcı, başvuru, ödeme, destek, rapor, fotoğraf, sohbet, blog, bot ve sistem sağlığı alanları
- Owner, kullanıcıyı manuel Noir yapabilir ve süre belirleyebilir.
- Ödeme ekranı sekmeleri: İnceleme Bekleyen, Onaylanan, Reddedilen, Kart Ödemeleri, Tümü
- Sol menü ödeme rozeti yalnızca `under_review` kayıtlarını sayar.
- Manuel ödeme için son onay/ret yalnızca `owner` rolüne açıktır.
- Shopier onayları “Otomatik Onaylandı · Shopier” olarak gösterilir ve bekleyen rozetine girmez.

### Bot ve bildirim sistemi

- Bot davranışı, persona, fotoğraf setleri, deneyler ve gecikmeli aksiyonlar admin tarafından yönetilebilir.
- Kullanıcının beğendiği botların deterministik yaklaşık %10'u gecikmeli eşleşme/ilk mesaj üretir.
- İlk 14 gündeki keşfedilebilir yeni üyelere günlük toplam 1 veya 2 farklı bot beğenisi oluşturulur.
- Worker endpoint: `/api/internal/bot-worker`; `Authorization: Bearer <CRON_SECRET>` ile çağrılır.
- Web Push/VAPID, abonelik yönetimi, sessiz saatler, ertelenmiş bildirim kuyruğu ve açık sohbet bastırması vardır.

## 5. Son önemli değişiklikler

- `components/lovask-app.tsx`: Kaydırma sonrası profil detayının yanlışlıkla açılması engellendi; deste optimistik olarak sonraki profile ilerliyor.
- `supabase/migrations/034_bot_message_rate_and_new_member_likes.sql`: %10 bot mesaj kohortu ve yeni üye günlük bot beğenileri.
- `components/lovask-profile-view.tsx`: Luxury Grouped Hub, Noir ziyaretçi kilidi ve profil düzeni.
- `app/api/discovery/likes/route.ts`, `app/api/profile/visitors/route.ts`: Standart üyeye veri/sayı sızıntısı engeli.
- `components/admin-payment-operations.tsx`: Sekmeli ve LVK referanslı ödeme masası.
- `app/api/admin/payments/route.ts`: Sağlamlaştırılmış ödeme listesi, tam sayımlar ve owner-only onay/ret.
- `app/noir/page.tsx`, `app/noir/payment-experience.css`: Shopier öncelikli ödeme deneyimi, LVK kopyalama ve modal geri bildirim.
- `lib/discovery.ts`: Storage signed URL batching ve bellek içi TTL cache.
- `next.config.ts`: Paket import optimizasyonu, sıkıştırma ve görsel cache ayarları.

## 6. Veritabanı ve kritik durum makineleri

Migration'lar kesinlikle numara sırasıyla uygulanmalıdır. En güncel migration `045_staged_onboarding_discovery_compatibility.sql` dosyasıdır.

Manuel ödeme akışı:

```text
awaiting_payment → under_review → approved | rejected
```

Shopier akışı:

```text
pending → imzalı webhook + Shopier doğrulaması → approved → Noir süresi açılır
```

Onay işlemleri RPC üzerinden idempotent yapılır; aynı ödeme ikinci kez Noir süresi eklememelidir. Bu mantığı doğrudan tablo güncellemesiyle atlamayın.

## 7. Android/PWA bilgisi

- Paket adı: `tr.com.lovask.app`
- APK sürümü: `1.0.0` / versionCode `1`
- minSdk 23, targetSdk 35
- APK SHA-256: `37CEEC94078C9F1E29A442D9C3E84108541850EB6AC76E0AA0E51A8B54BFC404`
- İmza sertifikası SHA-256: `33:C6:AB:7B:C3:40:35:54:04:E0:A9:0F:41:6C:C8:B4:67:33:9D:CE:21:52:98:13:1D:68:42:19:E6:00:E4:E2`

Release keystore bu pakette yoktur ve kaynak kodla paylaşılmamalıdır. Keystore kaybolursa mevcut Android paketinin aynı imzayla güncellenmesi mümkün olmaz.

## 8. Değişiklik yaparken korunacak sözleşmeler

- Profil ve Noir arka plan/ambient görsel dili keyfî olarak değiştirilmemeli.
- Supabase service-role, AI anahtarları, Shopier tokenları ve VAPID private key hiçbir zaman istemciye gönderilmemeli.
- `NEXT_PUBLIC_` öneki yalnızca gerçekten herkese açık değerlerde kullanılmalı.
- Noir beğenenler/ziyaretçiler yetkisi yalnızca UI bulanıklığına bırakılmamalı; API kontrolü korunmalı.
- Ödeme onayı doğrudan tablo update'iyle yapılmamalı; mevcut RPC'ler kullanılmalı.
- Bot worker idempotency ve advisory-lock davranışı korunmalı.
- Mobil kaydırma performansı için drag sırasında ağır React state veya blur/backdrop efektleri eklenmemeli.
- Kullanıcıya görünen LVK kodu sunucunun sipariş referansıdır ve formdan düzenlenemez.

## 9. Bilinen operasyonel notlar

- Canlı sunucuda üretim build'i yüksek CPU/RAM kullanabilir; build sonrası kaynak kullanımı tekrar kontrol edilmelidir.
- Admin ödeme listesi en yeni 300 kaydı getirir; sekme toplamları veritabanından ayrı ve kesin sayılır.
- Authenticated ödeme/onay smoke testi gerçek owner oturumu gerektirir.
- Bu snapshot canlı Supabase verisinin yedeği değildir. Felaket kurtarma için Supabase dashboard/database backup ayrıca tutulmalıdır.
- APK bu pakette bulunabilir fakat imza keystore'u ayrı, şifreli ve özel saklanmalıdır.

## 10. Yeni AI için başlangıç talimatı

Önce bu dosyayı ve `RESTORE.md` dosyasını tamamen okuyun. Ardından `npm ci`, `npm run typecheck` ve `npm run build` çalıştırın. Kullanıcı açıkça istemeden canlı deploy, migration, ödeme onayı, veri silme veya environment değişikliği yapmayın. İlk değişiklikten önce mevcut sistemi ve dokunacağınız dosyaları özetleyin.
