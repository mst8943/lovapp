import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:lovask_mobile/api.dart';

// Opt-in, read-only production check. Credentials are supplied at runtime,
// never bundled with the app or persisted by this test.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final email = Platform.environment['LOVASK_TEST_EMAIL'];
  final password = Platform.environment['LOVASK_TEST_PASSWORD'];
  test(
    'native login, authenticated reads, refresh and logout',
    () async {
      HttpOverrides.global = null;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/shared_preferences'),
            (call) async => call.method == 'getAll' ? <String, Object>{} : true,
          );
      await Supabase.initialize(
        url: const String.fromEnvironment('SUPABASE_URL'),
        publishableKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
        debug: false,
        authOptions: const FlutterAuthClientOptions(
          localStorage: EmptyLocalStorage(),
          autoRefreshToken: false,
          detectSessionInUri: false,
        ),
      );
      addTearDown(() => Supabase.instance.dispose());
      final api = LovaskApi();
      await api.login(email!, password!);
      expect(Supabase.instance.client.auth.currentSession, isNotNull);
      expect((await api.profile())['profile'], isA<Map>());
      expect(await api.discovery(), isA<List>());
      expect((await api.conversations())['conversations'], isA<List>());
      expect((await api.preferences())['preferences'], isA<Map>());
      expect((await api.noir())['catalogOnly'], isNot(true));
      expect((await api.likes())['profiles'], isA<List>());
      expect((await api.visitors())['visitors'], isA<List>());
      expect((await api.blockedProfiles())['blocked'], isA<List>());
      final account = await api.accountState();
      expect(
        account['profile'] is Map ||
            account['recoveryStatusUnavailable'] == true,
        true,
      );
      expect((await api.supportTickets())['tickets'], isA<List>());
      expect((await api.pushPreferences())['preferences'], isA<Map>());
      await Supabase.instance.client.auth.refreshSession();
      expect((await api.profile())['profile'], isA<Map>());
      await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
      expect(Supabase.instance.client.auth.currentSession, isNull);
      await expectLater(
        api.profile(),
        throwsA(
          isA<LovaskApiException>().having(
            (error) => error.statusCode,
            'unauthenticated status',
            401,
          ),
        ),
      );
    },
    skip: email == null || password == null,
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
