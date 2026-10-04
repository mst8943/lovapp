import 'dart:convert';
import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lovask_mobile/api.dart';
import 'package:lovask_mobile/main.dart';
import 'package:lovask_mobile/theme.dart';
import 'package:lovask_mobile/screens/auth_screen.dart';
import 'package:lovask_mobile/screens/chat_screen.dart';
import 'package:lovask_mobile/screens/noir_screen.dart';
import 'package:lovask_mobile/screens/profile_hub_screen.dart';
import 'package:lovask_mobile/screens/discovery_screen.dart';
import 'package:lovask_mobile/screens/explore_screen.dart';
import 'package:lovask_mobile/screens/likes_visitors_screen.dart';
import 'package:lovask_mobile/screens/preferences_screen.dart';
import 'package:lovask_mobile/screens/application_screen.dart';
import 'package:lovask_mobile/screens/onboarding_screen.dart';
import 'package:lovask_mobile/screens/member_tools_screen.dart';
import 'package:lovask_mobile/screens/profile_detail_screen.dart';
import 'package:lovask_mobile/screens/recovery_screen.dart';
import 'package:lovask_mobile/widgets/match_sheet.dart';
import 'package:lovask_mobile/models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late HttpServer photoServer;
  late String photoUrl;
  setUpAll(() async {
    HttpOverrides.global = null;
    final bytes = await File('../../public/profiles/lara.webp').readAsBytes();
    photoServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    photoUrl = 'http://127.0.0.1:${photoServer.port}/portrait.webp';
    photoServer.listen((request) {
      request.response.headers.contentType = ContentType('image', 'webp');
      request.response.add(bytes);
      request.response.close();
    });
    await (FontLoader(
      'Manrope',
    )..addFont(rootBundle.load('assets/fonts/Manrope.ttf'))).load();
    await (FontLoader(
      'CormorantGaramond',
    )..addFont(rootBundle.load('assets/fonts/CormorantGaramond.ttf'))).load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  tearDownAll(() => photoServer.close(force: true));
  testWidgets('loading screens remain renderable before delayed responses', (
    tester,
  ) async {
    final pending = Completer<http.Response>();
    final api = LovaskApi(client: MockClient((_) => pending.future));
    for (final screen in <Widget>[
      DiscoveryScreen(api: api),
      ExploreScreen(api: api),
      LikesVisitorsScreen(api: api),
      ConversationsScreen(api: api),
      ChatScreen(api: api, profileId: 'p', name: 'Deniz'),
      ProfileHubScreen(api: api),
      PreferencesScreen(api: api),
      NoirScreen(api: api),
      MemberToolsScreen(section: 'support', api: api),
    ]) {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildLovaskTheme(),
          home: Material(child: screen),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    }
    pending.complete(http.Response('{}', 200));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
  testWidgets('all onboarding steps fit a small screen with large text', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 568);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(1.4)),
          child: child!,
        ),
        home: OnboardingScreen(
          onCompleted: () {},
          initialProfile: {
            'name': 'Deniz',
            'birthDate': '1997-03-20',
            'gender': 'kadın',
            'city': 'İstanbul',
            'interestedGenders': ['erkek'],
            'relationshipGoal': 'serious',
            'maritalStatus': 'never_married',
            'hasChildren': false,
            'childrenPreference': 'open',
            'badgeSlugs': ['coffee'],
            'answer': 'Uzun bir yürüyüş.',
            'photos': [
              {'id': '1', 'url': photoUrl, 'status': 'approved'},
              {'id': '2', 'url': photoUrl, 'status': 'approved'},
            ],
          },
        ),
      ),
    );
    await tester.runAsync(
      () => precacheImage(
        NetworkImage(photoUrl),
        tester.element(find.byType(OnboardingScreen)),
      ),
    );
    for (var step = 0; step < 6; step++) {
      await tester.pumpAndSettle();
      expect(find.text('${step + 1}/6'), findsOneWidget);
      expect(tester.takeException(), isNull, reason: 'onboarding step $step');
      final scroll = find
          .descendant(
            of: find.byType(ListView),
            matching: find.byType(Scrollable),
          )
          .first;
      await tester.drag(scroll, const Offset(0, -500));
      await tester.pumpAndSettle();
      expect(
        tester.takeException(),
        isNull,
        reason: 'onboarding step $step bottom',
      );
      if (step < 5) await tester.tap(find.text('Devam et'));
    }
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('5/6'), findsOneWidget);
    await tester.tap(find.byTooltip('Önceki adıma dön'));
    await tester.pumpAndSettle();
    expect(find.text('4/6'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('3/6'), findsOneWidget);
    await tester.tap(find.text('Devam et'));
    await tester.pumpAndSettle();
    expect(find.text('4/6'), findsOneWidget);
  });
  const profile = DiscoveryProfile(
    id: 'p',
    name: 'Deniz Uzun Profil Adı',
    age: 29,
    city: 'İstanbul',
    image: '',
    prompt: 'Birlikte mutlaka denemeliyiz…',
    answer: 'Uzun bir yürüyüş ve güzel bir sohbet.',
    badges: ['Kahve sever', 'Seyahat tutkunu'],
    verified: true,
  );
  late final profileJson = {
    'id': profile.id,
    'name': profile.name,
    'age': profile.age,
    'city': profile.city,
    'image': photoUrl,
    'prompt': profile.prompt,
    'answer': profile.answer,
    'badges': profile.badges,
    'verified': true,
  };
  LovaskApi fixtureApi({
    bool populated = false,
    bool fail = false,
    bool request = false,
  }) => LovaskApi(
    client: MockClient((httpRequest) async {
      if (fail) {
        return http.Response(
          jsonEncode({'error': 'Bağlantı kurulamadı. Lütfen yeniden dene.'}),
          503,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      final payload = switch (httpRequest.url.path) {
        '/api/auth/register' => {'enabled': true, 'googleEnabled': true},
        '/api/profile/onboarding' => {
          'profile': {
            'name': 'Deniz',
            'birthDate': '1997-03-20',
            'city': 'İstanbul',
            'photos': populated
                ? [
                    {'id': 'photo', 'url': photoUrl},
                  ]
                : [],
            'badgeSlugs': ['coffee', 'travel'],
            'prompt': 'En gizli yeteneğim…',
            'answer': 'Güzel bir sohbet başlatmak.',
          },
        },
        '/api/profile/account' => {
          'profile': {'xp': 200, 'level': 2, 'is_discoverable': true},
        },
        '/api/discovery/likes' => {
          'count': 3,
          'profiles': populated ? [profileJson] : [],
          'premium': populated,
        },
        '/api/profile/visitors' => {
          'count': 2,
          'visitors': populated
              ? [
                  {...profileJson, 'visitedAt': '2026-09-23T10:00:00Z'},
                ]
              : [],
          'premium': populated,
        },
        '/api/conversations' => {
          'conversations': [
            {
              'matchId': 'm',
              'matched': true,
              'profile': {
                'id': 'p',
                'name': 'Deniz',
                'image': populated ? photoUrl : '',
              },
              'lastMessage': 'Merhaba, nasılsın?',
              'unreadCount': 2,
            },
          ],
        },
        '/api/discovery' => {
          'profiles': populated ? [profileJson] : [],
        },
        '/api/discovery/preferences' => {
          'preferences': {
            'minAge': 18,
            'maxAge': 80,
            'interestedGenders': ['kadın'],
          },
          'premium': false,
        },
        '/api/profile/support' => {'tickets': []},
        '/api/safety' => {'blocked': []},
        '/api/push/preferences' => {
          'preferences': {
            'quiet_hours_enabled': false,
            'quiet_start': '22:00',
            'quiet_end': '08:00',
            'timezone': 'Europe/Istanbul',
          },
        },
        '/api/profile/referrals' => {
          'code': 'TEST',
          'activations': 0,
          'earnedDays': 0,
          'shareUrl': 'https://example.invalid',
        },
        '/api/chat' => {
          if (request) 'request': {'incoming': true, 'status': 'pending'},
          'currentProfileId': 'me',
          'messages': [
            {
              'id': '1',
              'from': 'me',
              'text': 'Merhaba!',
              'createdAt': '2026-09-23T10:00:00Z',
              'readAt': '2026-09-23T10:01:00Z',
            },
            {
              'id': '2',
              'from': 'them',
              'text': 'Merhaba, nasılsın?',
              'createdAt': '2026-09-23T10:01:00Z',
            },
          ],
          'hasMore': true,
          'nextCursor': {'id': '1', 'createdAt': '2026-09-23T10:00:00Z'},
        },
        '/api/noir' => {
          'plans': [
            {
              'slug': 'noir-weekly',
              'name': 'Haftalık Noir',
              'duration_days': 7,
              'price_amount': 199,
              'currency': 'TRY',
            },
          ],
          'orders': populated
              ? [
                  for (final status in [
                    'awaiting_payment',
                    'under_review',
                    'paid',
                    'completed',
                    'rejected',
                  ])
                    {
                      'id': status,
                      'status': status,
                      'payment_reference': 'LVK-TEST',
                      'amount': 199,
                      'currency': 'TRY',
                      'provider': 'bank_transfer',
                      if (status == 'rejected')
                        'rejection_reason': 'Test: referans eşleşmedi.',
                    },
                ]
              : [],
          'shopierEnabled': true,
          'shopierPlans': ['noir-weekly'],
          'paymentMethods': [
            {'method': 'bank_transfer', 'enabled': true, 'iban': 'TEST-IBAN'},
          ],
        },
        _ => <String, dynamic>{},
      };
      return http.Response(
        jsonEncode(payload),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }),
  );
  testWidgets('navigation and settings work with safe areas and large text', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 568);
    tester.view.padding = const FakeViewPadding(top: 24, bottom: 24);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPadding);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLovaskTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(1.6),
            disableAnimations: true,
          ),
          child: child!,
        ),
        home: HomeScreen(api: fixtureApi()),
      ),
    );
    await tester.pumpAndSettle();
    for (final tab in ['Beğeniler', 'Mesajlar', 'Profil', 'Keşfet']) {
      await tester.tap(find.text(tab).last);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: tab);
    }
    await tester.tap(find.text('Profil').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Ayarlar'));
    await tester.pumpAndSettle();
    expect(find.text('Ayarlar'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byType(Switch).first,
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(find.byType(Switch).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();
    expect(tester.widget<Switch>(find.byType(Switch).first).value, isFalse);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final scenario in [
    (320.0, 844.0, 1.0),
    (390.0, 844.0, 1.0),
    (480.0, 844.0, 1.0),
    (320.0, 568.0, 1.0),
    (320.0, 568.0, 1.6),
    (390.0, 844.0, 1.6),
    (320.0, 568.0, 1.2),
  ]) {
    final (width, height, textScale) = scenario;
    testWidgets('mobile screens fit ${width}x$height text $textScale', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, height);
      final keyboard = height == 568 && textScale == 1.2;
      if (keyboard) tester.view.viewInsets = const FakeViewPadding(bottom: 220);
      addTearDown(tester.view.resetViewInsets);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = fixtureApi();
      final loadedApi = fixtureApi(populated: true);
      final failedApi = fixtureApi(fail: true);
      final screens = <String, Widget>{
        'login': AuthScreen(api: api),
        'profile': ProfileHubScreen(api: loadedApi),
        'settings': ProfileHubScreen(api: api, settingsOnly: true),
        'home': HomeScreen(api: loadedApi),
        'noir': NoirScreen(api: api),
        'inbox': ConversationsScreen(api: loadedApi),
        'chat': ChatScreen(api: api, profileId: 'p', name: 'Deniz'),
        'chat-request': ChatScreen(
          api: fixtureApi(request: true),
          profileId: 'p',
          name: 'Deniz',
        ),
        'discovery': DiscoveryScreen(api: api),
        'explore': ExploreScreen(api: api),
        'likes': LikesVisitorsScreen(api: api),
        'preferences': PreferencesScreen(api: api),
        'application': const ApplicationScreen(),
        'onboarding': OnboardingScreen(onCompleted: () {}),
        'support': MemberToolsScreen(section: 'support', api: api),
        'blocked': MemberToolsScreen(section: 'blocked', api: api),
        'notifications': MemberToolsScreen(section: 'notifications', api: api),
        'referrals': MemberToolsScreen(section: 'referrals', api: api),
        'discovery-loaded': Material(child: DiscoveryScreen(api: loadedApi)),
        'explore-loaded': ExploreScreen(api: loadedApi),
        'likes-premium': LikesVisitorsScreen(api: loadedApi),
        'visitors-premium': LikesVisitorsScreen(api: loadedApi, initialTab: 1),
        'profile-detail': ProfileDetailScreen(
          profile: DiscoveryProfile.fromJson({
            ...profileJson,
            'name': 'Deniz',
            'relationshipGoal': 'serious',
            'educationLevel': 'bachelor',
            'heightCm': 172,
            'photos': [photoUrl, photoUrl],
          }),
          api: loadedApi,
        ),
        'photo-card': Material(
          child: InteractiveSwipeCard(
            profile: DiscoveryProfile(
              id: 'fixture',
              name: 'Görsel test profili',
              age: 29,
              city: 'İstanbul',
              image: photoUrl,
              photos: [photoUrl, photoUrl],
              badges: profile.badges,
              prompt: profile.prompt,
              answer: profile.answer,
              verified: true,
            ),
            onSwipeLeft: () {},
            onSwipeRight: () {},
            onSwipeUp: () {},
            onShowDetails: () {},
          ),
        ),
        'match': Material(
          child: LovaskMatchSheet(
            profile: profile,
            api: loadedApi,
            onContinue: () {},
            onMessage: () {},
          ),
        ),
        'recovery': RecoveryScreen(onDone: () {}),
        'recovery-deletion': RecoveryScreen(
          onDone: () {},
          scheduledFor: '2026-10-23',
        ),
        'noir-orders': NoirScreen(api: loadedApi),
        'discovery-error': Material(child: DiscoveryScreen(api: failedApi)),
        'explore-error': ExploreScreen(api: failedApi),
        'likes-error': LikesVisitorsScreen(api: failedApi),
        'chat-error': ChatScreen(api: failedApi, profileId: 'p', name: 'Deniz'),
        'noir-error': NoirScreen(api: failedApi),
        'preferences-error': PreferencesScreen(api: failedApi),
        'support-error': MemberToolsScreen(section: 'support', api: failedApi),
      };
      for (final screen in screens.entries) {
        if (keyboard &&
            ![
              'login',
              'chat',
              'preferences',
              'application',
              'onboarding',
              'support',
              'recovery',
            ].contains(screen.key)) {
          continue;
        }
        await tester.pumpWidget(
          MaterialApp(
            theme: buildLovaskTheme(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(textScale)),
              child: ColoredBox(color: ink, child: child!),
            ),
            home: RepaintBoundary(
              key: ValueKey(screen.key),
              child: screen.key == 'discovery'
                  ? Material(child: screen.value)
                  : screen.value,
            ),
          ),
        );
        await tester.runAsync(() async {
          final screenContext = tester.element(
            find.byKey(ValueKey(screen.key)),
          );
          await precacheImage(NetworkImage(photoUrl), screenContext);
          await precacheImage(
            ResizeImage(
              NetworkImage(photoUrl),
              width:
                  (MediaQuery.sizeOf(screenContext).width *
                          MediaQuery.devicePixelRatioOf(screenContext))
                      .round(),
            ),
            screenContext,
          );
          await precacheImage(
            const AssetImage('assets/logo.png'),
            screenContext,
          );
          for (final asset in [
            'lovask-discovery-logo.png',
            'noir-preview-1.webp',
            'noir-preview-2.webp',
            'noir-preview-3.webp',
          ]) {
            await precacheImage(AssetImage('assets/$asset'), screenContext);
          }
        });
        await tester.pumpAndSettle();
        expect(
          tester.takeException(),
          isNull,
          reason: '${screen.key} overflow or runtime failure',
        );
        if (width == 390 && textScale == 1) {
          await expectLater(
            find.byKey(ValueKey(screen.key)),
            matchesGoldenFile('goldens/${screen.key}.png'),
          );
          expect(
            tester.takeException(),
            isNull,
            reason: '${screen.key} golden mismatch',
          );
        }
        if (width == 390 &&
            textScale == 1.6 &&
            [
              'photo-card',
              'chat-request',
              'profile',
              'explore-loaded',
            ].contains(screen.key)) {
          await expectLater(
            find.byKey(ValueKey(screen.key)),
            matchesGoldenFile('goldens/${screen.key}-large-text.png'),
          );
          expect(tester.takeException(), isNull);
        }
        if (width == 320 &&
            height == 568 &&
            textScale == 1.6 &&
            screen.key == 'home') {
          await expectLater(
            find.byKey(ValueKey(screen.key)),
            matchesGoldenFile('goldens/home-compact-large-text.png'),
          );
        }
        // Inspect content below the first viewport, not just the opening frame.
        final scrolls = find.byWidgetPredicate(
          (widget) =>
              widget is Scrollable &&
              widget.axisDirection == AxisDirection.down &&
              widget.restorationId != 'editable',
        );
        for (
          var attempt = 0;
          attempt < 4 && scrolls.evaluate().isNotEmpty;
          attempt++
        ) {
          await tester.drag(scrolls.first, const Offset(0, -550));
          await tester.pumpAndSettle();
          expect(
            tester.takeException(),
            isNull,
            reason: '${screen.key} scrolled content at $width / $textScale',
          );
        }
        if (width == 390 &&
            textScale == 1 &&
            [
              'noir-orders',
              'profile',
              'settings',
              'preferences',
              'support',
            ].contains(screen.key)) {
          await expectLater(
            find.byKey(ValueKey(screen.key)),
            matchesGoldenFile('goldens/${screen.key}-bottom.png'),
          );
          expect(tester.takeException(), isNull);
        }
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
      }
    });
  }
}
