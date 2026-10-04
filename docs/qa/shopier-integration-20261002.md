# Shopier ürün linki ödeme akışı — 2026-10-02

Shopier, geliştirici API'sinin Lovask'ın kendi satışına uygun olmadığını yazılı bildirdi. OAuth ve webhook bağlantısı kullanılmıyor; ilgili canlı uçlar 410 dönüyor.

## Canlı akış

- Haftalık Noir: https://www.shopier.com/lovapp/49985664 — 199 TL.
- Aylık Noir: https://www.shopier.com/lovapp/49836409 — 599 TL.
- 1 Saatlik Noir planı 070 geçişiyle pasife alındı; eski sipariş kayıtları korunuyor.
- Üye uygulamada ödeme talebi oluşturur ve Shopier ürün bağlantısında öder. Shopier sipariş numarasını, alıcı adını ve ödeme tarihini Lovask'a bildirir. Fotoğraf/PDF isteğe bağlıdır ve ödeme kanıtı sayılmaz.
- Üye bildirimi yalnızca `under_review` durumuna geçer. Owner, Shopier satıcı panelinde sipariş numarası, ürün, tutar ve başarılı ödeme durumunu kontrol edip yönetim panelinde onayladığında Noir hakkı açılır. Aynı Shopier sipariş numarası ikinci kez onaylanamaz.
- Bu paketler tek seferliktir; otomatik yenileme ve otomatik Noir onayı yoktur.

## Kontroller ve açık işler

- `069_shopier_link_manual_approval.sql` canlıya uygulandı; `supabase db push --linked --dry-run` güncel. Yerel Next derlemesi ve Flutter analizi geçti. Android 1.9.9 (37) eski yayın sertifikasıyla imzalandı; SHA-256 `D1BC012726A0394AB04025C381A7E9D1BFF926250AB4FA6369EEA0B3A1CE9CE4`.
- Canlı `/noir` ve `/download` 200; OAuth bağlantısı ve webhook POST 410. Ürün sayfalarındaki 199/599 TL fiyatları kontrol edildi.
- Gerçek kart tahsilatı ve owner onayı henüz uçtan uca denenmedi. Shopier ürün başlıklarındaki eski sabit `LVK-...` kodları Shopier panelinde kaldırılmalı; Lovask kodu uygulama içi takip, Shopier sipariş numarası ayrı alandır.
