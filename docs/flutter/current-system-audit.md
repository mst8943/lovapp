# Lovask mevcut sistem denetimi

## Kapsam ve kanıt

- İncelenen kaynak: `app/`, `components/`, `lib/`, `supabase/migrations/`, `public/`, `package.json`.
- Uygulama Next.js 16 App Router, React 19, TypeScript ve Supabase JS/SSR kullanıyor.
- Mobil uygulama yüzeyi `components/lovask-app.tsx`; canlı istekler çoğunlukla Next.js `/api/*` uçlarına gidiyor.
- `public/lovask.apk` 1,468,738 bayt; kaynakta Android/Flutter projesi yok. PWA manifesti `display: standalone`, service worker yalnız offline sayfa ve web push sağlıyor.
- Bu aşamada APK açılmadı/decompile edilmedi; binary'nin TWA sarmalayıcı olduğu proje tanımından ve PWA kayıt akışından kabul edildi. Flutter doğrulamasında ayrıca imza/package metadata incelenecek.

## Kullanıcı akışı

1. `/login`: giriş, kayıt modu, başvuru ve şifre sıfırlama.
2. `/onboarding`: profil alanları, fotoğraflar, niyet/rozetler ve keşif tercihleri.
3. `/`: canlı üyede keşfet/swipe; beğeni, pass, super like, undo ve eşleşme modalı.
4. Alt navigasyon: Keşfet, Profil listesi/keşif, Beğeniler, Mesajlar, Profil.
5. Mesajlar: konuşma özeti, mesaj isteği, kabul/red, metin ve sesli mesaj, okundu/presence, pagination.
6. Profil: düzenleme, fotoğraf yönetimi, görünürlük, güvenlik, bildirim, destek, referral/XP, çıkış ve hesap silme/recovery.
7. `/noir`: üyelik/ödeme; ödeme sözleşmesi mevcut web API'si üzerinden korunmalı.

## İş kuralları

Server RPC/API tek doğruluk kaynağıdır. Kodda görülen kurallar: standart günlük 10 like, Pass kota düşürmez, Super Like standart haftada 1/Noir günde 1, mesaj standart 25/Noir 100, mesaj isteği standart 1/Noir 3, istek 7 gün, kabul direct chat açar ve romantik match oluşturmaz. Client bu kuralları yeniden uygulamamalı.

## Güvenlik sonucu

Mobilde yalnız `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` veya public VAPID key bulunabilir. `SUPABASE_SERVICE_ROLE_KEY`, Shopier secret/token, AI keyleri, CRON, Resend, Netgsm, Turnstile secret ve VAPID private key sunucuda kalmalıdır. RLS/RPC ve mevcut API sınırları korunacak.

## İnceleme sınırı

Admin paneli mobil kapsam dışında yönetim yüzeyidir; Flutter yalnızca üye kullanıcı akışlarını tüketir. Supabase migration, production veri yazımı ve deploy yapılmadı.
