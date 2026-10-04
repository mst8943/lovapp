# Lovask snapshot geri yükleme

Bu paket gerçek secret içermez. Çalışan bir kurulum için secret değerleri güvenli kasadan ayrıca alınmalıdır.

## Yerel kurulum

Gereksinimler:

- Node.js 22
- npm 10+
- Bir Supabase projesi veya yerel Supabase ortamı

```powershell
npm ci
Copy-Item .env.example .env.local
npm run typecheck
npm run build
npm run dev
```

`.env.local` içindeki boş değerleri güvenli kaynaktan doldurun. Service-role ve özel API anahtarlarını tarayıcıya açık değişkenlere koymayın.

## Yeni veritabanı

Yeni Supabase projesinde `supabase/migrations` altındaki tüm SQL dosyalarını numara sırasıyla uygulayın. Alternatif olarak `npm run build:install-sql` ile güncel `supabase/INSTALL.sql` dosyasını oluşturup boş veritabanında bir kez çalıştırın. Ardından Auth provider'larını, storage politikalarını ve cron çağrısını ortamınıza göre doğrulayın.

Bu snapshot yalnızca şema/migration içerir. Canlı kullanıcılar, mesajlar, ödemeler, storage dosyaları ve auth kullanıcıları için Supabase'in ayrı veritabanı/storage yedeği gerekir.

## Environment kontrolü

Değişken adlarının güvenli şablonu `.env.example` dosyasındadır. En azından şu gruplar gerekir:

- Supabase URL, anon key ve server-only service-role key
- Kullanılan AI sağlayıcısının API anahtarı
- `CRON_SECRET`
- Shopier access/webhook/account değerleri
- VAPID public/private değerleri
- E-posta/SMS sağlayıcı değerleri kullanılıyorsa bunların anahtarları
- `NEXT_PUBLIC_APP_URL`

## Üretim doğrulaması

```powershell
npm run typecheck
npm run build
```

Deploy sonrasında kontrol edin:

- `/` ve `/noir`
- `/login` ve onboarding
- `/admin/lovask-control/payments` (owner oturumuyla)
- `/sw.js`
- `/.well-known/assetlinks.json`
- Shopier webhook endpoint'i
- Bot worker'ın doğru bearer token ile çalışması
- PM2 sürecinin yeniden başlamadan online kalması

## Android

TWA kaynakları `artifacts/android-twa` altındadır. Üretim APK'sını güncellemek için orijinal release keystore şarttır. Keystore bu snapshot'ta bulunmaz. Farklı bir anahtarla aynı Android package adına güncelleme yayınlamayın.

## Canlıya geri dönüş

Canlı sunucudaki deployment yedekleri `/var/www/lovask/.deploy-backups/` altında tutulur. Snapshot tarihinde son ödeme arayüzü öncesi dosya yedeği:

```text
/var/www/lovask/.deploy-backups/payment-flow-20260814-000604
```

Geri dönüş yapmadan önce hedef yedek yolunu doğrulayın, mevcut sürümü ayrıca yedekleyin ve yalnızca ilgili dosyaları geri yükleyin. Proje köküne karşı toplu silme veya `git reset --hard` kullanmayın.
