import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lovask_mobile/api.dart';
import 'package:lovask_mobile/models.dart';
import 'package:lovask_mobile/theme.dart';
import 'package:lovask_mobile/screens/chat_screen.dart';
import 'package:lovask_mobile/screens/preferences_screen.dart';
import 'package:lovask_mobile/screens/profile_detail_screen.dart';
import 'package:lovask_mobile/screens/discovery_screen.dart';
import 'package:lovask_mobile/widgets/story_strip.dart';
import 'package:lovask_mobile/screens/meeting_screen.dart';

void main() {
  testWidgets('meeting selection persists and can be removed', (tester) async {
    String? selected;
    final api = LovaskApi(
      client: MockClient((request) async {
        if (request.method == 'POST') {
          selected = (jsonDecode(request.body) as Map)['optionId'] as String;
        }
        if (request.method == 'DELETE') selected = null;
        return http.Response(
          jsonEncode({
            'options': [
              {'id': 'coffee', 'label': 'Bugün kahve', 'icon': 'coffee'},
            ],
            'selected': selected == null ? null : {'option_id': selected},
            'profiles': [],
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Scaffold(body: MeetingScreen(api: api)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bugün kahve'));
    await tester.pumpAndSettle();
    expect(selected, 'coffee');
    expect(find.text('Aynı planı seçenler'), findsOneWidget);
    await tester.tap(find.text('Planımı kaldır'));
    await tester.pumpAndSettle();
    expect(selected, isNull);
    expect(find.text('Aynı planı seçenler'), findsNothing);
  });
  testWidgets('story action explains lifetime and visibility', (tester) async {
    final api = LovaskApi(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({'conversations': []}),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Scaffold(body: StoryStrip(api: api)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hikayen +'));
    await tester.pumpAndSettle();
    expect(find.text('Hikayene fotoğraf ekle'), findsOneWidget);
    expect(find.textContaining('24 saat'), findsOneWidget);
    expect(find.textContaining('eşleşmelerin'), findsOneWidget);
  });

  testWidgets('active story opens from discovery strip and can be deleted', (
    tester,
  ) async {
    var deleted = false;
    final api = LovaskApi(
      client: MockClient((request) async {
        final body = request.url.path == '/api/stories'
            ? request.method == 'DELETE'
                  ? () {
                      deleted = true;
                      return {'removed': 'story-id'};
                    }()
                  : {
                      'stories': [
                        {
                          'id': 'story-id',
                          'profileId': 'me',
                          'name': 'Ben',
                          'url': 'https://example.invalid/story.webp',
                          'own': true,
                        },
                      ],
                    }
            : {'conversations': []};
        return http.Response(
          jsonEncode(body),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Scaffold(body: StoryStrip(api: api)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hikayem'));
    await tester.pumpAndSettle();
    expect(find.text('Ben'), findsOneWidget);
    await tester.tap(find.byTooltip('Hikayeyi sil'));
    await tester.pumpAndSettle();
    expect(deleted, isTrue);
  });

  testWidgets('expired discovery photo refreshes its signed URL', (
    tester,
  ) async {
    var loads = 0;
    final api = LovaskApi(
      client: MockClient((request) async {
        if (request.url.path == '/api/discovery' && request.url.query.isEmpty) loads++;
        return http.Response(
          jsonEncode({
            'profiles': [
              {
                'id': 'p',
                'name': 'Deniz',
                'age': 25,
                'city': 'İstanbul',
                'image': 'https://example.invalid/photo?token=$loads',
              },
            ],
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Scaffold(body: DiscoveryScreen(api: api)),
      ),
    );
    await tester.pumpAndSettle();
    tester
        .widget<InteractiveSwipeCard>(find.byType(InteractiveSwipeCard))
        .onPhotoError!();
    await tester.pumpAndSettle();
    expect(loads, 2);
    expect(
      tester
          .widget<InteractiveSwipeCard>(find.byType(InteractiveSwipeCard))
          .profile
          .image,
      contains('token=2'),
    );
  });

  for (final action in [
    ('Beğen', 'right'),
    ('Geç', 'left'),
    ('Süper beğeni · 1 hakkın kaldı', 'super'),
  ]) {
    for (final successful in [true, false]) {
      testWidgets(
        'swipe departure and response rollback: ${action.$2} $successful',
        (tester) async {
          final response = Completer<http.Response>();
          var decisions = 0;
          final api = LovaskApi(
            client: MockClient((request) async {
              if (request.method == 'POST') {
                decisions++;
                expect(jsonDecode(request.body)['direction'], action.$2);
                return response.future;
              }
              return http.Response(
                jsonEncode({
                  'superLike': {'remaining': 1, 'premium': false},
                  'profiles': [
                    {
                      'id': 'p',
                      'name': 'Deniz',
                      'age': 25,
                      'image': '',
                      'city': '',
                    },
                    {
                      'id': 'q',
                      'name': 'Ekin',
                      'age': 26,
                      'image': '',
                      'city': '',
                    },
                  ],
                }),
                200,
              );
            }),
          );
          await tester.pumpWidget(
            MaterialApp(
              theme: buildLovaskTheme(),
              home: Scaffold(body: DiscoveryScreen(api: api)),
            ),
          );
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip(action.$1));
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 120));
          final card = find.byType(InteractiveSwipeCard);
          final translation = tester
              .widgetList<Transform>(
                find.descendant(of: card, matching: find.byType(Transform)),
              )
              .first
              .transform
              .getTranslation();
          expect(
            action.$2 == 'super' ? translation.y : translation.x,
            action.$2 == 'right' ? greaterThan(0) : lessThan(0),
          );
          expect(find.text('Kaydediliyor…'), findsNothing);
          await tester.pump(const Duration(milliseconds: 260));
          expect(tester.widget<InteractiveSwipeCard>(card).profile.id, 'q');
          await tester.tap(find.byTooltip(action.$1));
          expect(decisions, 1);
          response.complete(
            http.Response(
              successful ? '{"matched":false}' : '{"error":"Offline"}',
              successful ? 200 : 503,
            ),
          );
          await tester.pumpAndSettle();
          expect(
            tester.widget<InteractiveSwipeCard>(card).profile.id,
            successful ? 'q' : 'p',
          );
          expect(
            tester
                .widgetList<Transform>(
                  find.descendant(of: card, matching: find.byType(Transform)),
                )
                .first
                .transform
                .getTranslation()
                .x,
            closeTo(0, .01),
          );
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
  testWidgets('photo tap crosses the vignette without causing a swipe', (
    tester,
  ) async {
    var swipes = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Scaffold(
          body: InteractiveSwipeCard(
            profile: const DiscoveryProfile(
              id: 'p',
              name: 'Deniz',
              age: 25,
              city: '',
              image: '',
              photos: [
                'https://example.invalid/1.png',
                'https://example.invalid/2.png',
              ],
            ),
            onSwipeLeft: () => swipes++,
            onSwipeRight: () => swipes++,
            onSwipeUp: () => swipes++,
            onShowDetails: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final bounds = tester.getRect(find.byType(InteractiveSwipeCard));
    await tester.tapAt(
      Offset(bounds.left + bounds.width * .8, bounds.top + bounds.height * .25),
    );
    await tester.pumpAndSettle();
    expect(
      ((tester.widget<Image>(find.byType(Image).first).image as ResizeImage)
                  .imageProvider
              as NetworkImage)
          .url,
      'https://example.invalid/2.png',
    );
    expect(swipes, 0);
  });
  testWidgets(
    'profile preview never records a visit or offers self messaging',
    (tester) async {
      var calls = 0;
      final api = LovaskApi(
        client: MockClient((_) async {
          calls++;
          return http.Response('{}', 200);
        }),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: buildLovaskTheme(),
          home: ProfileDetailScreen(
            api: api,
            preview: true,
            profile: const DiscoveryProfile(
              id: 'self',
              name: 'Deniz',
              age: 25,
              city: 'İstanbul',
              image: '',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(calls, 0);
      expect(find.text('Mesaj gönder'), findsNothing);
      expect(find.byTooltip('Şikâyet et veya engelle'), findsNothing);
    },
  );

  testWidgets('failed message retains draft and retries the same client id', (
    tester,
  ) async {
    final attempts = <Map<String, dynamic>>[];
    final api = LovaskApi(
      client: MockClient((request) async {
        if (request.method == 'POST') {
          attempts.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response(jsonEncode({'error': 'Offline'}), 503);
        }
        return http.Response(
          jsonEncode({'messages': [], 'hasMore': false}),
          200,
        );
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: ChatScreen(api: api, profileId: 'p', name: 'Deniz'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Taslak mesaj');
    await tester.tap(find.byTooltip('Mesaj gönder'));
    await tester.pumpAndSettle();
    expect(find.text('Taslak mesaj'), findsOneWidget);
    expect(find.text('Tekrar gönder'), findsOneWidget);
    await tester.tap(find.text('Tekrar gönder'));
    await tester.pumpAndSettle();
    expect(attempts.length, 2);
    expect(attempts[0]['clientId'], isNotNull);
    expect(attempts[1]['clientId'], attempts[0]['clientId']);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('changed preferences require an explicit discard', (
    tester,
  ) async {
    final api = LovaskApi(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'preferences': {
              'minAge': 30,
              'maxAge': 60,
              'interestedGenders': ['kadın'],
            },
            'premium': false,
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PreferencesScreen(api: api)),
              ),
              child: const Text('Tercihleri aç'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Tercihleri aç'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Filtreleri sıfırla'),
      500,
      scrollable: find
          .descendant(
            of: find.byType(ListView),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.text('Filtreleri sıfırla'));
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Değişikliklerin kaydedilmedi'), findsOneWidget);
    await tester.tap(find.text('Düzenlemeye devam et'));
    await tester.pumpAndSettle();
    expect(find.byType(PreferencesScreen), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kaydetmeden çık'));
    await tester.pumpAndSettle();
    expect(find.text('Tercihleri aç'), findsOneWidget);
  });
}
