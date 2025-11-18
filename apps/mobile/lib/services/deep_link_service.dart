import 'package:flutter/foundation.dart';
import 'package:uni_links/uni_links.dart';
import 'dart:async';

/// Phase 31 - Deep Link Service
/// 
/// Handles deep links (f0://) and universal links (https://app.f0.ai)
class DeepLinkService {
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  StreamSubscription? _linkSubscription;
  Function(Uri)? _onLinkReceived;

  /// Initialize deep link handling
  Future<void> initialize({Function(Uri)? onLinkReceived}) async {
    _onLinkReceived = onLinkReceived;

    try {
      // Check for initial link (if app was opened from terminated state)
      final initialLink = await getInitialLink();
      if (initialLink != null) {
        _handleLink(Uri.parse(initialLink));
      }

      // Listen for links while app is running
      _linkSubscription = linkStream.listen(
        (String? link) {
          if (link != null) {
            _handleLink(Uri.parse(link));
          }
        },
        onError: (err) {
          if (kDebugMode) {
            print('❌ Deep link error: $err');
          }
        },
      );

      if (kDebugMode) {
        print('✅ Deep link service initialized');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Deep link initialization failed: $e');
      }
    }
  }

  /// Handle incoming deep link
  void _handleLink(Uri uri) {
    if (kDebugMode) {
      print('🔗 Deep link received:');
      print('  Scheme: ${uri.scheme}');
      print('  Host: ${uri.host}');
      print('  Path: ${uri.path}');
      print('  Query: ${uri.queryParameters}');
    }

    // Route based on link
    switch (uri.host) {
      case 'verify':
        _handleVerifyLink(uri);
        break;
      case 'auth':
        _handleAuthLink(uri);
        break;
      case 'invite':
        _handleInviteLink(uri);
        break;
      case 'share':
        _handleShareLink(uri);
        break;
      case 'app.f0.ai':
        // Universal link (https://app.f0.ai/...)
        _handleUniversalLink(uri);
        break;
      default:
        if (kDebugMode) {
          print('⚠️  Unknown deep link host: ${uri.host}');
        }
    }

    // Call custom handler
    _onLinkReceived?.call(uri);
  }

  /// Handle verification link (e.g., f0://verify?token=XYZ)
  void _handleVerifyLink(Uri uri) {
    final token = uri.queryParameters['token'];
    if (kDebugMode) {
      print('📧 Verification link: token=$token');
    }

    // TODO: Navigate to verification screen
    // Navigator.pushNamed(context, '/verify', arguments: {'token': token});
  }

  /// Handle auth callback (e.g., f0://auth/callback?code=ABC)
  void _handleAuthLink(Uri uri) {
    final code = uri.queryParameters['code'];
    final state = uri.queryParameters['state'];
    if (kDebugMode) {
      print('🔐 Auth callback: code=$code, state=$state');
    }

    // TODO: Complete OAuth flow
  }

  /// Handle invite link (e.g., f0://invite?id=123)
  void _handleInviteLink(Uri uri) {
    final inviteId = uri.queryParameters['id'];
    if (kDebugMode) {
      print('🎁 Invite link: id=$inviteId');
    }

    // TODO: Navigate to invite acceptance screen
  }

  /// Handle share link (e.g., f0://share?type=report&id=456)
  void _handleShareLink(Uri uri) {
    final type = uri.queryParameters['type'];
    final id = uri.queryParameters['id'];
    if (kDebugMode) {
      print('📤 Share link: type=$type, id=$id');
    }

    // TODO: Navigate to shared content
  }

  /// Handle universal link (https://app.f0.ai/...)
  void _handleUniversalLink(Uri uri) {
    if (kDebugMode) {
      print('🌐 Universal link: ${uri.path}');
    }

    // Map universal link paths to deep link handlers
    if (uri.path.startsWith('/verify')) {
      _handleVerifyLink(uri);
    } else if (uri.path.startsWith('/auth/callback')) {
      _handleAuthLink(uri);
    } else if (uri.path.startsWith('/invite')) {
      _handleInviteLink(uri);
    } else if (uri.path.startsWith('/share')) {
      _handleShareLink(uri);
    }
  }

  /// Dispose resources
  void dispose() {
    _linkSubscription?.cancel();
    _linkSubscription = null;
    _onLinkReceived = null;
  }
}


