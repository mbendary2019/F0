import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Phase 31 - Push Notifications Service
/// 
/// Handles Firebase Cloud Messaging (FCM) for Android and APNs for iOS
class PushService {
  static final PushService _instance = PushService._internal();
  factory PushService() => _instance;
  PushService._internal();

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;

  /// Initialize push notifications
  Future<void> initialize() async {
    try {
      // Request permission (iOS)
      NotificationSettings settings = await _firebaseMessaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      if (kDebugMode) {
        print('Push permission status: ${settings.authorizationStatus}');
      }

      // Get FCM token
      String? token = await _firebaseMessaging.getToken();
      if (kDebugMode) {
        print('FCM Token: $token');
      }

      // Subscribe to topics
      await _subscribeToTopics();

      // Configure foreground message handler
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Configure background message handler
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Handle notification taps
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

      // Check for initial message (if app was opened from terminated state)
      RemoteMessage? initialMessage = await _firebaseMessaging.getInitialMessage();
      if (initialMessage != null) {
        _handleMessageOpenedApp(initialMessage);
      }

      if (kDebugMode) {
        print('✅ Push notifications initialized');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Push notification initialization failed: $e');
      }
    }
  }

  /// Subscribe to notification topics
  Future<void> _subscribeToTopics() async {
    try {
      // Subscribe to general topics
      await _firebaseMessaging.subscribeToTopic('all_users');
      await _firebaseMessaging.subscribeToTopic('ops');
      await _firebaseMessaging.subscribeToTopic('release');
      await _firebaseMessaging.subscribeToTopic('alerts');

      if (kDebugMode) {
        print('✅ Subscribed to notification topics');
      }
    } catch (e) {
      if (kDebugMode) {
        print('⚠️  Failed to subscribe to topics: $e');
      }
    }
  }

  /// Handle foreground messages
  void _handleForegroundMessage(RemoteMessage message) {
    if (kDebugMode) {
      print('📩 Foreground message received:');
      print('  Title: ${message.notification?.title}');
      print('  Body: ${message.notification?.body}');
      print('  Data: ${message.data}');
    }

    // TODO: Show local notification or in-app banner
    // You can use flutter_local_notifications package for this
  }

  /// Handle background messages (static function required)
  static Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
    if (kDebugMode) {
      print('📩 Background message received:');
      print('  Title: ${message.notification?.title}');
      print('  Body: ${message.notification?.body}');
      print('  Data: ${message.data}');
    }

    // Handle background message
    // This runs in a separate isolate
  }

  /// Handle notification tap (app opened from notification)
  void _handleMessageOpenedApp(RemoteMessage message) {
    if (kDebugMode) {
      print('🔔 Notification tapped:');
      print('  Title: ${message.notification?.title}');
      print('  Data: ${message.data}');
    }

    // TODO: Navigate to specific screen based on message data
    final String? screen = message.data['screen'];
    final String? id = message.data['id'];

    if (screen != null) {
      // Navigate to screen
      // Example: Navigator.pushNamed(context, screen, arguments: {'id': id});
      if (kDebugMode) {
        print('  Navigate to: $screen (id: $id)');
      }
    }
  }

  /// Get current FCM token
  Future<String?> getToken() async {
    try {
      return await _firebaseMessaging.getToken();
    } catch (e) {
      if (kDebugMode) {
        print('❌ Failed to get FCM token: $e');
      }
      return null;
    }
  }

  /// Subscribe to a custom topic
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _firebaseMessaging.subscribeToTopic(topic);
      if (kDebugMode) {
        print('✅ Subscribed to topic: $topic');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Failed to subscribe to topic $topic: $e');
      }
    }
  }

  /// Unsubscribe from a topic
  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _firebaseMessaging.unsubscribeFromTopic(topic);
      if (kDebugMode) {
        print('✅ Unsubscribed from topic: $topic');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Failed to unsubscribe from topic $topic: $e');
      }
    }
  }
}


