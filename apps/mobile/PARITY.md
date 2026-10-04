# Native Flutter parity

The mobile app is a real Flutter client (no WebView). It uses the same Lovask
HTTP routes, Supabase Auth session, SSR cookie compatibility, Storage uploads,
Realtime chat channel, RLS-protected data, swipe/match rules, Noir catalogue and
Shopier/manual payment flow as the web app.

Implemented surfaces include login, registration/application mode, recovery,
onboarding/profile editing, discovery, likes/visitors, profile hub, preferences,
conversations, requests, pagination/read state, voice messages, safety actions,
support/blocked/referrals/notifications, Noir orders, receipts, deletion recovery
and sign-out.

Checks: `flutter analyze`, widget/unit tests and screen smoke tests pass at
320/390/480px. The opt-in live test is read-only and uses runtime credentials.

Deploy `/api/auth/register` (GET), `/api/auth/mobile-oauth` (POST), and
`/api/profile/account` (GET) with the web release. Add `lovask://auth-callback`
to Supabase redirects and configure Google OAuth before native Google sign-in.
Turnstile remains server-enforced; the app never embeds secrets or bypasses it.

Closed-app push requires FCM/APNs and release signing; web VAPID cannot be reused
by a native APK. Local APKs remain development-key signed until those are supplied.
