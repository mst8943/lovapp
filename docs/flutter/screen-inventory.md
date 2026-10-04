# Flutter ekran envanteri

| Alan | Ekran/alt durum | Mevcut kaynak | Backend |
|---|---|---|---|
| Auth | Giriş, kayıt, email confirmation, şifre sıfırlama/güncelleme | `app/login`, `app/reset-password`, `app/update-password` | `/api/auth/password`, `/api/auth/register`, Supabase Auth |
| Başvuru | Üyelik başvurusu ve Turnstile | `app/login`, `/api/applications` | `/api/applications` |
| Onboarding | 6 adımlı profil, fotoğraf, niyet, tercih, tamamla | `components/onboarding-flow.tsx` | `/api/profile/onboarding`, `/api/profile/photos` |
| Keşfet | Swipe deck, profil kartı, like/pass/super/undo, kota ve XP | `components/lovask-app.tsx` | `/api/discovery` |
| Keşif listesi | Filtreler, profil grid, likes-only | `components/lovask-app.tsx` | `/api/discovery`, `/api/discovery/preferences`, `/api/discovery/likes` |
| Eşleşme | Eşleşme modalı, starter mesajlar | `components/lovask-app.tsx` | swipe sonucu/conversations |
| Mesaj kutusu | Özetler, okunmamış rozetleri, empty/loading/error | `components/lovask-app.tsx` | `/api/conversations`, `/api/notifications` |
| Chat | İstek pending/accept/reject, metin, ses, read, presence, retry, pagination | `components/lovask-app.tsx` | `/api/chat`, `/api/chat/audio`, `/api/conversations`, `/api/presence` |
| Profil | Görüntüleme/düzenleme, görünürlük, fotoğraflar, XP | `components/lovask-profile-view.tsx` | `/api/profile/onboarding`, `/api/profile/photos`, `/api/profile/account` |
| Güvenlik | Block/unblock/report/unmatch | `components/safety-menu.tsx` | `/api/safety` |
| Bildirim | Push aboneliği, quiet hours, notification badge | `components/notification-control.tsx` | `/api/push/subscriptions`, `/api/push/preferences`, `/api/notifications` |
| Üyelik | Noir bilgi/ödeme yönlendirmesi | `app/noir`, `components/premium-notice.tsx` | `/api/noir`, Shopier/Lemon webhook sunucu tarafı |
| Destek/growth | Destek, referral, XP/quest | `components/support-center.tsx`, `components/referral-panel.tsx` | profile/support/referrals ve growth uçları |
| Sistem | Offline strip, reconnect, deep link `?tab=`, `?open=chat|match|messages` | `lovask-app.tsx`, `public/sw.js` | API/Realtime |

Admin, blog, legal ve marketing ekranları Flutter üye uygulamasının hedef kapsamı değildir.
