# 2 Ekim 2026 yayın adayı — 1.9.5 (33)

**Durum: yerel aday; canlıya alınmadı.** Bot etiketi çalışması kullanıcının isteğiyle bu kapsamın dışındadır.

| İş | Sonuç |
| --- | --- |
| Web lint, tür ve üretim derlemesi | Geçti; önceden bilinen 7 lint uyarısı var. |
| Flutter widget/ekran testleri | 44 geçti, 1 atlandı. Noir test verisine etkin Shopier planı eklendi; destek adresini içeren görsel beklentiler güncellendi. |
| Web–mobil–admin canlı QA eşleşmesi | Geçti; ayrı oturumlar ve keşif/sohbet verisi doğrulandı, geçici görünürlük değişimi geri alındı. |
| QA web→mobil metin ve fotoğraflı sohbet | Geçti. Fotoğraf WebP saklandı, alıcı sohbetinde görüntülendi; geçici eşleşme, dosya ve kullanım kayıtları temizlendi. |
| Canlı admin/dönüşüm paneli | 13 admin sayfası ve `/api/admin/growth` 200; toplamlar ve ürün hunisi alındı. |
| Kayıt/Noir/Boost/selfie durumu | QA hesabıyla ilgili salt okunur uçlar 200; selfie onayı ve gerçek Boost sıralaması geçmedi. |
| Şifre kurtarma | QA hesabında admin tarafından üretilen tek kullanımlık kurtarma bağlantısı, webde yeni parola belirleme, yeni parolayla giriş ve eski parolaya geri dönüş geçti. E-postanın gerçek teslimi denenmedi. |
| APK güncelleme | İmzalı 1.9.5 (33) `emulator-5554` üzerinde kuruldu ve uygulama süreci açıldı. Önceki 1.9.4 (32) adayı için görsel ana ekran doğrulanmıştı; 33 için yeniden görsel kontrol yapılmadı. |
| APK temiz kurulum | İkinci emülatörde önceki durum snapshot ile saklandı, uygulama kaldırılıp 1.9.5 (33) temiz kuruldu; sürüm ve süreç açılışı doğrulandı. Görsel açılış bu emülatörün siyah/bozuk yakalama sorunu nedeniyle doğrulanamadı. |
| QA veri temizliği | 10 yetim QA eşleşme/ilk mesaj dönüşüm olayı silindi. Yenilenen testler sonrası yetim olay sayısı 0; keşfedilebilir insan sayısı 7. |

İmzalı APK: `artifacts/release/lovask.apk` ve yerel `public/lovask.apk`; SHA-256 `65B407FF60158F8BAEAB70AF1E8D2721E67505F9F78BF46DB060057227A1903D`. Yayın sertifikası SHA-256 `33c6ab7bc340355404e0a90f416cc8b467339dce215298131d684219e600e4e2`. Önceki yerel APK'ler ve 1.9.4 (32) adayı `C:\MAMP\htdocs\lovask-apk-backup-20261002` içinde saklandı.

Canlı indirme yönlendirmesi hâlihazırda `v=32` yazıyor, fakat CDN'den indirilen **mevcut canlı APK** özeti `28E1040736092E3913D106300809BE9158E3CD6C88221A5BD2FFE23C19DFDBC3`. Bu, yukarıdaki yeni adaydan farklıdır. Yeni adayın yönlendirmesi kaynakta `v=33` olarak değiştirildi, sunucuya aktarılmadı. Karşılaştırılan canlı dosya da proje dışı APK yedeğine taşındı.

**Açık doğrulamalar:** Fiziksel Android cihaz yok; indirme→ilk kurulum→kayıt→profil→tek seferlik 3 günlük Noir, gerçek push teslimi, kırpma ve hız ölçümü fiziksel cihazda geçmedi. Gerçek selfie inceleme/onayı ve sıfırlama e-postasının teslimi geçmedi. Aktif Boost 0 olduğundan gerçek üyeler arasında sıralama etkisi gözlenmedi. Resend/Netgsm anahtarları yok; kullanıcı bunları şimdilik bırakmamızı istedi, doğrulama kanalları kapalı. Gerçek üye arzı 7; [edinim planı](../marketing/real-member-acquisition-20261002.md) hazır, kampanya/harcama başlatılmadı.

Eski devir notundaki “tam 6 karakter” ifadesi güncel değil. Kullanıcı 6–128 karakter kuralını onayladı; kayıt, kurtarma ve Android kodu bu aralığı kabul ediyor. Eski uzun şifreli hesapların girişi sürüyor.

Shopier için `067` geçişi, sunucu gizli ortam değişkenleri, owner OAuth bağlantısı, webhook kaydı, ürün fiyat karşılaştırması ve gerçek ödeme/iade testi bekliyor; [Shopier yayın adımları](shopier-integration-20261002.md) ayrı. Bu koşullar tamamlanmadan ödeme akışı ve sürüm **canlıya hazır** sayılmamalı. Yayında önce DB/web/APK yedeği al, geçiş ve sunucu yapılandırmasını uygula, aynı kaynak sürümünden web/API ile imzalı APK'yi birlikte yayınla, `/api/download/android` yönlendirmesini ve CDN APK özetini karşılaştır. Geri dönüş için yedekteki web derlemesi/APK'yi geri koy; DB geçişini otomatik geri alma yerine yedek ve şema etkisini değerlendir.

`supabase/INSTALL.sql` 67 migration'dan yeniden üretildi; `067_shopier_oauth_connection.sql` içeriyor. Bu paket yalnız boş Supabase projesi içindir, mevcut canlı veritabanında migration geçmişi üzerinden geçiş uygulanmalıdır.
