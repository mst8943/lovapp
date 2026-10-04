import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await NotificationService.initialize();
  final notification = message.notification;
  if (notification != null) return; // Android already displays FCM notification payloads in the background.
  final title = notification?.title ?? message.data['title'] ?? 'Lovask';
  final body = notification?.body ?? message.data['body'] ?? 'Yeni bir mesajın var.';
  final payload = message.data['payload'] ?? message.data['url'] ?? 'matches';

  await NotificationService.showMessageNotification(
    id: message.messageId.hashCode,
    title: title,
    body: body,
    payload: payload,
  );
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const String channelId = 'lovask_high_importance';
  static const String channelName = 'Lovask Bildirimleri';
  static const String channelDescription =
      'Yeni mesajlar, eşleşmeler ve süper beğeniler';

  /// Currently active chat match ID (so we don't notify for an open chat)
  static String? activeChatMatchId;

  /// Callback when a notification is tapped
  static void Function(String? payload)? onNotificationTapped;

  static bool _initialized = false;

  static Future<void> initialize({
    void Function(String? payload)? onNotificationTap,
  }) async {
    if (_initialized) return;
    onNotificationTapped = onNotificationTap;

    // Initialize Firebase
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      // Foreground messages listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        if (message.data['matchId'] == activeChatMatchId) return;
        final notification = message.notification;
        final title = notification?.title ?? message.data['title'] ?? 'Lovask';
        final body = notification?.body ?? message.data['body'] ?? 'Yeni bir mesajın var.';
        final payload = message.data['payload'] ?? message.data['url'] ?? 'matches';

        showMessageNotification(
          id: message.messageId.hashCode,
          title: title,
          body: body,
          payload: payload,
        );
      });

      // When user taps notification from background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final payload = message.data['payload'] ?? message.data['url'] ?? 'matches';
        onNotificationTapped?.call(payload);
      });

      // Check if opened from terminated state
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        final payload = initialMessage.data['payload'] ?? initialMessage.data['url'] ?? 'matches';
        onNotificationTapped?.call(payload);
      }
      debugPrint('Firebase initialized successfully.');
    } catch (e) {
      debugPrint('Firebase messaging init skipped: $e');
    }

    // Initialize Local Notifications
    try {
      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidSettings);

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          onNotificationTapped?.call(response.payload);
        },
      );

      const androidChannel = AndroidNotificationChannel(
        channelId,
        channelName,
        description: channelDescription,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        showBadge: true,
      );

      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(androidChannel);

        try {
          await androidPlugin.requestNotificationsPermission();
        } catch (_) {}
      }
      debugPrint('Local notifications initialized successfully.');
    } catch (e) {
      debugPrint('NotificationService local notification init error: $e');
    }

    _initialized = true;
  }

  static Future<String?> getFcmToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('Error getting FCM token: $e');
      return null;
    }
  }

  static Future<void> showMessageNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    try {
      const androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDescription,
        importance: Importance.max,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
        color: Color(0xFF55227C),
        playSound: true,
        enableVibration: true,
        showWhen: true,
        styleInformation: BigTextStyleInformation(''),
      );

      const details = NotificationDetails(android: androidDetails);

      await _localNotifications.show(
        id,
        title,
        body,
        details,
        payload: payload,
      );
    } catch (e) {
      debugPrint('Notification show error: $e');
    }
  }

  static Future<void> showMatchNotification({
    required String name,
    String? payload,
  }) async {
    await showMessageNotification(
      id: 999991,
      title: 'Tebrikler! Yeni Eşleşme 🎉',
      body: '$name ile eşleştin. Şimdi sohbeti başlatabilirsin!',
      payload: payload ?? 'matches',
    );
  }

  static Future<void> showLikeNotification({
    required int count,
    String? payload,
  }) async {
    await showMessageNotification(
      id: 999992,
      title: 'Lovask · Yeni Beğeni',
      body: count > 1
          ? 'Seni beğenen $count yeni kişi var!'
          : 'Seni beğenen yeni bir profil var!',
      payload: payload ?? 'likes',
    );
  }

  static Future<void> cancel(int id) async {
    try {
      await _localNotifications.cancel(id);
    } catch (_) {}
  }

  static Future<void> cancelAll() async {
    try {
      await _localNotifications.cancelAll();
    } catch (_) {}
  }
}
