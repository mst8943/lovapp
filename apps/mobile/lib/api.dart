import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'models.dart';
import 'package:shared_preferences/shared_preferences.dart';

// The deployed Next.js server reads @supabase/ssr cookies. Generate them from
// the current native session on each request so refresh/sign-out cannot leave
// a second, stale cookie session behind.
String webSessionCookie(String supabaseUrl, Map<String, dynamic> session) {
  final name = 'sb-${Uri.parse(supabaseUrl).host.split('.').first}-auth-token';
  final value =
      'base64-${base64Url.encode(utf8.encode(jsonEncode(session))).replaceAll('=', '')}';
  if (value.length <= 3180) return '$name=$value';
  return [
    for (var start = 0; start < value.length; start += 3180)
      '$name.${start ~/ 3180}=${value.substring(start, (start + 3180).clamp(0, value.length))}',
  ].join('; ');
}

http.MediaType uploadMediaType(String name) {
  final extension = name.split('.').last.toLowerCase();
  final type = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'pdf': 'application/pdf',
  }[extension];
  if (type == null) {
    throw const LovaskApiException(400, 'Desteklenmeyen dosya biçimi.');
  }
  return http.MediaType.parse(type);
}

class LovaskApi {
  LovaskApi({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  Future<Map<String, dynamic>> register(Map<String, dynamic> body) =>
      _post('/api/auth/register', {...body, 'platform': 'android'});
  Future<void> recordFirstOpen() async {
    final preferences = await SharedPreferences.getInstance();
    if (preferences.getBool('lovask.firstOpenRecorded') == true) return;
    final installationId =
        preferences.getString('lovask.installationId') ?? const Uuid().v4();
    await preferences.setString('lovask.installationId', installationId);
    await _post('/api/analytics/android-open', {
      'installationId': installationId,
    });
    await preferences.setBool('lovask.firstOpenRecorded', true);
  }

  Future<Map<String, dynamic>> registrationMode() => _get('/api/auth/register');
  Future<Map<String, dynamic>> branding() => _get('/api/branding');
  Future<void> requestPasswordReset(String email) async {
    await _post('/api/auth/recovery', {'event': 'forgot_password', 'email': email});
  }
  Future<void> changePassword(String password) async {
    await _post('/api/auth/recovery', {'event': 'change_password', 'password': password});
  }
  Future<Map<String, dynamic>> applyMembership(Map<String, dynamic> body) =>
      _post('/api/applications', body);

  Future<void> login(String email, String password) async {
    await _post('/api/auth/password', {
      'mode': 'login',
      'email': email,
      'password': password,
    });
    await Supabase.instance.client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<void> googleLogin({required bool register}) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('lovask.googleRegister', register);
    await Supabase.instance.client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: 'lovask://auth-callback',
      queryParams: {'prompt': 'select_account'},
    );
  }

  Future<void> ensureMembershipApproved() async {
    final auth = Supabase.instance.client.auth;
    if (auth.currentUser?.appMetadata['approved_member'] == true) return;
    final preferences = await SharedPreferences.getInstance();
    await _post('/api/auth/mobile-oauth', {
      'flow': preferences.getBool('lovask.googleRegister') == true
          ? 'register'
          : 'login',
    });
    await auth.refreshSession();
    await preferences.remove('lovask.googleRegister');
  }

  static const baseUrl = String.fromEnvironment(
    'LOVASK_API_URL',
    defaultValue: 'https://lovask.com.tr',
  );
  String? dailyPickProfileId;
  String? dailyPickReason;
  String? _dailyPickStorageKey;

  Future<void> markDailyPickSeen() async {
    final key = _dailyPickStorageKey;
    if (key == null) return;
    dailyPickProfileId = null;
    dailyPickReason = null;
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setBool(key, true);
    } catch (_) {
      // The swipe is already committed; local preference storage is optional.
    }
  }

