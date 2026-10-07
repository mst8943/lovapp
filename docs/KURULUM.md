# Lovask kurulum rehberi

Hedef: sıfırdan çalışan bir site, yönetim paneli ve botlarla birlikte yaklaşık 30 dakika.
Her adımın sonunda `npm run doctor` neyin hazır, neyin eksik olduğunu Türkçe söyler.

## Gerekenler

- Bir Linux sunucu (2 GB RAM yeterli) ve alan adınızın o sunucuya yönlenmiş olması
- Ücretsiz bir [Supabase](https://supabase.com) projesi
- Docker ile kuracaksanız Docker 24+; Docker kullanmayacaksanız Node.js 22+
- İsteğe bağlı: bir yapay zekâ anahtarı (OpenAI, DeepSeek, Gemini veya OpenRouter), Firebase projesi, Shopier hesabı, Resend hesabı

## 1. Veritabanı

1. Supabase'de yeni proje açın.
2. **SQL Editor** içinde `supabase/INSTALL.sql` dosyasının tamamını yapıştırıp bir kez çalıştırın. Tablolar, güvenlik kuralları, depolama alanları ve fonksiyonlar tek seferde kurulur.
3. **Project Settings → API** sayfasından üç değeri not edin: Project URL, `anon` anahtarı, `service_role` anahtarı.

## 2. Ayarlar

```bash
npm install
npm run setup
```

`npm run setup`, `.env.local` dosyasını oluşturur ve rastgele üretilebilen tüm gizli anahtarları (CRON, HMAC, VAPID, doğrulama şifreleme) sizin yerinize doldurur. Dosyayı açıp şunları elle girin:

| Değişken | Ne yazılır |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 1. adımdaki üç değer |
| `NEXT_PUBLIC_APP_URL` | `https://alanadiniz.com` |
| `ADMIN_EMAILS` | Yönetici e-postanız |
| `DOMAIN` | Docker ile kuruyorsanız `alanadiniz.com` (otomatik HTTPS için) |
| Bir `*_API_KEY` | Bot sohbetleri ve Wingman için en az bir yapay zekâ anahtarı |

```bash
npm run doctor
```

Zorunlu satırlar `[ OK ]` olana kadar tekrarlayın. `[UYARI]` satırları isteğe bağlı özelliklerdir.

## 3. Çalıştırma

**Docker (önerilen).** Site, otomatik HTTPS ve bot zamanlayıcısı tek komutla kalkar:

```bash
docker compose --env-file .env.local up -d --build
```

**Docker'sız.**

```bash
npm run build
NODE_ENV=production npm run start
```

Bu durumda botların çalışması için sunucuda her dakika şu isteği atan bir cron kurun:

```bash
* * * * * curl -fsS -H "Authorization: Bearer CRON_SECRET_DEGERINIZ" https://alanadiniz.com/api/internal/bot-worker
```

HTTPS için Nginx veya Cloudflare'i uygulamanın önüne koyun.

## 4. Yönetici hesabı

Sitede `ADMIN_EMAILS` içine yazdığınız e-postayla kayıt olun, sonra Supabase SQL Editor'da şunu çalıştırın:

```sql
insert into public.admin_users (user_id, role)
select id, 'owner' from auth.users where email = 'yonetici@alanadiniz.com'
on conflict (user_id) do update set role = 'owner';
```

`https://alanadiniz.com/admin/lovask-control/platform` sayfası kurulumun hazır olup olmadığını ve platformun tüm özelliklerini tek ekranda gösterir. Marka adı, logo ve slogan **Ayarlar** sayfasındandır.

## 5. Markalama

Kaynak kodda orijinal alan adı birçok yerde varsayılan değer olarak geçer. Tek komutla kendi alan adınıza çevirin:

```bash
npm run rebrand -- --domain alanadiniz.com --dry-run   # önce ne değişeceğini görün
npm run rebrand -- --domain alanadiniz.com --supabase-url https://PROJE.supabase.co --supabase-anon-key ANON_ANAHTAR
```

Komut alan adını ve mobil uygulamanın gömülü Supabase varsayılanlarını değiştirir. Ayrıca şunları yapın:

- Gizlilik ve Kullanım Koşulları metinlerindeki veri sorumlusu bilgilerini kendi şirketinizle güncelleyin (`app/privacy/page.tsx`, `app/terms/page.tsx`).
- `public/` altındaki logo dosyalarını ve Ayarlar sayfasındaki marka bilgilerini değiştirin.

## 6. İsteğe bağlı özellikler

- **Google ile giriş:** Supabase → Authentication → Providers → Google'ı açın, Google Cloud'da OAuth istemcisi oluşturun, yönlendirme adresine `https://PROJE.supabase.co/auth/v1/callback` ekleyin, sonra `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` yapın. Sağlayıcı kapalıyken düğme otomatik gizlenir.
- **Android push:** Kendi Firebase projenizi açın, `google-services.json` dosyasını `apps/mobile/android/app/` altına koyun, servis hesabı JSON'unu sunucuda `FIREBASE_SERVICE_ACCOUNT_FILE` ile gösterin.
- **Ödeme:** Noir üyeliği Shopier ürün bağlantısıyla çalışır. Ayarlar → Ödeme bölümünden bağlantılarınızı girin. Webhook adresi `https://alanadiniz.com/api/shopier/webhook`.
- **E-posta ve SMS doğrulama:** Ayarlar → Hesap doğrulama bölümünden Resend ve Netgsm bilgilerini girin.
- **Bot koruma:** Cloudflare Turnstile anahtarlarını `.env.local` dosyasına ekleyin.

## Sesli ve görüntülü arama

Arama web'de çalışır ve ek kurulum gerektirmez: görüntü ve ses üyeler arasında doğrudan akar, sunucunuz yalnızca "arama başladı" sinyallerini taşır. Üyelerin yaklaşık yüzde 10-20'si katı güvenlik duvarı arkasında olabilir; onlar için bir TURN rölesi gerekir:

1. `.env.local` içine `TURN_SECRET` (uzun rastgele bir değer) ve `TURN_URLS=turn:alanadiniz.com:3478` yazın.
2. `docker compose --env-file .env.local --profile turn up -d` ile coturn'u başlatın.
3. Sunucuda UDP 3478 ve 49160-49200 portlarını açın.

TURN olmadan da arama çalışır, yalnızca bazı ağlarda bağlantı kurulamayabilir. Arama için iki üyenin de birbirine mesaj yazmış olması gerekir ve her üye ayarlardan aramaları kapatabilir. Aramalar kaydedilmez.

## 7. Android uygulaması

Flutter 3.x kurulu bir Windows veya macOS bilgisayarda:

```bash
cd apps/mobile
flutter build apk --release --dart-define=SUPABASE_URL=https://PROJE.supabase.co --dart-define=SUPABASE_ANON_KEY=ANON_ANAHTAR
```

Sürüm yayınlamadan önce APK'yı kendi anahtar deponuzla imzalayın ve `public/lovask.apk` olarak koyun. Sürüm numarası `apps/mobile/pubspec.yaml` içindedir; indirme yönlendirmesi `app/api/download/android/route.ts` dosyasındadır.

## 8. Test

Site çalışırken `npm run smoke -- https://alanadiniz.com` yönetim API'lerini gerçek veritabanınızda dener (geçici bir yönetici hesabı açar, bildirim göndermez, işi bitince kaldırır). `npm run smoke:member -- https://alanadiniz.com` aynısını üye tarafı için yapar (geçici üyeler oluşturur ve siler). `https://alanadiniz.com/api/health` ise uptime izleme servislerine verebileceğiniz herkese açık sağlık adresidir.

`npm run verify` kod denetimi, tür denetimi ve derlemeyi birlikte çalıştırır. `npm run test:full` ayrılmış test hesaplarıyla uçtan uca testleri çalıştırır; ayrıntılar `docs/qa/` altındadır.

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| Girişten sonra başka bir siteye yönleniyor | `NEXT_PUBLIC_APP_URL` yanlış veya `npm run rebrand` çalıştırılmadı |
| Fotoğraflar görünmüyor | `NEXT_PUBLIC_SUPABASE_URL` build sırasında tanımlı olmalı; değiştirdiyseniz yeniden derleyin |
| Botlar mesaj yazmıyor | Cron veya `worker` servisi çalışmıyor, ya da yapay zekâ anahtarı yok |
| `doctor` "şema eksik" diyor | `supabase/INSTALL.sql` çalıştırılmamış |
| Google düğmesi görünmüyor | Supabase'de Google sağlayıcısı kapalı |
