# Lovask tasarım token kataloğu

Kaynak: `app/globals.css`, `components/lovask-app.css`, `components/lovask-app-light.css`, `@fontsource` bağımlılıkları ve public görseller.

## Renkler

| Token | Değer | Kullanım |
|---|---|---|
| ink | `#0b090d` | ana arka plan |
| ink-2 | `#151119` | koyu yüzey |
| panel | `#1b151d` | kart/panel |
| wine | `#7b1831` | aksan/aktif durum |
| ruby | `#c23b5a` | like/uyarı |
| gold | `#d8b56c` | marka, seçili öğe |
| champagne | `#f1dba8` | başlık ve vurgu |
| pearl | `#f8f3ec` | ana metin |
| muted | `#aaa0a9` | ikincil metin |
| line | `rgba(241,219,168,.16)` | sınır |

Açık varyantta temel yüzey `#fff8f5`, metin `#352b3c`, aksan `#d62f58`, sınır `#eee3e5`.

## Tipografi

- Display: Cormorant Garamond, fallback Georgia/serif.
- Body: Manrope, sans-serif.
- Kart profil adı yaklaşık 41px display; app markası 32px; nav/yardımcı metin çoğunlukla 14–15px.

## Geometri ve hareket

- Mobil shell en fazla 480px, tam yükseklik; içerik alt nav için yaklaşık 98px padding taşır.
- Kart radius 30px; sheet üst köşeleri 30px; chip/pill 99px; küçük kontrol 12–14px; profil grid kartı 22px.
- Alt nav 82px, safe-area bottom; buton dokunma yüksekliği en az 42–54px.
- Swipe kartında Motion tabanlı geçiş, altta ghost kartlar, vignette ve düşük yoğunluklu ambient blur vardır. Ağ çağrısı swipe gesture sırasında yapılmamalı; karar tamamlanınca API çağrılmalı.
- Reduced-motion desteği ve görünür focus outline mevcut davranışın parçasıdır.

## Varlıklar

`public/logo*.png/jpg`, `public/pwa/icon-*.png`, `public/profiles/*`, `public/landing/*`, `public/hero_*` referans alınacak. Font ve ikonlar Flutter karşılığına çevrilirken şekil, ağırlık ve metin korunacak; yeni marka görseli üretilmeyecek.
