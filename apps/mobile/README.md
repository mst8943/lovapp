# Lovask Mobile

Native Flutter client for Lovask. It uses the existing Next.js API routes for
server-side business rules and Supabase Auth/Realtime/Storage for identity,
messages and media. There is no WebView or PWA dependency.

## Run

From `apps/mobile`, use the repository's existing `.env.production.local`:

```powershell
flutter pub get
.\run.ps1
```

The script starts `codex-lovask` automatically when no Android device is
available, then waits up to one minute for ADB to report it as ready. The default target is Android. `-Device edge` and `-Device chrome` can preview
the Flutter layout, but browser login/registration cannot call the production
API from localhost because the server does not allow that cross-origin request.
The script passes only the public Supabase URL and anon key to Flutter.
Plain `flutter run` does not supply these compile-time values and shows
"Uygulama bağlantı ayarları eksik." No service-role key belongs in the app.

The Next.js `.env.production.local` uses `NEXT_PUBLIC_` names, so it cannot
be passed directly as `--dart-define-from-file` to this Flutter project.
