# Flutter backend sözleşmeleri

## Kimlik ve taşıma

- Supabase Auth oturumu mevcut cookie/session davranışıyla uyumludur; Flutter güvenli cihaz depolaması kullanmalıdır.
- Üye işlemleri mevcut Next.js API'lerine HTTPS ile yapılır; API sözleşmesi değiştirilmez.
- Supabase Realtime yalnız authenticated anon client ile, RLS kapsamındaki `public.messages` INSERT/UPDATE eventleri için kullanılır.

## Üye uçları

| Uç | Metot | Amaç |
|---|---|---|
| `/api/auth/password` | POST | login/reset modu |
| `/api/auth/register` | POST | kontrollü kayıt |
| `/api/applications` | POST | başvuru + Turnstile/rate limit |
| `/api/discovery` | GET/POST/DELETE | kartlar, swipe, undo, allowance |
| `/api/discovery/preferences` | GET/PATCH | tercih ve Noir filtreleri |
| `/api/discovery/likes` | GET | Noir beğenenler |
| `/api/conversations` | GET/POST/PATCH | inbox, mesaj isteği başlatma/yanıtlama |
| `/api/chat` | GET/POST | sayfalı geçmiş, mesaj gönderme |
| `/api/chat/audio` | POST multipart | 4 MB ses yükleme |
| `/api/notifications` | GET/PATCH | like badge/okundu |
| `/api/presence` | POST | presence heartbeat |
| `/api/profile/onboarding` | GET/POST | profil ve tercih kaydı |
| `/api/profile/photos` | POST/DELETE | 6 fotoğraf, HEIC/WebP işleme |
| `/api/profile/account` | PATCH/DELETE/POST | görünürlük, silme, recovery |
| `/api/safety` | GET/POST | block/report/unmatch |
| `/api/push/subscriptions` | POST/DELETE | push endpoint kaydı |
| `/api/push/preferences` | GET/PATCH | sessiz saatler |
| `/api/profile/support`, `/api/profile/referrals`, `/api/growth/track` | mevcut metotlar | destek/referral/growth |

## Kritik RPC'ler

`record_swipe`, `rewind_last_swipe`, `get_like_allowance`, `get_super_like_allowance`, `open_message_request`, `respond_message_request`, `get_match_message_page`, `mark_match_messages_read`, `send_text_message`, `get_match_presence`, `block_profile`, `unblock_profile`, `unmatch_profile`, `submit_profile_report`, `schedule_account_deletion`, `cancel_account_deletion`, `save_onboarding_profile` mevcut sözleşmenin parçasıdır.

## Veri/limit notları

Profile görselleri signed URL ile gelir; private alanlar admin/service-role üzerinden API'de filtrelenir. Flutter doğrudan service-role veya private tablo yazımı yapamaz. 429/401/403/409/410/503 durumları kullanıcıya mevcut Türkçe hata akışıyla gösterilmeli; kota/hak client'ta taklit edilmemeli.

## ONAY GEREKTİREN DEĞİŞİKLİKLER

Şu an gerekli görülmedi. Eksik bir mobile-specific endpoint, push/deep-link callback veya signed URL ihtiyacı çıkarsa önce raporlanacak; migration, RPC, RLS veya API değişikliği uygulanmayacak.
