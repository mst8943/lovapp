# Aşama 2 — Flutter temel mimarisi ve tasarım sistemi

## 1. İncelenen mevcut davranış

Audit belgelerindeki beş sekmeli mobil akış, koyu Lovask renk tokenları, kart/aksiyon yapısı ve alt navigasyon referans alındı.

## 2. Yapılan değişiklik

- `apps/mobile` altında Flutter 3.44.2 Android projesi oluşturuldu.
- GoRouter eklendi; route kabuğu `/` olarak tanımlandı.
- Supabase Flutter SDK bağımlılığı eklendi; henüz production bağlantısı başlatılmadı.
- Native widget tabanlı keşfet, beğeniler, mesajlar ve profil ekranları oluşturuldu.
- Lovask renkleri, kart radiusları, alt navigasyon ve swipe aksiyon görünümü temel seviyede taşındı.
- Secret içermeyen `.env.example` eklendi.

## 3. Değiştirilen dosyalar

- `apps/mobile/pubspec.yaml`
- `apps/mobile/pubspec.lock`
- `apps/mobile/lib/main.dart`
- `apps/mobile/test/widget_test.dart`
- `apps/mobile/.env.example`
- Flutter tarafından oluşturulan `apps/mobile/android/**` iskeleti

## 4. Backend veya veritabanı etkisi

Yok. Supabase bağlantısı ve API entegrasyonu sonraki auth/session aşamasında mevcut sözleşmeler üzerinden yapılacak. Migration/RLS/API değişikliği yok.

## 5. Çalıştırılan komutlar

- `flutter create --org tr.com.lovask --project-name lovask_mobile --platforms=android apps/mobile`
- `flutter pub get`
- `dart format lib test`
- `flutter analyze`
- `flutter test`
- `flutter build apk --debug`
- Root `npm run typecheck`

## 6. Gerçek test sonuçları

- `flutter analyze`: geçti, issue yok.
- `flutter test`: geçti, 1 widget testi.
- `flutter build apk --debug`: geçti.
- `npm run typecheck`: geçti.
- APK: `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`.

## 7. Görsel uyumluluk sonucu

Temel renk, typography fallback, kart, chip, aksiyon ve alt navigasyon yapısı taşındı. Görsel eşdeğerlik henüz tamamlanmış sayılmaz; gerçek ekran karşılaştırması ve mevcut görsel asset entegrasyonu sonraki ekran aşamalarında yapılacak.

## 8. Riskler ve eksikler

- Bu sürüm demo verili native shell'dir; auth, gerçek API, Realtime, medya ve push henüz bağlanmadı.
- Debug APK cihazda doğrulanmadı; release APK/AAB sonraki kapıdır.
- `supabase_flutter` ve `go_router` dependency'leri eklendi ancak kullanılmayan Supabase servis katmanı henüz yazılmadı.

## 9. Onay gerektiren konular

Yok. Backend, migration, production veri ve deploy değişikliği yapılmadı.
