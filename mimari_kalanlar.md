 # Lovask – Kalan İşler İçin Teknik Devir Dokümanı

  ## 1. Projenin mevcut durumu

  Proje dizini:

  C:\MAMP\htdocs\lovask

  Teknolojiler:

  - Next.js 16.3 App Router
  - React
  - TypeScript
  - Supabase Auth
  - Supabase PostgreSQL
  - Supabase Storage
  - Supabase Realtime
  - PWA
  - OpenAI/OpenRouter/DeepSeek/Gemini sağlayıcı katmanı
  - Web Push
  - Motion animasyonları
  - WebP görsel işleme
  - Mobil öncelikli tasarım

  Mevcut migration dosyaları:

  001_initial.sql
  002_security_foundation.sql
  003_profile_foundation.sql
  004_discovery_and_matching.sql
  005_persistent_messaging_and_ai.sql
  006_voice_messages_and_push.sql
  007_profile_visitors.sql

  Yeni veritabanı değişiklikleri 008_...sql ile başlamalıdır. Eski migration
  dosyaları değiştirilmemeli; canlı Supabase veritabanına uygulanmış
  durumdalar.

  ## 2. Kesinlikle korunması gereken mevcut özellikler

  Yeni geliştirmeler yapılırken şu çalışan sistemler bozulmamalı:

  - E-posta ve şifreyle kayıt/giriş
  - Onboarding sihirbazı
  - İsim, doğum tarihi, cinsiyet ve opsiyonel telefon
  - Fotoğraf kırpma
  - Otomatik WebP dönüşümü
  - Profil niyet rozetleri
  - Buz kırıcı soru ve cevapları
  - Profil güncelleme
  - Swipe/keşfet sistemi
  - Sağ, sol ve süper beğeni
  - Botla anında eşleşme
  - Günlük görevler ve XP
  - İnsan–insan mesajlaşma
  - Bot AI mesajlaşması
  - Günlük mesaj limitleri
  - Botun limit sonrasında doğal kapanış mesajı
  - Sesli mesaj kaydı, dalga formu ve oynatma
  - Bot ekleme ve toplu JSON bot içe aktarma
  - AI sağlayıcı seçimi
  - Admin sohbet inceleme
  - Bot sohbetini adminin devralması
  - Profil ziyaretleri
  - Ücretsiz kullanıcı için kilitli ziyaretçi görünümü
  - Noir kullanıcı için ziyaretçi detayları
  - PWA manifesti ve mobil arayüz

  Özellikle şu davranış korunmalı:

  > Profil ziyareti, keşfet kartının yalnızca görüntülenmesiyle değil, karta
  > tıklanıp profil detayının açılmasıyla kaydedilir.

  Aynı ziyaretçi–profil çifti 6 saat içinde tekrar ziyaret sayılmamalıdır.

  ———

  # Yapılması gereken işler

  ## 3. Apple ile giriş

  ### İstenen davranış

  Giriş ekranında:

  - E-posta
  - Google
  - Apple

  seçenekleri bulunmalı.

  Apple butonu, Google butonuyla aynı kalite ve davranışta olmalı.

  ### Teknik uygulama

  app/login/page.tsx içinde Apple OAuth desteği eklenmeli.

  Supabase istemcisiyle:

  supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: callbackUrl,
    },
  });

  kullanılabilir.

  Yeni public ortam değişkeni:

  NEXT_PUBLIC_APPLE_AUTH_ENABLED=true

  Buton kapalıysa hata vermek yerine:

  Apple girişi henüz etkin değil.

  mesajı gösterilmeli.

  ### Supabase tarafında gerekenler

  Supabase Dashboard:

  Authentication → Providers → Apple

  bölümünden Apple sağlayıcısı açılmalı.

  Apple Developer hesabında şunlar hazırlanmalı:

  - Services ID
  - Team ID
  - Key ID
  - Private key
  - Callback URL

  Callback URL Supabase’in gösterdiği URL ile birebir aynı olmalı.

  ### Kabul kriterleri

  - Apple butonu mobilde görünür.
  - Apple oturumu başlatılabilir.
  - Yeni Apple kullanıcısı onboarding’e gider.
  - Profili tamamlanmış kullanıcı ana sayfaya gider.
  - OAuth hatasında kullanıcı anlaşılır bir mesaj görür.

  ———

  ## 4. Google girişini canlı hâle getirme

  Google OAuth kodu zaten app/login/page.tsx içinde bulunuyor fakat .env.local
  içinde kapalı:

  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false

  Bu değer yapılandırma tamamlandıktan sonra:

  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true

  olmalı.

  ### Supabase ayarı

  Authentication → Providers → Google

  bölümünde Google sağlayıcısı etkinleştirilmeli.

  Google Cloud Console’dan:

  - OAuth Client ID
  - Client Secret
  - Authorized redirect URI

  tanımlanmalı.

  ### Kabul kriterleri

  - Google butonu “yakında” yazmamalı.
  - OAuth akışı çalışmalı.
  - Yeni kullanıcı onboarding’e yönlenmeli.
  - Mevcut kullanıcı doğrudan uygulamaya girmeli.
  - next yönlendirme parametresi korunmalı.

  ———

  ## 5. Noir paket ve ödeme sistemi

  Kullanıcı klasik otomatik yenilenen abonelik istemiyor. Şimdilik:

  - Haftalık paket
  - Aylık paket
  - Otomatik yenileme yok
  - Shopier veya havale/EFT
  - Süresi dolunca erişim otomatik kapanır

  modeli kullanılacak.

  Arayüzde “Abonelik yok” veya benzeri açık bir ifade yer almalı.

  ### Paket modeli

  Yeni migration örneği:

  008_noir_payments.sql

  Önerilen tablolar:

  ### premium_plans

  id uuid primary key
  slug text unique
  name text
  duration_days integer
  price_amount numeric
  currency text default 'TRY'
  is_active boolean
  created_at timestamptz
  updated_at timestamptz

  Örnek planlar:

  noir-weekly  → 7 gün
  noir-monthly → 30 gün

  ### payment_orders

  id uuid primary key
  profile_id uuid
  plan_id uuid
  provider text
  amount numeric
  currency text
  status text
  provider_order_id text
  payment_reference text
  proof_path text
  reviewed_by uuid
  reviewed_at timestamptz
  created_at timestamptz
  updated_at timestamptz

  Durumlar:

  pending
  awaiting_payment
  under_review
  approved
  rejected
  cancelled
  expired

  Sağlayıcı değerleri:

  shopier
  bank_transfer
  manual

  ### Mevcut premium tablosu

  Halihazırda şu tablo var:

  public.user_entitlements

  Önemli alan:

  noir_until

  Ödeme onaylanınca doğrudan istemciden güncellenmemeli. Güvenli sunucu işlemi
  veya RPC kullanılmalı.

  Örneğin:

  approve_noir_payment(order_uuid uuid)

  Bu işlem:

  1. Admin yetkisini doğrulamalı.
  2. Ödeme siparişini kilitlemeli.
  3. Sipariş zaten onaylıysa tekrar süre eklememeli.
  4. Plan süresini okumalı.
  5. Mevcut noir_until gelecekteyse mevcut tarihin üzerine süre eklemeli.
  6. Süre geçmişse now() üzerinden başlamalı.
  7. Siparişi onaylandı olarak işaretlemeli.
  8. Admin audit kaydı oluşturmalı.

  ### Kullanıcı arayüzü

  Yeni sayfa önerisi:

  app/noir/page.tsx

  Sayfada:

  - Haftalık Noir kartı
  - Aylık Noir kartı
  - Fiyat
  - Paket süresi
  - “Otomatik yenileme yok”
  - “Tek sefer öde, süre bitince kendiliğinden kapanır”
  - Shopier ile ödeme
  - Havale/EFT bildirimi
  - Mevcut Noir bitiş tarihi

  bulunmalı.

  ### Havale akışı

  Kullanıcı:

  1. Plan seçer.
  2. Sipariş oluşturur.
  3. Siparişe özel açıklama/reference kodu alır.
  4. Dekont yükleyebilir.
  5. Sipariş under_review olur.
  6. Admin onaylar veya reddeder.
  7. Onaylanınca user_entitlements.noir_until güncellenir.

  Dekontlar public bucket’a yüklenmemeli.

  Yeni private bucket:

  payment-proofs

  Kullanıcı yalnızca kendi dekontunu yükleyebilmeli. Admin kontrollü signed
  URL ile görüntülemeli.

  ### Admin tarafı

  Admin paneline “Ödemeler” bölümü eklenmeli:

  - Bekleyen ödemeler
  - Kullanıcı adı
  - E-posta
  - Telefon
  - Plan
  - Tutar
  - Dekont
  - Referans kodu
  - Onayla
  - Reddet
  - Önceki işlemler

  ### Shopier

  Shopier entegrasyonu yapılacaksa:

  - Sipariş önce Lovask veritabanında oluşturulmalı.
  - Shopier dönüşü yalnızca tarayıcı yönlendirmesine güvenmemeli.
  - Dönen ödeme verisi imza doğrulamasından geçmeli.
  - Tutar ve sipariş numarası sunucuda yeniden kontrol edilmeli.
  - Aynı Shopier siparişi iki kez kullanılamamalı.
  - Başarılı dönüş doğrudan noir_until yazmamalı; güvenli ödeme doğrulama
    fonksiyonu çağrılmalı.

  ### Kabul kriterleri

  - Haftalık ve aylık plan seçilebilir.
  - Otomatik yenileme olmadığı açıkça görünür.
  - Havale siparişi oluşturulabilir.
  - Dekont güvenli şekilde yüklenebilir.
  - Admin ödeme onaylayabilir.
  - Onaylanan kullanıcının Noir erişimi açılır.
  - Süre dolunca erişim otomatik kapanır.
  - Aynı ödeme iki defa onaylanamaz.

  ———

  ## 6. Son görülme ve okundu bilgileri

  Bu özellik yalnızca Noir kullanıcılar tarafından görülebilecek.

  Mesaj tablosunda read_at alanı mevcut ancak aktif şekilde işaretlenmiyor ve
  ekranda gösterilmiyor.

  ### Yeni migration

  Önerilen dosya:

  009_presence_and_read_receipts.sql

  ### Son görülme

  profiles tablosuna doğrudan sürekli yazmak yerine ayrı tablo önerilir:

  create table public.profile_presence (
    profile_id uuid primary key references public.profiles(id) on delete
    cascade,
    last_seen_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  ### Maliyet kontrolü

  Her mouse hareketinde veya her saniye yazma yapılmamalı.

  Önerilen davranış:

  - Uygulama açıldığında güncelle.
  - Sekme tekrar görünür olduğunda güncelle.
  - En fazla 3–5 dakikada bir güncelle.
  - Sayfa kapanırken zorunlu yazma yapılmasına güvenme.
  - Çevrimiçi kabul aralığı yaklaşık 5 dakika olabilir.

  ### Okundu bilgisi

  Sohbet ekranı açıldığında karşı taraftan gelen ve read_at is null olan
  mesajlar işaretlenmeli.

  Güvenli RPC önerisi:

  mark_match_messages_read(match_uuid uuid)

  RPC:

  - Kullanıcının eşleşmenin tarafı olduğunu doğrulamalı.
  - Yalnızca diğer tarafın gönderdiği mesajları güncellemeli.
  - Kullanıcının kendi mesajlarını değiştirmemeli.
  - Aktif eşleşme kontrolü yapmalı.

  ### Premium kuralı

  Veri gizleme sunucuda yapılmalı.

  Ücretsiz kullanıcıya:

  - read_at
  - last_seen_at

  değerleri gönderilmemeli veya API bunları null döndürmeli.

  Noir kullanıcı:

  Az önce aktifti
  12 dk önce aktifti
  Bugün 14:30
  Dün
  Okundu
  İletildi

  gibi ifadeleri görebilir.

  Botlar için sahte ve değişken son görülme üretmek yerine tutarlı davranış
  seçilmeli. Bot mesaj gönderdiğinde kısa süre çevrimiçi gösterilebilir ancak
  bu ayrı şekilde kontrol edilmelidir.

  ### Kabul kriterleri

  - Sohbet açılınca karşı mesajlar okundu olur.
  - Kullanıcı yalnızca yetkili olduğu sohbeti işaretleyebilir.
  - Noir kullanıcı okundu ve son görülmeyi görür.
  - Ücretsiz kullanıcı bunları ağ yanıtında bile alamaz.
  - Presence sistemi gereksiz veritabanı yükü oluşturmaz.

  ———

  ## 7. Admin kullanıcı yönetimi

  Admin panelinde “Kullanıcılar” butonu şu anda devre dışı. Bu bölüm çalışır
  hâle getirilmeli.

  Önerilen route:

  app/admin/lovask-control/users/page.tsx

  Önerilen API:

  app/api/admin/users/route.ts
  app/api/admin/users/[profileId]/route.ts

  ### Listede gösterilecek bilgiler

  - Profil fotoğrafı
  - İsim
  - Yaş
  - E-posta
  - Opsiyonel telefon
  - Kayıt tarihi
  - Son görülme
  - XP
  - Seviye
  - Eşleşme sayısı
  - Mesaj sayısı
  - Noir durumu
  - Noir bitiş tarihi
  - Profil görünürlüğü
  - Moderasyon durumu

  Telefon doğrulanmış gibi gösterilmemeli; çünkü telefon doğrulaması bilinçli
  olarak yapılmıyor.

  ### Gizlilik ve yetki

  - Telefon ve e-posta yalnızca owner veya açıkça yetkilendirilmiş support
    rolü tarafından görülebilmeli.

  - Liste verileri service-role route üzerinden dönecekse route mutlaka admin
    rolünü doğrulamalı.

  - Hassas veriler client-side doğrudan Supabase sorgusuyla çekilmemeli.
  - Her kullanıcı detay görüntülemesi audit log’a yazılmalı.
  - Bot silme veya kaldırma özelliği eklenmemeli.
  - Kullanıcılara yönelik yıkıcı işlem yapılacaksa ayrıca onay ekranı
    bulunmalı.

  ### Kabul kriterleri

  - Admin kullanıcı arayabilir.
  - Profil detaylarını görebilir.
  - Opsiyonel telefon görünür.
  - Normal kullanıcı bu API’ye erişemez.
  - Admin görüntülemeleri audit log’a yazılır.
  - Bot silme özelliği eklenmez.

  ———

  ## 8. Şikâyet ve engelleme sistemi

  Veritabanında temel blocks ve reports tabloları bulunuyor ancak kullanıcı
  arayüzleri eksik.

  ### Kullanıcı tarafı

  Profil detay panelinde üç nokta menüsü eklenmeli:

  Şikâyet et
  Engelle

  Sohbet ekranında da aynı seçenekler bulunmalı.

  ### Engelleme davranışı

  Engelleme sonrasında:

  - Kullanıcı keşfette görünmemeli.
  - Aktif eşleşme kapatılmalı veya blocked durumuna alınmalı.
  - Mesaj gönderilememeli.
  - Mesaj listesinde görünmemeli.
  - Karşı taraf bildirim almamalı.
  - Engelleyen kişi ayarlardan engeli kaldırabilmeli.

  Bunun tek transaction/RPC ile yapılması daha güvenlidir:

  block_profile(target_profile uuid)

  ### Şikâyet nedenleri

  Önerilen kategoriler:

  Sahte profil
  Taciz veya tehdit
  Uygunsuz içerik
  Dolandırıcılık
  18 yaş altı şüphesi
  Spam
  Diğer

  Kullanıcı kısa açıklama ekleyebilmeli.

  ### Admin moderasyon ekranı

  Admin panelinde “Şikâyetler” bölümü:

  - Açık şikâyetler
  - Şikâyet edilen kişi
  - Şikâyet eden kişi
  - Neden
  - Açıklama
  - İlgili sohbet
  - Profil fotoğrafları
  - İncelemede
  - İşlem yapıldı
  - Reddedildi

  durumlarını desteklemeli.

  İnsan–insan sohbetlerine erişim zaten güvenli admin inceleme mekanizmasıyla
  yapılmalı; doğrudan istemciye service-role anahtarı verilmemeli.

  ### Kabul kriterleri

  - Kullanıcı profil veya sohbetten engelleyebilir.
  - Engellenen hesap tekrar keşfette görünmez.
  - Engellenen kullanıcı mesaj gönderemez.
  - Şikâyet admin paneline düşer.
  - Moderatör işlemleri audit log’a yazılır.

  ———

  ## 9. Fotoğraf moderasyonu

  Fotoğraf kayıtlarında halihazırda:

  pending
  approved
  rejected

  durumları bulunuyor. Fakat gerçek inceleme akışı yok.

  ### Admin ekranı

  Admin paneline “Fotoğraf inceleme” bölümü eklenmeli:

  - Bekleyen fotoğraflar
  - Kullanıcı
  - Yükleme tarihi
  - Büyük önizleme
  - Onayla
  - Reddet
  - Red nedeni
  - Önceki fotoğraflar

  ### Kurallar

  - Fotoğraf onaylanmadan keşfette gösterilip gösterilmeyeceği ürün kararıyla
    tutarlı olmalı.

  - Mevcut sistem fotoğrafları çoğunlukla approved oluşturuyor; gerçek
    moderasyon açıldığında yeni yüklemeler pending başlamalı.

  - Kullanıcının en az iki onaylanmış fotoğrafı kalması gerekiyorsa reddetme
    işleminde bu kontrol yapılmalı.

  - Storage dosyası reddedildiğinde hemen silinmemeli; itiraz veya inceleme
    süresi için saklama politikası belirlenmeli.

  - Admin işlemi audit log’a yazılmalı.

  ### Otomatik moderasyon

  İlk sürümde maliyeti azaltmak için:

  1. Dosya türü, çözünürlük ve boyut kontrolü
  2. Manuel admin incelemesi
  3. Gerektiğinde daha sonra otomatik görsel moderasyon

  şeklinde ilerlenebilir.

  ### Kabul kriterleri

  - Yeni fotoğraf pending olabilir.
  - Admin fotoğrafı onaylayabilir veya reddedebilir.
  - Reddedilen fotoğraf keşfette görünmez.
  - Kullanıcı profilinde anlaşılır durum gösterilir.
  - İşlemler audit log’a yazılır.

  ———

  ## 10. AI sağlayıcı anahtarları ve canlı bot yanıtları

  Kod tarafında şu sağlayıcılar destekleniyor:

  - OpenAI
  - OpenRouter
  - DeepSeek
  - Gemini

  İlgili dosya:

  lib/ai/provider.ts

  Admin ayarları:

  app/api/admin/ai-settings/route.ts
  app/admin/lovask-control/page.tsx

  Ancak .env.local içinde sağlayıcı API anahtarları bulunmuyor.

  Gerekli sunucu değişkenleri:

  OPENAI_API_KEY=
  OPENROUTER_API_KEY=
  DEEPSEEK_API_KEY=
  GEMINI_API_KEY=

  AI_DEFAULT_PROVIDER=openrouter
  OPENAI_MODEL=
  OPENROUTER_MODEL=
  DEEPSEEK_MODEL=
  GEMINI_MODEL=

  Yalnızca kullanılan sağlayıcıların anahtarları eklenebilir.

  ### Güvenlik

  - Anahtarların hiçbiri NEXT_PUBLIC_ ile başlamamalı.
  - API anahtarları tarayıcıya gönderilmemeli.
  - .env.local Git’e eklenmemeli.
  - Admin paneli anahtarların tamamını göstermemeli.
  - Hata loglarında anahtar veya sağlayıcı cevabının hassas bölümleri
    bulunmamalı.

  ### Mevcut bot davranışları korunmalı

  - Persona sistem talimatında kullanılmalı.
  - Son 20 mesaj bağlam olarak kullanılmalı.
  - Türkçe, kısa ve doğal cevap verilmeli.
  - Aynı soru kalıpları tekrarlanmamalı.
  - Günlük son bot yanıtı doğal kapanış olmalı.
  - Kapanıştan sonra insan yazsa bile bot cevap vermemeli.
  - Admin devralma açıksa AI cevap vermemeli.
  - Admin bot adına yazabilmeli.
  - Admin kontrolü AI moduna dönünce otomatik yanıtlar devam edebilmeli.

  ### Kabul kriterleri

  - En az bir sağlayıcı gerçek cevap üretir.
  - Birincil sağlayıcı çalışmazsa tanımlı fallback denenir.
  - Kullanıcı mesajı AI hatası yüzünden kaybolmaz.
  - AI başarısız olursa kota geri verilir.
  - Admin devralma sırasında AI tamamen susturulur.

  ———

  ## 11. Web Push yapılandırması

  Web Push kodu ve abonelik tablosu mevcut fakat canlı VAPID anahtarları
  gereklidir.

  İlgili dosyalar:

  lib/push.ts
  components/notification-control.tsx
  app/api/push/subscriptions/route.ts
  supabase/migrations/006_voice_messages_and_push.sql

  Gerekli değişkenler:

  NEXT_PUBLIC_VAPID_PUBLIC_KEY=
  VAPID_PRIVATE_KEY=
  VAPID_SUBJECT=mailto:admin@lovask.com

  ### Bildirim olayları

  - Yeni insan mesajı
  - Bot yanıtı
  - Adminin bot adına gönderdiği mesaj
  - Yeni eşleşme

  için bildirim gönderilebilir.

  ### Maliyet kontrolü

  - Ayrı cron veya sürekli polling kullanılmamalı.
  - Bildirim yalnızca olay gerçekleştiğinde gönderilmeli.
  - Hatalı endpoint birkaç başarısız denemeden sonra devre dışı bırakılmalı.
  - Aynı olay için çift bildirim önlenmeli.
  - Kullanıcı bildirimi istediği zaman kapatabilmeli.

  ### Kabul kriterleri

  - PWA üzerinden bildirim izni alınabilir.
  - Yeni mesaj bildirimi gelir.
  - Bildirime dokununca doğru sohbet açılır.
  - Bozuk abonelikler otomatik devre dışı bırakılır.
  - Bildirim izni reddedildiğinde arayüz hata döngüsüne girmez.

  ———

  ## 12. Canlı sunucu ve domain kurulumu

  Domain:

  lovask.com.tr

  Henüz sunucu/hosting kurulmadı.

  Next.js ve Supabase yapısı nedeniyle önerilen en kolay seçenek Vercel’dir.

  ### Vercel deployment

  - Proje Git deposuna alınmalı.
  - Vercel’e bağlanmalı.
  - Production environment değişkenleri eklenmeli.
  - lovask.com.tr ve tercihen www.lovask.com.tr bağlanmalı.
  - Bir adres ana domain olarak seçilmeli.
  - Diğeri canonical domaine yönlenmeli.

  ### Supabase URL ayarları

  Supabase Authentication URL Configuration:

  Site URL:
  https://lovask.com.tr

  Redirect URL örnekleri:

  https://lovask.com.tr/auth/callback
  https://www.lovask.com.tr/auth/callback
  http://localhost:3000/auth/callback

  Sadece gerçekten kullanılacak adresler eklenmeli.

  ### PWA kontrolü

  Canlı ortamda:

  - HTTPS
  - Manifest
  - İkonlar
  - Service worker
  - Mobil ana ekrana ekleme
  - Safe-area
  - Bildirim izni
  - Kamera/fotoğraf seçimi
  - Mikrofon izni

  test edilmeli.

  ### Kabul kriterleri

  - https://lovask.com.tr açılır.
  - SSL geçerlidir.
  - Auth callback doğru çalışır.
  - PWA telefona kurulabilir.
  - Fotoğraf ve ses yükleme çalışır.
  - Supabase signed URL görselleri açılır.
  - API anahtarları client bundle’a sızmaz.

  ———

  # Önerilen geliştirme sırası

  Diğer AI işleri şu sırayla yapmalı:

  1. Google ve Apple OAuth
  2. AI anahtarları ve gerçek bot sohbet testi
  3. Admin kullanıcı yönetimi
  4. Engelleme ve şikâyet sistemi
  5. Fotoğraf moderasyonu
  6. Okundu ve son görülme
  7. Noir haftalık/aylık paket sistemi
  8. Havale/Shopier ödeme onayı
  9. Web Push canlı yapılandırması
  10. Vercel ve lovask.com.tr deployment
  11. Uçtan uca mobil testler
  12. Güvenlik denetimi

  Ödeme sistemini en sona yakın yapmak daha güvenli; çünkü önce kullanıcı,
  moderasyon ve yetki akışlarının sağlam olması gerekir.

  # Her aşamada zorunlu kontroller

  Her değişiklikten sonra çalıştırılmalı:

  npm run lint
  npm run typecheck
  npm run build

  Ayrıca mobil tarayıcı testi yapılmalı:

  390 × 844
  360 × 800
  430 × 932

  Kontrol edilmesi gereken temel akışlar:

  - Kayıt
  - Giriş
  - OAuth
  - Onboarding
  - Fotoğraf kırpma
  - Profil güncelleme
  - Keşfet kartına tıklama
  - Ziyaret kaydı
  - Swipe
  - Bot eşleşmesi
  - İnsan eşleşmesi
  - Mesaj
  - Sesli mesaj
  - AI yanıtı
  - Mesaj kotası
  - Admin devralma
  - Ziyaretçiler
  - Noir erişimi
  - Ödeme
  - Engelleme
  - Şikâyet
  - Bildirim

  # Diğer AI’ye verilecek önemli talimatlar

  Şu talimatları ayrıca ekle:

  > Mevcut migration dosyalarını değiştirme. Yeni migration’lara 008’den devam
  > et. Service-role anahtarını hiçbir client component’e koyma. Bot silme
  > veya kaldırma özelliği ekleme. SMS ve telefon doğrulaması ekleme; telefon
  > opsiyonel ve doğrulamasız kalacak. E-posta doğrulamasını zorunlu hâle
  > getirme. Profil ziyaretini kart gösterildiğinde değil, kullanıcı profil
  > detayını açtığında kaydet. Noir’a özel verileri yalnızca CSS ile gizleme;
  > sunucuda yetki kontrolü yap. Her geliştirmeyi gerçek Supabase verisiyle,
  > mobil tarayıcıda ve production build ile doğrula. Mevcut premium, mesaj
  > kotası, bot kapanışı ve admin devralma davranışlarını bozma.

  Son bir güvenlik notu: Supabase service-role anahtarı daha önce sohbet
  içinde paylaşılmıştı. Canlı yayına geçmeden önce Supabase Dashboard’dan bu
  anahtarı yenilemen ve eski anahtarı geçersiz kılman gerekir.