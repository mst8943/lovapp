# Lovask

Next.js, Supabase ve yapay zekâ altyapısıyla hazırlanmış, mobil öncelikli bir üyelik ve eşleşme uygulaması.

## Müşteri için hızlı kurulum

1. Proje dosyalarını VPS'e yükleyin.
2. Node.js 22 veya daha yeni bir sürüm kurulu olduğundan emin olun.
3. Bağımlılıkları kurun: `npm ci`
4. `.env.example` içindeki değişkenleri hosting panelinin environment ayarlarına girin. Gerçek secret değerlerini ZIP'e veya tarayıcıya koymayın.
5. Yeni Supabase projesinde `supabase/INSTALL.sql` dosyasını SQL Editor'da bir kez, tamamını çalıştırın. Supabase CLI kullanıyorsanız bunun yerine `supabase db push` çalıştırabilirsiniz.
6. Uygulamayı derleyip başlatın:

```bash
npm run typecheck
npm run build
NODE_ENV=production npm run start
```

7. Uygulamada owner e-postasıyla kayıt olun. Supabase SQL Editor'da bu kullanıcıya owner yetkisi verin:

```sql
insert into public.admin_users (user_id, role)
select id, 'owner' from auth.users
where email = 'owner@yeni-domain.com'
on conflict (user_id) do update set role = 'owner';
```

8. `https://yeni-domain.com/admin/lovask-control/settings` adresini açın. Marka adı, logo, slogan ve destek e-postasını kaydedin. Aynı sayfadaki kontrol listesinde eksik kalan sistem ayarlarını tamamlayın.

## Ortam değişkenleri

Sunucu tarafında kullanılan anahtarları `NEXT_PUBLIC_` ön ekiyle yayınlamayın. Supabase service-role anahtarı, AI anahtarları, Shopier bilgileri ve `CRON_SECRET` yalnızca hosting environment ayarlarında tutulmalıdır.

AI için `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` veya `GEMINI_API_KEY` değerlerinden en az biri yeterlidir. Birincil sağlayıcı ve yedek sırası owner panelinden seçilebilir.

Android push bildirimleri için Firebase Admin service account dosyasını sunucuda uygulama dizini dışında saklayıp `FIREBASE_SERVICE_ACCOUNT_FILE` ile yolunu belirtin. Tek satırlık `FIREBASE_SERVICE_ACCOUNT_JSON` da desteklenir. Gizli anahtarı mobil uygulamaya veya `NEXT_PUBLIC_` alanlarına eklemeyin. Owner ayarlarındaki kurulum listesi eksik yapılandırmayı gösterir.

SMS ve e-posta kod doğrulaması varsayılan olarak kapalıdır. `VERIFICATION_SETTINGS_KEY` için uzun ve rastgele bir sunucu gizlisi tanımlayın ve yedeğini saklayın; bu anahtar değiştirilirse panelde kaydedilmiş sağlayıcı bilgileri çözülemez. Ardından owner panelindeki **Ayarlar → Hesap doğrulama** bölümünden Resend ve Netgsm bilgilerini kaydedip istediğiniz kanalı açabilirsiniz. Selfie istekleri aynı bölümde manuel incelenir. Boost, Noir üyelerine yedi günde bir 30 dakika verilir; aktif Boost keşifte uygun profiller arasındaki sıralama ağırlığını üç katına çıkarır. Yeni veritabanları için güncel `supabase/INSTALL.sql`, mevcut veritabanları için 059, 060 ve 061 migration dosyaları gereklidir.

Tüm QA kontrollerini tek komutla çalıştırmak için `npm run test:full` kullanın. Ayrılmış test hesapları ve `.env.test.local` gerekir. İki Android cihazı varsa her hesap ayrı cihazda denenir; tek cihaz varsa hesaplar sırayla denenir ve eşzamanlı kontrol engelli olarak raporlanır. Rapor `artifacts/qa/latest.html` dosyasına yazılır; engellenen veya başarısız kontroller komutun başarısız çıkmasına neden olur.

## Üretim servisleri

- Domain DNS kayıtları VPS'e yönlendirilmelidir.
- HTTPS, Nginx/Cloudflare gibi bir reverse proxy üzerinden açılmalıdır.
- Shopier webhook adresi `https://yeni-domain.com/api/shopier/webhook` olmalıdır.
- Bot worker için VPS cron'una her dakika yetkili istek eklenmelidir:

```bash
* * * * * curl -fsS -H "Authorization: Bearer CRON_SECRET" https://yeni-domain.com/api/internal/bot-worker
```

- Google OAuth kullanılıyorsa Supabase içindeki callback adresleri yeni domaine göre güncellenmelidir.

## Önemli sayfalar

- `/` — Ana sayfa ve demo
- `/login` — Giriş ve kayıt
- `/onboarding` — Profil kurulumu
- `/admin/lovask-control` — Yönetim paneli
- `/admin/lovask-control/settings` — Marka ve sistem kurulumu
- `/blog` — Blog

## Yerel geliştirme

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Environment değerleri olmadan arayüz demo modunda çalışır. Üretim için `npm run typecheck`, `npm run build` ve ardından `npm run start` kullanılmalıdır.

## Teslim paketi üretme

Temiz müşteri ZIP'i üretmek için proje kökünde çalıştırın:

```bash
npm run package:handoff
```

Komut gerçek `.env` dosyalarını, build/cache klasörlerini, logları, geçici dosyaları ve yerel yedekleri pakete almaz.
