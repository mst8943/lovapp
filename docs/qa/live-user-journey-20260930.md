# Canlı kullanıcı yolculuğu kontrolü — 30 Eylül 2026

Canlı adres: `https://lovask.com.tr`. Emülatör: `emulator-5554`. Android paketi: `1.9.2+30`.

| Akış | Sonuç |
| --- | --- |
| Web kayıt ekranı | Gerçek form gönderimi `200`; `/onboarding` yönlendirmesi ve oturumlu onboarding isteği `200`. Geçici hesap ve kayıt dönüşüm olayı silindi. |
| Kayıt ve fotoğraf API akışları | Üç geçici hesapta kayıt/giriş, yanlış şifre ve alan doğrulamaları, profil kaydı, boş/geçersiz fotoğraf reddi, PNG yüklemesi ve onay bekleyen fotoğrafla tamamlama reddi geçti. Üç hesap ve depolama dosyaları temizlendi. |
| Web girişi ve beğeni | QA hesabıyla web girişi geçti. Keşfetteki ilk kart API tarafından bot olarak doğrulandı; arayüzde Beğen tıklaması `200` döndü. Bu hesap botun gecikmeli eşleşme grubunda değildi; eşleşme oluşmadı. Test beğenisi, görev/XP ve günlük kullanım kayıtları geri alındı. |
| Web → mobil sohbet | Yalnızca iki işaretli QA hesabı arasında geçici eşleşme açıldı. Webden yazılan mesaj mobil API ve veritabanında doğrulandı. Geçici eşleşme, mesajlar, bildirim kuyruğu ve günlük mesaj kullanımı temizlendi. |
| Android emülatör | Kurulu sürüm `1.9.2+30` doğrulandı. QA hesabıyla giriş ve Keşfet, Beğeniler, Buluşma, Mesajlar ve Profil sekmeleri geçti. |
| QA ayrımı | İki işaretli QA A/B ve adı açıkça test verisi olan sekiz profil keşiften gizlendi. Hesaplar silinmedi. Şu an keşfedilebilir ve tamamlanmış 7 insan, 331 bot profili var. |

## Yayın öncesi önemli bulgu

QA A hesabının canlı keşif yanıtında ilk 12 profilin tamamı `isBot: true` idi (yanıtta toplam 40 bot kartı vardı). Android arayüzünde ilk kart “Cansu, 24” olarak göründü ve yapay zekâ profili etiketi yoktu. API bot bilgisini iletiyor, fakat web ve Android kullanıcı arayüzlerinde görünür etiket doğrulanamadı. Gerçek üye arzı 7 görünür insan profili olduğundan reklam bütçesini büyütmeden önce bu görünürlük ve bot açıklaması ele alınmalı.

## Bu denemede doğrulanmayanlar

- Gerçek insan hesabıyla profil fotoğrafının moderatör tarafından onaylanması ve profil tamamlama; yeni kayıt testinde bekleyen fotoğrafla tamamlama doğru biçimde reddedildi.
- Botla eşleşme, botun ilk mesajı ve yapay zekâ yanıtının sohbet içinde uçtan uca üretilmesi. Gerçek bot beğenisi başarılı oldu, ancak test botu eşleşme kohortuna girmedi.
- Gerçek cihazda ilk kurulum ve tek seferlik 3 günlük Noir hakkı.
- Gerçek push teslimi, selfie onayı, fotoğraflı sohbet, şifre sıfırlama, gerçek ödeme ve gerçek hesaplarla Boost sıralaması.

Üretim uygulama kodu değiştirilmedi. Test hesapları ve geçici etkileşim verileri temizlendi; QA profillerinin keşfedilebilirliği kapatıldı.
