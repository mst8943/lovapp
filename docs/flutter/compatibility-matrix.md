# Uyumluluk matrisi

| Davranış | Mevcut kaynak/kanıt | Flutter hedefi | Durum |
|---|---|---|---|
| Auth/session | Supabase Auth + `/api/auth/*` | anon key, secure storage, aynı hata/üyelik kuralları | Audit tamam |
| Onboarding | `onboarding-flow.tsx`, profile API | aynı adım/sıra, 6 foto sınırı ve moderasyon | Audit tamam |
| Swipe/limit | `/api/discovery`, RPC'ler | server cevabı tek kaynak; 10 like, Noir hakları | Audit tamam |
| Match/request | `/api/conversations`, RPC'ler | kabul direct chat; romantik match ayrımı korunur | Audit tamam |
| Chat | `/api/chat`, `messages` Realtime | 51 kayıt sayfalama, reconnect, read/presence | Audit tamam |
| Voice | `/api/chat/audio`, voice bucket | multipart, 4 MB sınırı, signed URL | Audit tamam |
| Profile/media | `/api/profile/*`, Storage | HEIC/WebP, 6 foto, en az 2 görünürlük şartı | Audit tamam |
| Safety | `/api/safety` | block/report/unmatch aynı RPC'ler | Audit tamam |
| Push/deep link | `public/sw.js`, query `open/tab` | native push/deep-link eşlemesi, sözleşme değişmez | Planlandı |
| Noir/payment | `/api/noir`, Shopier webhook | ödeme sunucuda; client hak taklit etmez | Audit tamam |
| Web regresyonu | Next.js repo | `npm run verify` sonrası unchanged web | Bekliyor |
| Backend/RLS | `supabase/migrations/*` | migration/RLS/RPC diff yok | Bekliyor |
| APK güvenliği | env ayrımı | private secret yok, SSL doğrulaması açık | Bekliyor |

## Bilinen açıklar

Gerçek cihazda mevcut APK davranışı, release signing ve canlı authenticated test hesabı bu aşamada çalıştırılmadı. Bunlar implementasyon sonrası test kapısında yapılacak; production veri oluşturulmayacak.
