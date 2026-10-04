# Lovask organik büyüme — kurulum ve operasyon teslimi

Tarih: 16 Ağustos 2026

Bu dosya, `docs/organic-member-acquisition-plan.md` içindeki stratejinin projeye eklenen teknik karşılığını ve yayına çıkmak için hesap sahibi tarafından yapılacak adımları anlatır.

> **Güncel durum — 16 Ağustos 2026:** Migration kullanıcı tarafından uygulandı; uygulama canlıya alındı; başvuru, kabul, 24 saatlik güvenli davet, şifre belirleme ve onboarding akışı gerçek hesapla doğrulandı. Aşağıdaki ilk kurulum adımlarının önemli bölümü artık tarihsel kayıt niteliğindedir. Açık kalan operasyonel maddeler hukuki kimlik bilgileri, isteğe bağlı Netgsm kurulumu ve ikinci kullanıcıyla referans ödülü tekrar/idempotency kontrolüdür.

## Projede tamamlananlar

- `/kurucu-uye`: İstanbul'daki ilk 200 tamamlanmış profil için kampanya sayfası, canlı kontenjan ve kaynak koruyan başvuru bağlantısı.
- `/privacy`, `/terms`, `/community-guidelines`: başvuru ekranından bağlantı verilen kamuya açık metinler.
- Başvurularda ilk temas atfı: kampanya, referans kodu, UTM kaynağı/ortamı/kampanyası/içeriği, iniş yolu ve ilk yönlendiren.
- Birinci taraf büyüme olayları: görüntüleme, başvuru, onay, davet, onboarding, paylaşım, referans aktivasyonu ve ödül.
- Kurucu üyelik: ilk 200 insan profilinin onboarding tamamlamasıyla 30 gün Noir; tekrar çalıştırmaya karşı idempotent.
- Üye referansı: profil ekranında kişisel bağlantı; davet edilen insan profilini tamamlayınca iki tarafa birer kez 7 gün Noir.
- Kurucu üye etiketi ve profil içi referans istatistikleri.
- `/admin/lovask-control/growth`: kaynak hunisi, kontenjan, kodlar, aktivasyonlar ve toplam ödül günü.
- Owner rolü için topluluk/elçi/kampanya kodu üretme, bağlantı kopyalama ve kodu açıp kapatma.
- Sitemap ve robots kapsamına kampanya ve hukuki sayfalar.
- Ana sayfanın birincil çağrısı Kurucu Üyelik sayfasına yönlendirildi.
- Admin anahtarına bağlı açık/kontrollü üyelik modu: açıkken standart kayıt, kontrollü modda Kurucu Üyelik.
- Kabul e-postasında 24 saat geçerli Lovask erişim bağlantısı; e-posta tarayıcılarına karşı kullanıcı onayından sonra taze Supabase oturumu üretimi.
- Giriş ve geçersiz bağlantı ekranlarında görünür şifre sıfırlama bağlantısı.
- Kurucu üyeye yeni oturumlarda kişisel referans hakkını ve ödülleri hatırlatan modal.
- Canlı `KURUCU50` kampanya kodu ve ilk 10 topluluk/yönetici hedef listesi.

Botlarla ilgili hiçbir dosya, davranış, veri veya otomasyon bu çalışma kapsamında değiştirilmedi. Yeni aktivasyon fonksiyonu yalnızca `profiles.kind = 'human'` koşuluyla çalışır.

## İlk kurulum kontrol listesi — güncel durum

### 1. Supabase yönetim yetkisi — açık ama yayına engel değil

Bu çalışma sırasında CLI, bağlı projeyi gördü ancak mevcut Supabase hesabı yönetim API'si için gerekli yetkiye sahip değildi. Migration kullanıcı tarafından uygulanabildiği ve canlı uygulama çalıştığı için bu artık yayın engeli değildir; ileride Auth gibi proje ayarlarını CLI/API üzerinden yönetmek için doğru Supabase hesabına Owner veya yeterli Developer yetkisi verilmelidir.

### 2. Migration — tamamlandı

Repo kökünde:

```powershell
supabase link --project-ref jagqvyfnychnoxarebgv
supabase db push --dry-run
supabase db push
```

Migration kullanıcı tarafından canlı projeye uygulandı.

### 3. Hukuki kimlik bilgisini tamamla — bekliyor

`app/privacy/page.tsx` içindeki veri sorumlusu bölümüne şirket/şahıs işletmesi unvanı, adresi ve gerekiyorsa MERSİS/VKN bilgisini ekle. `destek@lovask.com.tr` adresinin gerçekten teslim aldığını doğrula. Metinleri yayından önce hukuk danışmanına kontrol ettir; teknik ekip gerçek tüzel kişi bilgisini varsayarak yazamaz.

