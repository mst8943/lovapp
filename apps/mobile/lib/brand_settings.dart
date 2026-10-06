import 'package:flutter/foundation.dart';

class AppBrandSettings {
  const AppBrandSettings({
    this.name = 'Lovask',
    this.tagline = 'Tesadüften fazlası',
    this.supportEmail = 'destek@lovask.com.tr',
    this.logoUrl = '/logo_l_extra_thick.png',
  });

  final String name;
  final String tagline;
  final String supportEmail;
  final String logoUrl;

  static final value = ValueNotifier(const AppBrandSettings());
  static const _baseUrl = String.fromEnvironment(
    'LOVASK_API_URL',
    defaultValue: 'https://lovask.com.tr',
  );

  String get resolvedLogoUrl => Uri.parse(_baseUrl).resolve(logoUrl).toString();

  static Future<void> load(
    Future<Map<String, dynamic>> Function() fetch,
  ) async {
    try {
      final data = await fetch().timeout(const Duration(seconds: 3));
      String read(String key, String fallback) =>
          data[key] is String && (data[key] as String).trim().isNotEmpty
          ? (data[key] as String).trim()
          : fallback;
      value.value = AppBrandSettings(
        name: read('brand_name', value.value.name),
        tagline: read('tagline', value.value.tagline),
        supportEmail: read('support_email', value.value.supportEmail),
        logoUrl: read('logo_url', value.value.logoUrl),
      );
    } catch (_) {
      // Keep the bundled defaults available when the branding endpoint is down.
    }
  }
}
