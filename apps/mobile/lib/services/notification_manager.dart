import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api.dart';
import '../screens/chat_screen.dart';
import 'notification_service.dart';

class LovaskNotificationManager {
  LovaskNotificationManager({
    required this.api,
    required this.getContext,
    required this.switchTab,
    required this.onUnreadChange,
    this.onUnreadLikesChange,
  });

  final LovaskApi api;
  final BuildContext Function() getContext;
  final void Function(int tabIndex) switchTab;
  final void Function(int count) onUnreadChange;
  final void Function(int count)? onUnreadLikesChange;

  RealtimeChannel? _realtimeChannel;
  Timer? _pollTimer;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    await NotificationService.initialize(
      onNotificationTap: _handleNotificationPayload,
    );

    _setupRealtime();
    _startPolling();
    _registerFcm();
  }

  Future<void> _registerFcm() async {
    try {
      final token = await NotificationService.getFcmToken();
      if (token != null && token.isNotEmpty) {
        await api.saveFcmToken(token);
        debugPrint('Lovask FCM token registered.');
      }
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  void _handleNotificationPayload(String? payload) {
    if (payload == null) return;
    final context = getContext();

    if (payload == 'matches') {
      switchTab(3);
    } else if (payload == 'likes') {
      switchTab(2);
    } else if (payload.startsWith('chat:')) {
      final parts = payload.split(':');
      if (parts.length >= 3) {
        final matchId = parts[1];
        final profileId = parts[2];
        final name = parts.length >= 4 ? parts[3] : 'Sohbet';

        switchTab(3);
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ChatScreen(
              matchId: matchId,
              profileId: profileId,
              name: name,
            ),
          ),
        );
      } else {
        switchTab(3);
      }
    }
  }

  void _setupRealtime() {
    try {
      final client = Supabase.instance.client;
      final currentUserId = client.auth.currentUser?.id;
      if (currentUserId == null) return;

      _realtimeChannel = client.channel('lovask-mobile-notifications-$currentUserId')
        ..onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          callback: (_) => _refreshUnread(),
        )
        ..onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'matches',
          callback: (_) => _refreshUnread(),
        )
        ..subscribe();
    } catch (e) {
      debugPrint('Realtime notification setup skipped: $e');
    }
  }

  void _startPolling() {
    _refreshUnread();
    _refreshLikes();
    _pollTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      _refreshUnread();
      _refreshLikes();
    });
  }

  Future<void> _refreshLikes() async {
    final callback = onUnreadLikesChange;
    if (callback == null) return;
    try {
      final res = await api.likeNotifications();
      callback((res['unreadLikes'] as num?)?.toInt() ?? 0);
    } catch (_) {}
  }

  Future<void> _refreshUnread() async {
    try {
      final res = await api.conversations();
      final items = res['conversations'] as List<dynamic>? ?? [];
      int unread = 0;
      for (final item in items) {
        if (item is Map) {
          final count = (item['unreadCount'] as num?)?.toInt() ?? 0;
          unread += count;
        }
      }

      onUnreadChange(unread);
    } catch (_) {}
  }

  void stop() {
    _pollTimer?.cancel();
    _pollTimer = null;
    try {
      _realtimeChannel?.unsubscribe();
      _realtimeChannel = null;
    } catch (_) {}
  }
}
