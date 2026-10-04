# Gelir ve bot kalitesi için öneriler

Bu bölüm uygulanan özellikleri değil, test ve mevcut ürün kurallarından çıkan adayları listeler. Fiyat, dönüşüm veya gelir artışı tahmin edilmedi; karar için gerçek kullanım verisi gerekir.

| Öncelik | Öneri | Neden | Ölçüm ve sınır |
| --- | --- | --- | --- |
| 1 | Mevcut Noir ödeme akışını tamamla | Saatlik, haftalık ve aylık paketler var; Android push teslimi ve ödeme sonrası iki istemcide hak güncellemesi güvenilir biçimde doğrulanmadan yeni ürün eklemek dönüşüm kaybını gizler. | Ödeme başlatma → onay → iki istemcide hak görünmesi; başarısız/tekrarlanan webhook oranı. |
| 2 | Süreli profil öne çıkarma (Boost) için küçük deney | Ayrı tüketilebilir ürün, mevcut Noir paketlerini değiştirmeden görünürlüğü sınayabilir. Rakip örneğinde 30 dakikalık görünürlük penceresi kullanılıyor. | Gerçek uygun kullanıcılardan gelen gösterim ve karşılıklı beğeni artışı; satın alma dönüşümü; şikâyet ve engelleme oranı. Filtreleri, engelleri veya güvenlik kurallarını aşmasın. Eşleşme garantisi verilmesin. |
| 3 | Mevcut hak ve teklif metinlerini iyileştir | Standart/Noir beğeni, süper beğeni ve mesaj hakları çok parçalı. Kalan hak ve yenilenme zamanı ödeme kararından önce açık görünmeli. | Paket sayfası → ödeme başlatma oranı, destek talebi, iptal/itiraz nedenleri. |
| 4 | Wingman yanıt kalitesi | Mobil tetikleyici ve sunucu kotası var. Canlı önerinin taslağa yerleşmesi, tekrar ve bağlam tutarlılığı henüz cihazda doğrulanmadı. | Kabul edilen öneri oranı, gönderilmeden düzenleme oranı, şikâyetler ve öneri başına AI maliyeti. |
| 5 | Bot cevap kuyruğu ve persona denetimi | Kaynakta varsayılan gecikme, hafıza ve davranış kontrolleri var. Tekrar, yanlış geçmişe atıf ve çift yanıt için kontrollü senaryo seti gerekli. | Aynı senaryoda önce/sonra kalite puanı, gecikme, çift cevap, kullanıcı engellemesi ve AI maliyeti. `PRODUCT_RULES.md` içindeki pozitif karar eşikleri ve hız sınırları korunmalı. |

Boost için karşılaştırma: [Tinder abonelik özellikleri](https://www.help.tinder.com/hc/en-us/articles/115004487406-Tinder-subscriptions) ve [30 dakikalık Boost örneği](https://www.help.tinder.com/hc/en-us/articles/115004506186-Boost). Bu, Lovask için talep veya fiyat kanıtı değildir.

Android push için sunucu tarafında Firebase service account ve HTTP v1 gerekir; [Firebase'in resmi gönderim kılavuzu](https://firebase.google.com/docs/cloud-messaging/send/v1-api) bunu doğrular. Sunucu kimliği ve HTTP v1 kodu yapılandırıldı. Emülatör ADB bağlantısı kesildiği için ön/arka plan bildiriminin cihazda görünmesi ve bildirime dokunarak sohbet açılması hâlâ canlı olarak doğrulanamadı.