  // Discovery
  Future<List<DiscoveryProfile>> discovery() async {
    final data = await _get('/api/discovery');
    final pick = data['dailyPick'] as Map<String, dynamic>?;
    final day = pick?['day'] as String?;
    final viewerId = pick?['viewerId'] as String?;
    _dailyPickStorageKey = day != null && viewerId != null
        ? 'lovask-daily-pick:$viewerId:$day'
        : null;
    var seen = false;
    if (_dailyPickStorageKey != null) {
      try {
        final preferences = await SharedPreferences.getInstance();
        seen = preferences.getBool(_dailyPickStorageKey!) ?? false;
      } catch (_) {}
    }
    dailyPickProfileId = seen ? null : pick?['profileId'] as String?;
    dailyPickReason = seen ? null : pick?['reason'] as String?;
    final list = data['profiles'] as List<dynamic>? ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(DiscoveryProfile.fromJson)
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> discoverySummary() =>
      _get('/api/discovery?summary=1');

  Future<Map<String, dynamic>> swipe({
    required String profileId,
    required String direction,
    String? note,
  }) => _post('/api/discovery', {
    'targetProfileId': profileId,
    'direction': direction,
    if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
  });

  Future<Map<String, dynamic>> undo() => _delete('/api/discovery');

  // Likes & Visitors
  Future<Map<String, dynamic>> likes() => _get('/api/discovery/likes');

  // Same unread-like counters as the web Beğeniler badge.
  Future<Map<String, dynamic>> likeNotifications() =>
      _get('/api/notifications');
  Future<Map<String, dynamic>> markLikesSeen() =>
      _request('/api/notifications', method: 'PATCH');

  Future<Map<String, dynamic>> visitors() => _get('/api/profile/visitors');

  Future<Map<String, dynamic>> recordVisit(String profileId) =>
      _post('/api/profile/visitors', {'profileId': profileId});

  // Conversations & Messages
  Future<Map<String, dynamic>> conversations() => _get('/api/conversations');

  Future<Map<String, dynamic>> stories() => _get('/api/stories');
  Future<Map<String, dynamic>> viewStory(String id) =>
      _patch('/api/stories', {'id': id});
  Future<Map<String, dynamic>> meetings() => _get('/api/meetings');
  Future<Map<String, dynamic>> events() => _get('/api/events');
  Future<Map<String, dynamic>> respondEvent(String id, bool attend) =>
      _post('/api/events', {'eventId': id, 'attend': attend});
  Future<Map<String, dynamic>> datePlans() => _get('/api/date-plans');
  Future<Map<String, dynamic>> campaign() => _get('/api/campaign');
  Future<Map<String, dynamic>> trackCampaignClick(String id) => _post('/api/campaign', {'id': id});
  Future<Map<String, dynamic>> createDatePlan(Map<String, dynamic> data) => _post('/api/date-plans', data);
  Future<Map<String, dynamic>> updateDatePlan(Map<String, dynamic> data) => _patch('/api/date-plans', data);
  Future<Map<String, dynamic>> chooseMeeting(String id) =>
      _post('/api/meetings', {'optionId': id});
  Future<Map<String, dynamic>> cancelMeeting() => _delete('/api/meetings');

  Future<Map<String, dynamic>> uploadStory(XFile file) async {
    final request = http.MultipartRequest('POST', _uri('/api/stories'))
      ..headers.addAll(await _headers())
      ..files.add(
        await http.MultipartFile.fromPath(
          'photo',
          file.path,
          contentType: uploadMediaType(file.name),
        ),
      );
    return _decode(await _client.send(request).then(http.Response.fromStream));
  }

  Future<Map<String, dynamic>> deleteStory(String id) =>
      _request('/api/stories', method: 'DELETE', body: {'id': id});

  Future<Map<String, dynamic>> openConversation(String profileId) =>
      _post('/api/conversations', {'targetProfileId': profileId});
  Future<Map<String, dynamic>> deleteConversation(String matchId) =>
      _delete('/api/conversations?matchId=${Uri.encodeComponent(matchId)}');

  Future<Map<String, dynamic>> respondRequest(String matchId, String action) =>
      _patch('/api/conversations', {'matchId': matchId, 'action': action});

  Future<Map<String, dynamic>> messages(
    String profileId, {
    String? before,
    String? beforeId,
  }) {
    var path = '/api/chat?profileId=$profileId';
    if (before != null) {
      path += '&before=${Uri.encodeComponent(before)}';
    }
    if (beforeId != null) {
      path += '&beforeId=$beforeId';
    }
    return _get(path);
  }

  Future<Map<String, dynamic>> sendMessage(
    String profileId,
    String message, {
    String? clientId,
    String? replyToId,
  }) => _post('/api/chat', {
    'profileId': profileId,
    'message': message,
    'clientId': ?clientId,
    'replyToId': ?replyToId,
  });

  Future<Map<String, dynamic>> sendChatImage(String matchId, XFile file) async {
    final request = http.MultipartRequest('POST', _uri('/api/chat/image'))
      ..headers.addAll(await _headers())
      ..fields.addAll({'matchId': matchId, 'clientId': const Uuid().v4()})
      ..files.add(
        await http.MultipartFile.fromPath(
          'photo',
          file.path,
          contentType: uploadMediaType(file.name),
        ),
      );
    return _decode(await _client.send(request).then(http.Response.fromStream));
  }

  Future<Map<String, dynamic>> claimAndroidWelcome(String deviceId) =>
      _post('/api/profile/android-welcome', {'deviceId': deviceId});

  Future<Map<String, dynamic>> wingman(String profileId) =>
      _post('/api/chat/wingman', {'profileId': profileId});

  Future<Map<String, dynamic>> reactToMessage(
    String messageId,
    String? emoji,
  ) => _patch('/api/chat/message', {'messageId': messageId, 'emoji': emoji});

  Future<Map<String, dynamic>> deleteMessage(String messageId) => _request(
    '/api/chat/message',
    method: 'DELETE',
    body: {'messageId': messageId},
  );

  Future<Map<String, dynamic>> voiceBio() => _get('/api/profile/voice');

  Future<Map<String, dynamic>> deleteVoiceBio() =>
      _request('/api/profile/voice', method: 'DELETE');

  Future<Map<String, dynamic>> sendVoiceBio(
    XFile file,
    String prompt,
    int durationMs,
  ) async {
    final request = http.MultipartRequest('POST', _uri('/api/profile/voice'))
      ..headers.addAll(await _headers())
      ..fields.addAll({'prompt': prompt, 'durationMs': '$durationMs'})
      ..files.add(
        await http.MultipartFile.fromPath(
          'audio',
          file.path,
          contentType: http.MediaType('audio', 'mp4'),
        ),
      );
    return _decode(await _client.send(request).then(http.Response.fromStream));
  }

  RealtimeChannel messageChannel(
    String matchId,
    void Function(Map<String, dynamic>) onChange,
  ) => Supabase.instance.client.channel('lovask-mobile:$matchId')
    ..onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'messages',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'match_id',
        value: matchId,
      ),
      callback: (payload) => onChange(payload.newRecord),
    )
    ..subscribe();

  // Noir & Payments
  Future<Map<String, dynamic>> noir() => _get('/api/noir');

  Future<Map<String, dynamic>> createNoirOrder({
    required String planSlug,
    required String provider,
  }) => _post('/api/noir', {'planSlug': planSlug, 'provider': provider});

  Future<Map<String, dynamic>> submitNoirProof({
    required String orderId,
    required String senderFullName,
    required String paymentDate,
    String? externalReference,
    XFile? proof,
  }) async {
    final request = http.MultipartRequest('POST', _uri('/api/noir/proof'))
      ..headers.addAll(await _headers())
      ..fields['orderId'] = orderId
      ..fields['senderFullName'] = senderFullName
      ..fields['paymentDate'] = paymentDate;

    if (externalReference != null && externalReference.isNotEmpty) {
      request.fields['externalReference'] = externalReference;
    }

    if (proof != null) {
      request.files.add(
        await http.MultipartFile.fromPath(
          'proof',
          proof.path,
          contentType: uploadMediaType(proof.name),
        ),
      );
    }

    request.fields.putIfAbsent('externalReference', () => '');
    final response = await _client.send(request).then(http.Response.fromStream);
    return _decode(response);
  }

  // Profile & Photos
  Future<Map<String, dynamic>> profile() => _get('/api/profile/onboarding');

  Future<Map<String, dynamic>> verificationStatus() =>
      _get('/api/profile/verification');
  Future<Map<String, dynamic>> contactVerificationStatus() =>
      _get('/api/profile/contact-verification');
  Future<Map<String, dynamic>> contactVerification(
    String channel,
    String action, {
    String? code,
  }) => _post('/api/profile/contact-verification', {
    'channel': channel,
    'action': action,
    'code': ?code,
  });
  Future<Map<String, dynamic>> uploadSelfie(XFile file) async {
    final request =
        http.MultipartRequest('POST', _uri('/api/profile/verification'))
          ..headers.addAll(await _headers())
          ..files.add(
            await http.MultipartFile.fromPath(
              'selfie',
              file.path,
              contentType: uploadMediaType(file.name),
            ),
          );
    return _decode(await _client.send(request).then(http.Response.fromStream));
  }

  Future<Map<String, dynamic>> saveProfile(Map<String, dynamic> body) =>
      _post('/api/profile/onboarding', body);

  Future<Map<String, dynamic>> uploadPhoto(XFile file) async {
    final request = http.MultipartRequest('POST', _uri('/api/profile/photos'))
      ..headers.addAll(await _headers())
      ..files.add(
        await http.MultipartFile.fromPath(
          'photo',
          file.path,
          contentType: uploadMediaType(file.name),
        ),
      );
    final response = await _client.send(request).then(http.Response.fromStream);
    return _decode(response);
  }

  Future<Map<String, dynamic>> deletePhoto(String photoId) => _request(
    '/api/profile/photos',
    method: 'DELETE',
    body: {'photoId': photoId},
  );

  Future<Map<String, dynamic>> setDiscoverable(bool value) =>
      _patch('/api/profile/account', {'discoverable': value});

  Future<Map<String, dynamic>> boostStatus() => _get('/api/profile/boost');

  Future<Map<String, dynamic>> activateBoost() =>
      _post('/api/profile/boost', {});

  Future<Map<String, dynamic>> setGhostMode(bool value) =>
      _patch('/api/profile/account', {'ghostEnabled': value});

  Future<Map<String, dynamic>> deleteAccount() => _request(
    '/api/profile/account',
    method: 'DELETE',
    body: {'confirmation': 'HESABIMI SİL'},
  );

  Future<Map<String, dynamic>> recoverAccount() =>
      _post('/api/profile/account', {});

  // Safety & Support
  Future<Map<String, dynamic>> safety(Map<String, dynamic> body) =>
      _post('/api/safety', body);

  Future<Map<String, dynamic>> blockedProfiles() => _get('/api/safety');

  Future<Map<String, dynamic>> preferences() =>
      _get('/api/discovery/preferences');

  Future<Map<String, dynamic>> savePreferences(Map<String, dynamic> body) =>
      _patch('/api/discovery/preferences', body);

  Future<Map<String, dynamic>> presence() =>
      _request('/api/presence', method: 'POST');
  Future<Map<String, dynamic>> activeChat(String matchId, bool open) =>
      _post('/api/presence', {'matchId': matchId, 'open': open});

  Future<Map<String, dynamic>> pushPreferences() =>
      _get('/api/push/preferences');

  Future<Map<String, dynamic>> savePushPreferences(Map<String, dynamic> body) =>
      _patch('/api/push/preferences', body);

  Future<Map<String, dynamic>> saveFcmToken(String fcmToken) =>
      _post('/api/push/subscriptions', {'fcmToken': fcmToken});

  Future<Map<String, dynamic>> support(Map<String, dynamic> body) =>
      _post('/api/profile/support', body);

  Future<Map<String, dynamic>> referrals() => _get('/api/profile/referrals');

  Future<Map<String, dynamic>> supportTickets() => _get('/api/profile/support');
  Future<Map<String, dynamic>> replySupport(String ticketId, String message) =>
      _patch('/api/profile/support', {
        'ticketId': ticketId,
        'message': message,
      });
  Future<Map<String, dynamic>> shareReferral() =>
      _post('/api/profile/referrals', {});

  Future<Map<String, dynamic>> accountState() async {
    try {
      return await _get('/api/profile/account');
    } on LovaskApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 405) rethrow;
    }
    // Older deployments have no GET account route. Do not access private
    // tables directly or pretend their visibility/deletion state is known.
    return {'recoveryStatusUnavailable': true};
  }

  Future<Map<String, dynamic>> sendAudio(
    String profileId,
    XFile file, {
    required String clientId,
    required int durationMs,
    required List<int> waveform,
  }) async {
    if (durationMs < 500 ||
        durationMs > 60000 ||
        await file.length() > 4 * 1024 * 1024) {
      throw const LovaskApiException(
        400,
        'Ses kaydı 0,5–60 saniye ve en fazla 4 MB olmalı.',
      );
    }
    final request = http.MultipartRequest('POST', _uri('/api/chat/audio'))
      ..headers.addAll(await _headers())
      ..fields.addAll({
        'profileId': profileId,
        'clientId': clientId,
        'durationMs': '$durationMs',
        'waveform': jsonEncode(waveform),
      })
      ..files.add(
        await http.MultipartFile.fromPath(
          'audio',
          file.path,
          contentType: http.MediaType('audio', 'mp4'),
        ),
      );
    return _decode(await _client.send(request).then(http.Response.fromStream));
  }

  // Internal helpers
  Future<Map<String, dynamic>> _get(String path) async {
    final response = await _client.get(_uri(path), headers: await _headers());
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client.post(
      _uri(path),
      headers: {...await _headers(), 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) =>
      _request(path, method: 'PATCH', body: body);

  Future<Map<String, dynamic>> _delete(String path) =>
      _request(path, method: 'DELETE');

  Future<Map<String, dynamic>> _request(
    String path, {
    required String method,
    Map<String, dynamic>? body,
  }) async {
    final request = http.Request(method, _uri(path))
      ..headers.addAll({
        ...await _headers(),
        if (body != null) 'Content-Type': 'application/json',
      })
      ..body = body == null ? '' : jsonEncode(body);
    final response = await _client.send(request).then(http.Response.fromStream);
    return _decode(response);
  }

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<Map<String, String>> _headers() async {
    const supabaseUrl = String.fromEnvironment(
      'SUPABASE_URL',
      defaultValue: 'https://jagqvyfnychnoxarebgv.supabase.co',
    );
    const supabaseKey = String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZ3F2eWZueWNobm94YXJlYmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTgxOTQsImV4cCI6MjEwNDg5NDE5NH0.NCqnkHgP0rjVvdUv93xKV-YcuUMC9f-IVPcCJGEHrjk',
    );
    final configured = supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;
    String? token;
    if (configured) {
      final auth = Supabase.instance.client.auth;
      final session = auth.currentSession;
      final expiresAt = session?.expiresAt;
      if (session != null &&
          expiresAt != null &&
          expiresAt <= DateTime.now().millisecondsSinceEpoch ~/ 1000 + 30) {
        token = (await auth.refreshSession()).session?.accessToken;
      } else {
        token = session?.accessToken;
      }
    }
    return {
      if (token != null) 'Authorization': 'Bearer $token',
      if (token != null)
        'Cookie': webSessionCookie(
          supabaseUrl,
          Supabase.instance.client.auth.currentSession!.toJson(),
        ),
      'Accept': 'application/json',
      'Origin': Uri.parse(baseUrl).origin,
    };
  }

  Map<String, dynamic> _decode(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = null;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = body is Map<String, dynamic>
          ? body['error']?.toString()
          : null;
      throw LovaskApiException(
        response.statusCode,
        msg ?? 'İşlem başarısız.',
        code: body is Map<String, dynamic> ? body['code'] as String? : null,
      );
    }
    return body is Map<String, dynamic> ? body : <String, dynamic>{};
  }
}

class LovaskApiException implements Exception {
  const LovaskApiException(this.statusCode, this.message, {this.code});
  final String? code;
  final int statusCode;
  final String? message;

  @override
  String toString() => message ?? 'Hata kodu: $statusCode';
}
