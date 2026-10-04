# Lovask Orbit — mobil tasarım sistemi

İki farklı yörüngenin karşılaşması. Lovask'ın yeni mobil kimliği; kesişen elipsler, çapraz köşeleri yuvarlatılmış portreler, gece eriği yüzeyler ve açık leylak zemin üzerine kurulu.

## Temel kararlar

| Rol | Değer |
| --- | --- |
| Zemin | `#F5F3F8` |
| Yüzey | `#FFFFFF` |
| Metin | `#281F38` |
| Ana eylem | `#674189` |
| Gece yüzeyi | `#261C35` |
| Açık vurgu | `#E1CFF1` |
| Başlık | Paketlenmiş Cormorant Garamond |
| Gövde ve kontroller | Paketlenmiş Manrope |
| Aralık | 4 / 8 / 12 / 16 / 24 / 32 |
| Kontrol / kart / panel yarıçapı | 16 / 24 / 32 |
| Portre köşeleri | Çapraz 64 / 24 |

Renk, tipografi ve Material kontrol temaları `lib/theme.dart` içinde. Ortak sembol, wordmark, başlık, yüzey, portre, boş durum, buton, avatar ve alt panel `lib/widgets/lovask_primitives.dart` içinde. Yörünge sembolü Flutter Canvas ile çizilir; yeni paket veya uzaktan font yüklemesi gerekmez.

## Ekranlar

- **Keşfet:** Fotoğrafın altında sabit karar kontrolleri. Kısa ekranlarda başlık kısalır; rozet ve imza metni kart yüksekliğine göre gizlenir, tam bilgi profil detayında kalır.
- **Galeri, beğeniler, ziyaretçiler:** Ortak portre kartı; büyük metinde tek sütun. Noir kilitli durumlarında sahte kişi fotoğrafı kullanılmaz.
- **Mesajlar:** Eşleşmeler, istekler, arama ve okunmamış sayıları; sohbette koyu gönderilen mesajlar, açık gelen mesajlar ve çok satırlı yazma alanı.
- **Profil:** Kişisel kapak, gerçek istatistikler, profil önizlemesi, fotoğraflar ve Noir erişimi. Ayarlar ayrı bir sayfada.
- **Profil detay:** Fotoğraf galerisi, kimlik, kişisel cevap ve yaşam bilgileri. Alt bölümde mesaj eylemi; kendi profil önizlemesinde bulunmaz.
- **Filtreler:** Yaş/yakınlık, ilişki niyeti ve Noir filtreleri; altta kalıcı kaydetme eylemi ve mevcut kaydetmeden çıkış onayı.
- **Noir:** Koyu üyelik kapağı, belirgin paket seçimi, mevcut sağlayıcılarla ödeme ve sipariş geçmişi.
- **Onboarding:** Altı adım, her adım için ayrı başlık, ilerleme çizgisi, klavyeden bağımsız kaydırılabilir form.
- **Ayarlar ve yardımcı ekranlar:** Görünürlük, bildirimler, engellenenler, destek, davet ve kurtarma aynı bileşenleri kullanır.

## Mobil davranış

Profil ve form kartları ince ayırıcı çizgiler kullanır. `LovaskFormCard`, alan başlıklarını sürekli görünür tutar; odak ve hata durumlarını alt çizgiyle belirtir. Profil bilgi satırları mevcut düzenleme akışına bağlanır.

Ortak kontroller en az 48 px dokunma alanına sahiptir. Alt navigasyon güvenli alana uyar. Formlar ve paneller klavye ile kaydırılabilir; fotoğraf hataları için yer tutucular vardır. Mevcut azaltılmış hareket, kaydırma geri dönüşü, haptic ve mesaj taslağını koruma davranışları devam eder.

API ve modeller değiştirilmedi. Profil ve ödeme verileri sunucudan gelir. Ekran görüntülerindeki kişiler, mesajlar ve fiyatlar test fixture'larıdır.

## Kontrol komutları

```powershell
flutter analyze
flutter test
```

Görsel referanslar `test/goldens/` altında. `design-preview.html` ana ekranları yan yana gösterir. `screen_layout_test.dart` küçük ekranı, büyük metni, klavyeyi, safe area'yı, menü geçişlerini ve ayar değişikliğini kontrol eder.
