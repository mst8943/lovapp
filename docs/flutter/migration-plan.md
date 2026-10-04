# Flutter geçiş planı

## Aşamalar

1. Audit ve sözleşme belgeleri (bu aşama).
2. `/apps/mobile` içinde izole Flutter temel proje, env şablonu, tema/token ve router.
3. Auth/session ve güvenli token saklama.
4. Onboarding, profil, fotoğraf ve moderasyon akışı.
5. Discovery/swipe ve server allowance/RPC entegrasyonu.
6. Match, message request ve native bottom sheet/modal.
7. Realtime chat, ses, read/presence, pagination/reconnect.
8. Push/deep link, Noir ve kalan üye özellikleri.
9. Güvenlik, performans, erişilebilirlik, Android release yapılandırması.
10. Unit/widget/repository/auth/swipe/limit/request/realtime/deep-link testleri; debug/release build ve cihaz doğrulaması.

## Dosya planı

İlk uygulama aşamasında yeni dosyalar yalnızca `apps/mobile/**` altında olacaktır: `pubspec.yaml`, `lib/**`, `test/**`, `android/**`, `assets/**`, `.env.example` ve gerekiyorsa `README.md`. Mevcut Next.js, `app/**`, `components/**`, `lib/**`, `supabase/**`, `public/**` dosyaları değiştirilmeyecek. `apps/mobile` mevcutsa üzerine yazılmadan envanteri çıkarılacak.

## Doğrulama kapıları

Her aşamada `flutter format --set-exit-if-changed`, `flutter analyze`, ilgili testler ve mevcut web `npm run verify` çalıştırılır. Son kapıda debug APK + release APK/AAB, secret taraması, Supabase migration/RLS diff kontrolü ve görsel karşılaştırma yapılır. Production deploy, migration push ve canlı veri yazımı yapılmaz.

## Risk/varsayım

Mevcut mobil web tek referanstır; native uygulama UX'i yeniden tasarlamaz. API cookie odaklı bazı auth akışları Flutter token taşımasına ihtiyaç duyarsa backend değiştirilmeden mevcut endpoint ile uyumluluk protokolü tasarlanacak; çalışmıyorsa ONAY GEREKTİREN DEĞİŞİKLİKLER olarak durdurulacaktır.
