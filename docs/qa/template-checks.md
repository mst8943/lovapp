# Lovask Rapor Şablonu Yerel Doğrulama ve Güvenlik Raporu

Bu doküman, `docs/qa/report-template.html` dosyasının yerel Playwright (Edge/Chromium headless) koşucusu ile doğrudan `file://` protokolü üzerinden açılmasıyla gerçekleştirilen teknik arayüz, filtreleme, erişilebilirlik ve XSS güvenlik denetimi sonuçlarını içermektedir.

> **Önemli Not:** Bu dokümanda yer alan sonuçlar **gerçek ürün veya canlı sistem testleri değildir**. Yalnızca statik HTML test raporu şablonunun arayüz işlevlerinin, filtreleme motorunun, veri giriş ayrımının (`renderReport`) ve XSS enjeksiyon korumasının yerel tarayıcı ortamında test edilmesidir.

---

## 1. Test Ortamı ve Yöntemi

- **Hedef Dosya:** `docs/qa/report-template.html` (Yerel dosya URI'si)
- **Kullanılan Test Aracı:** `playwright-core` (Microsoft Edge / Headless Chromium motoru)
- **Ağ İsteği:** 0 (Harici ağ bağlantısı veya CDN isteği yapılmamıştır)
- **Uygulama/Veritabanı Müdahalesi:** Yok

---

## 2. Doğrulama Senaryoları ve Sonuçları

| Test No | Doğrulanan Senaryo | Test Adımları ve Girdi | Beklenen Davranış | Gerçekleşen Sonuç | Durum |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **01** | **Varsayılan Yüklenme ve Temsili Veri Kontrolü** | Sayfa doğrudan açıldı. | `defaultMockRun` ve 10 adet temsili test satırı yüklenmeli; `run.isDemo === true` olduğu için sarı temsili veri uyarı bannerı görünür olmalı. | 10 test satırı başarıyla render edildi. Temsili veri bannerı (`#demoBanner`) görünür oldu. Toplam test stat kartı "10" değerini gösterdi. | **GEÇTİ** |
| **02** | **Boş Sonuç Listesi İzolasyonu (`renderReport`)** | `window.renderReport({ run: { isDemo: false }, results: [] })` çağrıldı. | Tablo gövdesi temizlenmeli, `#noResults` boş durum mesajı görünmeli, sayaç "0 / 0" olmalı ve demo bannerı gizlenmeli. | Satır sayısı 0'a indi; `#noResults` uyarısı ekranda belirdi; `#filterFeedback` "0 / 0 Test Gösteriliyor" yazdı; demo bannerı `isDemo: false` nedeniyle gizlendi. Sayaçların eski değerde kalma hatası görülmedi. | **GEÇTİ** |
| **03** | **Durum Filtresi Doğrulaması** | Durum filtresi "BAŞARISIZ" ve ardından "ENGELLİ" seçildi. | Yalnızca seçilen duruma ait satırlar tabloda listelenmeli. | "BAŞARISIZ" filtresinde tam 2 satır; "ENGELLİ" filtresinde tam 2 satır listelendi. Diğer satırlar filtrelendi. | **GEÇTİ** |
| **04** | **Metin Arama ve Canlı Filtreleme** | Arama kutusuna "Shopier" yazıldı. | Başlık, açıklama veya modülünde "Shopier" geçen testler listelenmeli. | 2 adet ilgili test satırı listelendi (İlk başlık: "Shopier ödeme webhook HMAC doğrulama ve paket tanımlama"). | **GEÇTİ** |
| **05** | **Sıfır Sonuç Veren Arama** | Arama kutusuna "KelimeBulunamazXYZ" yazıldı. | Tablo sıfır satır göstermeli ve boş durum uyarısı belirmeli. | 0 satır listelendi; `#noResults` mesajı görünür oldu; üstteki genel test sayaçları ise tüm koşumun toplamını (10) korudu. | **GEÇTİ** |
| **06** | **Filtrelerin Sıfırlanması** | `#resetFilters` butonuna tıklandı. | Arama kutusu ve select filtreleri boşaltılmalı, tüm 10 test satırı yeniden listelenmeli. | Arama kutusu temizlendi (`""`); filtreler sıfırlandı; 10 satır eksiksiz geri yüklendi. | **GEÇTİ** |
| **07** | **Klavye Erişilebilirliği (ARIA & Focus)** | `TC-AUTH-01` detay butonuna klavye odağı verilip `Enter` ve `Space` tuşlarına basıldı. | `aria-expanded` niteliği ve akordiyon sınıfı (`open`) klavye tuşlarıyla dinamik açılıp kapanmalı. | `Enter` sonrası: `aria-expanded="true"`, `detail-row.open=true`. `Space` sonrası: `aria-expanded="false"`, `detail-row.open=false` olarak teyit edildi. | **GEÇTİ** |
| **08** | **Dar Ekran (Mobil Viewport 375x667) Uyumu** | Viewport 375x667 (iPhone SE boyutu) olarak ayarlandı. | Sayfa kök gövdesinde yatay taşma (horizontal body scroll) oluşmamalı; geniş tablo konteyneri içinde yatay kaydırma sağlanmalı. | `document.documentElement.scrollWidth <= window.innerWidth` teyit edildi (Gövdede taşma yok). Tablo konteyneri duyarlı (responsive) biçimde kaydırılabilir kaldı. | **GEÇTİ** |
| **09** | **XSS ve Zararlı Script Enjeksiyonu Koruması** | `renderReport` fonksiyonuna hata mesajı, adımlar ve log alanlarında `<script>alert('xss')</script>`, `<img src=x onerror=alert('img')>` ve `evidenceUrl: "javascript:alert('link')"` içeren zararlı veri nesnesi verildi. | Hiçbir JavaScript kodunun veya tarayıcı alert iletişim kutusunun tetiklenmemesi; HTML etiketlerinin `textContent` sayesinde kaçışlı düz metin olarak güvenle ekranda kalması; `javascript:` bağlantısının reddedilmesi. | Tarayıcıda hiçbir alert tetiklenmedi (`page.on('dialog')` tetiklenme sayısı: 0). Log kutusunda `<img src=x onerror=alert('log')>` ifadesi düz metin olarak güvenle okundu. `javascript:` protokolü içeren URL sanitize edilerek `<a>` etiketi oluşturulması engellendi. | **GEÇTİ** |

---

## 3. Doğrulama Sonucu ve Çıkarımlar

1. **Güvenlik:** Dinamik metinlerin `textContent` ile DOM'a bağlanması ve URL'lerin `sanitizeEvidenceUrl` filtresinden geçirilmesi, rapor şablonunun dışarıdan gelebilecek üçüncü taraf test logları veya hata mesajları karşısında XSS açıklarına karşı tam korumalı olduğunu doğrulamıştır.
2. **Erişilebilirlik:** `aria-expanded` ve `aria-controls` dinamik nitelikleri ekran okuyucular ve klavye gezintisi ile tam uyumludur.
3. **Veri Ayrımı:** Şablon, `renderReport({ run, results })` API'si ile bağımsız bir tüketici haline getirilmiş; statik dosya üzerinden dinamik rapor besleme altyapısına hazır hale getirilmiştir.