### 4. Production ortam değişkenleri — temel yapı tamamlandı

Vercel/hosting panelinde en az şunlar dolu olmalı:

- `NEXT_PUBLIC_APP_URL=https://lovask.com.tr`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RATE_LIMIT_HMAC_SECRET`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- Başvuru bildirimi için `RESEND_*` ve `NETGSM_*`

Service-role anahtarını istemciye açık bir değişkende tutma.

Supabase, Resend, Turnstile ve rate-limit değişkenleri canlıda çalışıyor. Netgsm değişkenleri eklenmediği için SMS bildirimleri isteğe bağlı açık iş olarak duruyor.

### 5. Uygulamayı deploy et — tamamlandı

Uygulama `https://lovask.com.tr` adresinde canlıya alındı ve sonraki üyelik güncellemeleri de production'a aktarıldı.

### 6. Uçtan uca duman testi — ana akış tamamlandı

Test bağlantısı:

```text
https://lovask.com.tr/kurucu-uye?ref=KURUCU200&utm_source=manual_test&utm_medium=referral&utm_campaign=kurucu200
```

Sırayla:

1. [x] Gizli pencerede sayfayı aç ve Kurucu Üyeliğe Başvur'a bas.
2. [x] Şehrin İstanbul ve salt okunur geldiğini, hukuki bağlantıların açıldığını kontrol et.
3. [x] Gerçek erişebildiğin benzersiz e-posta/telefonla başvur.
4. [x] Admin → Başvurular'da başvuruyu gör, onayla ve davet gönder.
5. [x] Davet hesabıyla profil ve fotoğraf onboarding'ini tamamla.
6. [x] Kurucu Üye durumu, kişisel referans bağlantısı ve Noir erişimini kontrol et.
7. [x] Yeni 24 saatlik e-posta → Lovask güvenli erişim → şifre belirleme akışını doğrula.
8. [ ] Üye bağlantısıyla ikinci bir test kişisi başvurup onboarding tamamlasın; iki hesapta da 7 gün eklendiğini doğrula.
9. [ ] Aynı finalize isteğini tekrar göndererek ödülün ikinci kez eklenmediğini kontrol et.

Test kayıtlarını üretimde bırakmak istemiyorsan yalnızca kendi kontrolündeki hesaplarla test et ve mevcut güvenli hesap silme akışını kullan.

## Günlük kullanım

1. Admin → Büyüme → Kodlar bölümünden her topluluk veya elçi için ayrı kod üret.
2. Kopyalanan bağlantıyı yalnızca ilgili kanalda kullan; bir linki her yere dağıtma.
3. Her gün kaynak bazında başvuru ve onay sayısını kontrol et.
4. Çok başvuru ama az onay getiren kaynağın mesajını veya hedef kitlesini değiştir.
5. Onay alan ama onboarding tamamlamayan kişilere kişisel, tekil hatırlatma gönder.
6. Kurucu sayaç 200'e ulaştığında kampanyayı kapatmak için veritabanındaki `growth_campaigns.is_active` değerini kapat; yeni bir teklif hazırlamadan “son yer” mesajı kullanma.

## Instagram ve diğer organik erişim

DM ve yorum operasyonu tamamen manuel kalmalı. Platform limitini aşmayı hedefleyen otomasyon, çoklu hesap döndürme veya aynı mesajı seri gönderme yoktur. Her temas için:

- Önce profili ve son içeriği gerçekten incele.
- Mesajı kişiye özgü bir bağlamla başlat.
- İlk mesajda satış baskısı kurma; uygunluk varsa kampanya bağlantısını paylaş.
- Yanıt yoksa en fazla bir nazik takip yap, sonra dur.
- Ret, sessizlik veya “iletişim istemiyorum” sinyalini kalıcı olarak bastır.
- Gönderim hacmini değil olumlu yanıt ve tamamlanan profil sayısını optimize et.

Günlük çalışma temposu, mesaj örnekleri, güvenli iç limitler ve spam önleme kontrol listesi için `docs/organic-member-acquisition-plan.md` içindeki “Instagram DM” bölümünü uygula.

## Teknik doğrulama sonucu — güncel

- `npm run typecheck`: başarılı
- `npm run lint`: başarılı
- `npm run build`: başarılı (Next.js 16.3.0, 77 rota)
- Canlı sağlık kontrolü: başarılı (`200`)
- Supabase migration: kullanıcı tarafından uygulandı
- Gerçek başvuru ve davet akışı: başarılı
