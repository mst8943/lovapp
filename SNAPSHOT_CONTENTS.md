# Snapshot kapsamı

Bu belge `Lovask-AI-Handoff-2026-08-14.zip` arşivinin kapsamını açıklar.

## Dahil

- Next.js/React kaynak kodu (`app`, `components`, `lib`)
- Public PWA ve web varlıkları (`public`)
- Supabase migration'ları (`supabase`)
- Bakım ve smoke test scriptleri (`scripts`)
- Yapılandırma dosyaları ve lockfile
- Android TWA kaynakları ve imzalı APK
- Proje belgeleri
- `.env.example`

## Hariç

- `.env`, `.env.local`, `.env.production.local` ve tüm gerçek secret değerleri
- `node_modules`, `.next`, `.vercel`
- Android Gradle cache/build ara çıktıları
- Release keystore ve keystore şifresi
- Yerel loglar ve geçici dosyalar
- Önceki ZIP yedekleri
- Canlı veritabanı satırları, Auth kullanıcıları ve Supabase Storage içeriği

`SHA256SUMS.txt`, arşiv üretiminden önce pakete alınan dosyaların bütünlük listesidir. Arşivin yanındaki `Lovask-AI-Handoff-2026-08-14.ARCHIVE_SHA256.txt` dosyası ZIP'in kendi SHA-256 değerini ayrıca içerir.
