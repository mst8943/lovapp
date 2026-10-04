import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lovask_mobile/api.dart';
import 'package:lovask_mobile/widgets/boost_sheet.dart';

class _BoostApi extends LovaskApi {
  int activations = 0;

  @override
  Future<Map<String, dynamic>> boostStatus() async => {
    'canActivate': true,
    'eligible': true,
    'noirUntil': DateTime.now().add(const Duration(days: 1)).toIso8601String(),
  };

  @override
  Future<Map<String, dynamic>> activateBoost() async {
    activations++;
    return {
      'canActivate': false,
      'activeUntil': DateTime.now()
          .add(const Duration(minutes: 30))
          .toIso8601String(),
      'noirUntil': DateTime.now()
          .add(const Duration(days: 1))
          .toIso8601String(),
    };
  }
}

void main() {
  testWidgets('Boost entry opens status and starts an available Boost', (
    tester,
  ) async {
    final api = _BoostApi();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => BoostIconButton(
              onPressed: () =>
                  showBoostSheet(context, api: api, onOpenNoir: () {}),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byType(BoostIconButton));
    await tester.pumpAndSettle();
    expect(find.text('Boost’u başlat'), findsOneWidget);

    await tester.tap(find.text('Boost’u başlat'));
    await tester.pumpAndSettle();
    expect(api.activations, 1);
    expect(find.textContaining('Boost aktif.'), findsOneWidget);
  });
}
