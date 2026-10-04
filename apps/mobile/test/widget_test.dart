import 'package:flutter_test/flutter_test.dart';
import 'dart:convert';
import 'package:lovask_mobile/main.dart';
import 'package:lovask_mobile/models.dart';
import 'package:lovask_mobile/api.dart';
import 'package:lovask_mobile/screens/onboarding_screen.dart';
import 'package:lovask_mobile/screens/preferences_screen.dart';
import 'package:lovask_mobile/screens/discovery_screen.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lovask_mobile/screens/voice_message.dart';
import 'package:lovask_mobile/screens/safety_sheet.dart';
import 'package:lovask_mobile/screens/noir_screen.dart';
import 'package:lovask_mobile/theme.dart';

void main() {
  test(
    'presence requires server activity, never a profile id or message time',
    () {
      for (final id in ['', 'alice', 'bob']) {
        expect(UserPresence.resolve(id: id).isOnline, false);
        expect(UserPresence.resolve(id: id).label, 'Aktiflik bilgisi yok');
      }
      final conversation = ConversationSummary.fromJson({
        'profile': {'id': 'p'},
        'lastMessageAt': DateTime.now().toUtc().toIso8601String(),
      });
      expect(conversation.presence.isOnline, false);
      expect(UserPresence.resolve(id: 'p', isOnline: true).isOnline, true);
      expect(
        UserPresence.resolve(id: 'p', lastSeenAt: 'invalid').isOnline,
        false,
      );
    },
  );
  testWidgets('safety requires confirmation and cancellation keeps the form', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showSafetySheet(context, 'test-profile'),
              child: const Text('Güvenlik aç'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Güvenlik aç'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Şikâyeti gönder'));
    await tester.tap(find.text('Şikâyeti gönder'));
    await tester.pumpAndSettle();
    expect(find.text('Şikâyeti gönder?'), findsOneWidget);
    await tester.tap(find.text('Vazgeç'));
    await tester.pumpAndSettle();
    expect(find.text('Şikâyeti gönder?'), findsNothing);
    expect(find.text('Şikâyeti gönder'), findsOneWidget);
  });
  test('message updates replace duplicate ids and preserve loaded history', () {
    final old = ChatMessage.fromJson({
      'id': 'old',
      'createdAt': '2026-01-01',
      'text': 'old',
    });
    final sent = ChatMessage.fromJson({
      'id': 'new',
      'createdAt': '2026-01-02',
      'from': 'me',
      'text': 'hello',
    });
    final read = ChatMessage.fromJson({
      'id': 'new',
      'createdAt': '2026-01-02',
      'from': 'me',
      'readAt': '2026-01-03',
      'audio': true,
      'audioUrl': 'https://example.com/voice',
      'durationMs': 2200,
    });
    final merged = mergeChatMessages([old, sent], [read]);
    expect(merged.map((m) => m.id), ['old', 'new']);
    expect(merged.last.readAt, '2026-01-03');
    expect(merged.last.mediaType, 'audio');
    expect(merged.last.durationMs, 2200);
    expect(merged.last.isMine, true);
  });
  test('waveform stays within the audio endpoint contract', () {
    for (final samples in <List<int>>[
      [],
      [-99],
      [0, 100, 200],
      List.generate(400, (i) => i),
    ]) {
      final wave = voiceWaveform(samples);
      expect(wave, hasLength(24));
      expect(wave.every((v) => v >= 0 && v <= 100), true);
    }
  });
  testWidgets('Shopier stays available with the older Noir API response', (
    tester,
  ) async {
    final api = LovaskApi(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'plans': [
              {
                'slug': 'noir-weekly',
                'name': 'Haftalık Noir',
                'duration_days': 7,
                'price_amount': 199,
                'currency': 'TRY',
              },
            ],
            'shopierEnabled': true,
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(theme: buildLovaskTheme(), home: NoirScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Kredi / Banka Kartı ile Öde (Shopier)'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Kredi / Banka Kartı ile Öde (Shopier)'), findsOneWidget);
  });
  test('manual payment destinations use the selected provider only', () {
    final crypto = PaymentMethodSetting.fromJson({
      'method': 'crypto',
      'enabled': true,
      'wallet_address': 'wallet',
      'crypto_network': 'TRC20',
      'iban': 'not-this',
    });
    final papara = PaymentMethodSetting.fromJson({
      'method': 'papara',
      'papara_number': '1234',
    });
    expect(crypto.destination, 'wallet');
    expect(crypto.cryptoNetwork, 'TRC20');
    expect(papara.destination, '1234');
    expect(
      PaymentMethodSetting.fromJson({'method': 'bank_transfer'}).destination,
      isNull,
    );
  });
  test('request metadata and web message timestamp survive parsing', () {
    final item = ConversationSummary.fromJson({
      'matchId': 'm',
      'profile': {'id': 'p'},
      'request': {'incoming': true, 'status': 'pending'},
      'lastMessageAt': '2026-01-01',
      'pending': true,
    });
    expect(item.request?['incoming'], true);
    expect(item.updatedAt, '2026-01-01');
    expect(item.pending, true);
  });
  test(
    'support, request decisions and cursor use the web API contract',
    () async {
      final requests = <http.Request>[];
      final api = LovaskApi(
        client: MockClient((request) async {
          requests.add(request);
          return http.Response('{}', 200);
        }),
      );
      await api.support({
        'category': 'payment',
        'subject': 'Ödeme',
        'message': 'Destek gerekli',
      });
      await api.replySupport('ticket', 'Yanıt');
      await api.respondRequest('match', 'accept');
      await api.messages(
        'profile',
        before: '2026-01-01T00:00:00+03:00',
        beforeId: 'message',
      );
      expect(jsonDecode(requests[0].body)['category'], 'payment');
      expect(requests[1].method, 'PATCH');
      expect(jsonDecode(requests[1].body)['ticketId'], 'ticket');
      expect(jsonDecode(requests[2].body), {
        'matchId': 'match',
        'action': 'accept',
      });
      expect(
        requests[3].url.queryParameters['before'],
        '2026-01-01T00:00:00+03:00',
      );
      expect(requests[3].url.queryParameters['beforeId'], 'message');
    },
  );
  testWidgets(
    'failed preference load cannot overwrite saved filters with defaults',
    (tester) async {
      await tester.pumpWidget(const MaterialApp(home: PreferencesScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Tekrar dene'), findsOneWidget);
      expect(find.text('Filtreleri uygula'), findsNothing);
    },
  );
  test('reset filters preserves every field required by the web contract', () {
    final draft = defaultDiscoveryPreferences();
    expect(
      draft.keys,
      unorderedEquals([
        'minAge',
        'maxAge',
        'verifiedOnly',
        'interestedGenders',
        'sameCityOnly',
        'cities',
        'relationshipGoals',
        'maxDistanceKm',
        'maritalStatuses',
        'hasChildrenValues',
        'childrenPreferences',
        'alcoholValues',
        'smokingValues',
        'petValues',
        'sportsValues',
        'zodiacValues',
        'minHeightCm',
        'maxHeightCm',
        'educationValues',
        'languageValues',
      ]),
    );
    expect(draft['interestedGenders'], hasLength(4));
    (draft['cities'] as List).add('İstanbul');
    expect(defaultDiscoveryPreferences()['cities'], isEmpty);
  });
  testWidgets('swipe leaves a rejected card at its original position', (
    tester,
  ) async {
    var decisions = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: InteractiveSwipeCard(
            profile: const DiscoveryProfile(
              id: 'test',
              name: 'Deniz',
              age: 25,
              city: 'İstanbul',
              image: '',
            ),
            onSwipeLeft: () {},
            onSwipeRight: () => decisions++,
            onSwipeUp: () {},
            onShowDetails: () {},
          ),
        ),
      ),
    );
    final card = find.byType(InteractiveSwipeCard);
    await tester.drag(card, const Offset(180, 0));
    await tester.pumpAndSettle();
    expect(decisions, 1);
    final translation = tester
        .widgetList<Transform>(
          find.descendant(of: card, matching: find.byType(Transform)),
        )
        .first;
    expect(translation.transform.getTranslation().x, 0);
  });
  test(
    'SSR cookie chunks round-trip the native session including Turkish text',
    () {
      for (final size in [5, 7000]) {
        final session = {
          'access_token': 'test-token',
          'user': {'name': 'Şule', 'data': 'x' * size},
        };
        final cookie = webSessionCookie('https://project.supabase.co', session);
        final parts = cookie.split('; ');
        final value = parts.map((p) => p.substring(p.indexOf('=') + 1)).join();
        expect(
          jsonDecode(
            utf8.decode(
              base64Url.decode(base64Url.normalize(value.substring(7))),
            ),
          ),
          session,
        );
        expect(
          parts.first.startsWith(
            size == 5 ? 'sb-project-auth-token=' : 'sb-project-auth-token.0=',
          ),
          isTrue,
        );
        for (final part in parts) {
          expect(
            part.substring(part.indexOf('=') + 1).length,
            lessThanOrEqualTo(3180),
          );
        }
      }
    },
  );
  test('upload types match server allowlist', () {
    expect(uploadMediaType('portrait.JPG').toString(), 'image/jpeg');
    expect(uploadMediaType('receipt.pdf').toString(), 'application/pdf');
    expect(
      () => uploadMediaType('photo.exe'),
      throwsA(isA<LovaskApiException>()),
    );
  });
  test(
    'onboarding requires an adult birthday but family choices are optional',
    () {
      final form = <String, dynamic>{
        'name': 'Deniz',
        'birthDate': '2008-09-24',
        'gender': 'kadın',
        'city': 'İstanbul',
      };
      expect(validateOnboarding(form, 0, 2, DateTime(2026, 9, 23)), isNotNull);
      expect(validateOnboarding(form, 0, 2, DateTime(2026, 9, 24)), isNull);
      form.addAll({
        'badgeSlugs': ['coffee'],
      });
      expect(validateOnboarding(form, 3, 2, DateTime(2026)), isNull);
    },
  );
  test('onboarding photo step accepts one photo', () {
    expect(validateOnboarding({}, 2, 0, DateTime(2026)), isNotNull);
    expect(validateOnboarding({}, 2, 1, DateTime(2026)), isNull);
  });
  testWidgets('missing configuration cannot open authenticated screens', (
    tester,
  ) async {
    await tester.pumpWidget(const LovaskApp());
    expect(find.text('Uygulama bağlantı ayarları eksik.'), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
  });

  test('chat payload keeps API body and sender direction', () {
    final message = ChatMessage.fromJson({
      'id': 'm1',
      'from': 'me',
      'sender_id': 'profile-1',
      'body': 'Merhaba',
      'created_at': '2026-01-01T00:00:00Z',
    });
    expect(message.text, 'Merhaba');
    expect(message.isMine, isTrue);
  });
}
