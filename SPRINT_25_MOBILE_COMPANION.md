# Sprint 25 - Mobile Companion App
## v26.0.0 - Complete Implementation Guide

> Comprehensive Flutter mobile app with Firebase integration, push notifications (FCM), real-time dashboard, billing overview, and deep linking to web platform.

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Server-Side APIs](#2-server-side-apis)
3. [Firebase Cloud Functions](#3-firebase-cloud-functions)
4. [Flutter Application](#4-flutter-application)
5. [Push Notifications (FCM)](#5-push-notifications-fcm)
6. [Deep Linking & Navigation](#6-deep-linking--navigation)
7. [CI/CD & Deployment](#7-cicd--deployment)
8. [Testing & Smoke Tests](#8-testing--smoke-tests)

---

## 1) Prerequisites & Setup

### Environment Variables

**Server**: `.env.local` (additions)

```bash
# Mobile API Configuration
MOBILE_API_VERSION=v1
MOBILE_RATE_LIMIT_RPM=60

# Firebase Cloud Messaging
FCM_SERVER_KEY=AAAA...
FCM_SENDER_ID=123456789

# Deep Links
MOBILE_DEEP_LINK_DOMAIN=f0.page.link
MOBILE_APP_STORE_URL=https://apps.apple.com/app/f0-desktop/id...
MOBILE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=ai.f0.mobile
```

**Flutter**: `mobile/.env`

```bash
F0_API_BASE=https://f0.ai
F0_WEB_URL=https://f0.ai
F0_SUPPORT_EMAIL=support@f0.ai
```

### Feature Flags

**Firestore**: `config/feature_flags`

```json
{
  "mobile": {
    "enabled": true,
    "min_version": "1.0.0",
    "require_update_version": null
  },
  "mobile_push": {
    "enabled": true,
    "types": ["billing", "status", "payouts", "updates", "alerts"]
  },
  "mobile_features": {
    "billing_management": true,
    "agent_monitoring": true,
    "quick_actions": true,
    "biometric_auth": true
  }
}
```

### Flutter Dependencies

**File**: `mobile/pubspec.yaml`

```yaml
name: f0_mobile
description: F0 Mobile Companion App
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # Firebase
  firebase_core: ^2.24.2
  firebase_auth: ^4.16.0
  firebase_messaging: ^14.7.9
  cloud_firestore: ^4.14.0
  firebase_analytics: ^10.8.0

  # State Management
  riverpod: ^2.4.9
  flutter_riverpod: ^2.4.9

  # Navigation
  go_router: ^13.0.0

  # HTTP & API
  http: ^1.1.2
  dio: ^5.4.0

  # UI Components
  google_fonts: ^6.1.0
  flutter_svg: ^2.0.9
  cached_network_image: ^3.3.1
  shimmer: ^3.0.0

  # Local Storage
  shared_preferences: ^2.2.2
  flutter_secure_storage: ^9.0.0

  # Biometric
  local_auth: ^2.1.8

  # Other
  intl: ^0.18.1
  url_launcher: ^6.2.2
  package_info_plus: ^5.0.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1
  build_runner: ^2.4.7

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
```

---

## 2) Server-Side APIs

### 2.1 Mobile Overview API

**File**: `src/app/api/mobile/overview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyMobileToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyMobileToken(token);
    const uid = decoded.uid;

    // Get user data
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();

    // Get system status
    const statusDoc = await adminDb.collection('status').doc('components').get();
    const systemStatus = statusDoc.data() || {};

    // Get active agents (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const agentMetrics = await adminDb.collection('telemetry')
      .where('uid', '==', uid)
      .where('type', '==', 'agent')
      .where('timestamp', '>', oneDayAgo)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const agents = agentMetrics.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.agentName || 'Unknown',
        status: data.status || 'active',
        lastRun: data.timestamp,
        tokensUsed: data.tokensUsed || 0,
        cost: data.cost || 0
      };
    });

    // Get recent notifications
    const notificationsSnap = await adminDb
      .collection('notifications').doc(uid)
      .collection('inbox')
      .orderBy('ts', 'desc')
      .limit(10)
      .get();

    const notifications = notificationsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get usage summary
    const usageDoc = await adminDb
      .collection('usage_summary').doc(uid)
      .get();

    const usage = usageDoc.data() || {
      requests: 0,
      tokensUsed: 0,
      cost: 0
    };

    return NextResponse.json({
      user: {
        uid,
        email: userData?.email,
        displayName: userData?.displayName,
        plan: userData?.plan || 'free',
        entitlements: userData?.entitlements || {}
      },
      systemStatus: {
        overall: systemStatus.overall || 'operational',
        components: systemStatus.components || []
      },
      agents,
      usage: {
        requests: usage.requests,
        tokensUsed: usage.tokensUsed,
        cost: usage.cost,
        quotaUsed: usage.quotaPercent || 0
      },
      notifications: notifications.slice(0, 5) // Top 5 for overview
    });

  } catch (err: any) {
    console.error('Mobile overview error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch overview' },
      { status: 500 }
    );
  }
}
```

### 2.2 Billing & Invoices API

**File**: `src/app/api/mobile/billing/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyMobileToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyMobileToken(token);
    const uid = decoded.uid;

    // Get current billing info
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();

    // Get recent invoices
    const invoicesSnap = await adminDb
      .collection('invoices')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const invoices = invoicesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get payment method
    const paymentMethodDoc = await adminDb
      .collection('users').doc(uid)
      .collection('payment_methods').doc('default')
      .get();

    const paymentMethod = paymentMethodDoc.exists ? paymentMethodDoc.data() : null;

    // Get subscription details
    const subscriptionDoc = await adminDb
      .collection('subscriptions')
      .where('uid', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    const subscription = subscriptionDoc.empty ? null : {
      id: subscriptionDoc.docs[0].id,
      ...subscriptionDoc.docs[0].data()
    };

    return NextResponse.json({
      plan: userData?.plan || 'free',
      billing: {
        currentPeriodEnd: subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        amount: subscription?.amount || 0,
        currency: subscription?.currency || 'USD'
      },
      paymentMethod: paymentMethod ? {
        type: paymentMethod.type,
        last4: paymentMethod.last4,
        brand: paymentMethod.brand
      } : null,
      invoices: invoices.map(inv => ({
        id: inv.id,
        amount: inv.amount,
        status: inv.status,
        date: inv.createdAt,
        pdfUrl: inv.pdfUrl
      }))
    });

  } catch (err: any) {
    console.error('Mobile billing error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch billing' },
      { status: 500 }
    );
  }
}
```

### 2.3 Notifications API

**File**: `src/app/api/mobile/notifications/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyMobileToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyMobileToken(token);
    const uid = decoded.uid;

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';

    let query = adminDb
      .collection('notifications').doc(uid)
      .collection('inbox')
      .orderBy('ts', 'desc')
      .limit(limit);

    if (unreadOnly) {
      query = query.where('read', '==', false) as any;
    }

    const notificationsSnap = await query.get();

    const notifications = notificationsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ notifications });

  } catch (err: any) {
    console.error('Mobile notifications error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyMobileToken(token);
    const uid = decoded.uid;

    const { notificationId, read } = await req.json();

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId required' }, { status: 400 });
    }

    await adminDb
      .collection('notifications').doc(uid)
      .collection('inbox').doc(notificationId)
      .update({ read: read ?? true, readAt: Date.now() });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Mobile notification update error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}
```

### 2.4 Quick Actions API

**File**: `src/app/api/mobile/actions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyMobileToken } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyMobileToken(token);
    const uid = decoded.uid;

    const { action, params } = await req.json();

    let result: any = {};

    switch (action) {
      case 'restart_agent':
        // Trigger agent restart
        await adminDb.collection('agent_commands').add({
          uid,
          agentId: params.agentId,
          command: 'restart',
          timestamp: Date.now()
        });
        result = { success: true, message: 'Agent restart initiated' };
        break;

      case 'pause_billing':
        // Pause subscription
        await adminDb.collection('billing_commands').add({
          uid,
          command: 'pause',
          timestamp: Date.now()
        });
        result = { success: true, message: 'Billing pause initiated' };
        break;

      case 'update_payment':
        // Return Stripe portal URL
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

        const userDoc = await adminDb.collection('users').doc(uid).get();
        const customerId = userDoc.data()?.stripeCustomerId;

        if (!customerId) {
          return NextResponse.json({ error: 'No customer ID' }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: process.env.NEXT_PUBLIC_APP_URL + '/billing'
        });

        result = { success: true, portalUrl: session.url };
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Log action
    await adminDb.collection('audit_logs').add({
      type: 'mobile_action',
      uid,
      action,
      params,
      timestamp: Date.now()
    });

    return NextResponse.json(result);

  } catch (err: any) {
    console.error('Mobile action error:', err);
    return NextResponse.json(
      { error: err.message || 'Action failed' },
      { status: 500 }
    );
  }
}
```

---

## 3) Firebase Cloud Functions

### 3.1 Push Notification Function

**File**: `functions/src/mobile/push.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface PushPayload {
  uid: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
}

/**
 * Send push notification to user's mobile devices
 */
export const sendMobilePush = functions.https.onCall(async (data: PushPayload, context) => {
  const { uid, title, body, type, data: payload } = data;

  if (!uid || !title) {
    throw new functions.https.HttpsError('invalid-argument', 'uid and title required');
  }

  try {
    // Get user's FCM tokens
    const tokensSnap = await admin.firestore()
      .collection('users').doc(uid)
      .collection('devices_mobile')
      .get();

    const tokens = tokensSnap.docs.map(doc => doc.id);

    if (tokens.length === 0) {
      console.log('No FCM tokens found for user:', uid);
      return { sent: 0, failed: 0 };
    }

    // Send multicast message
    const message = {
      tokens,
      notification: {
        title,
        body
      },
      data: {
        type,
        ...payload,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'f0_alerts',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Remove invalid tokens
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    // Cleanup invalid tokens
    if (invalidTokens.length > 0) {
      const batch = admin.firestore().batch();
      invalidTokens.forEach(token => {
        const ref = admin.firestore()
          .collection('users').doc(uid)
          .collection('devices_mobile').doc(token);
        batch.delete(ref);
      });
      await batch.commit();
    }

    console.log(`Push notification sent: ${response.successCount} success, ${response.failureCount} failed`);

    return {
      sent: response.successCount,
      failed: response.failureCount
    };

  } catch (err: any) {
    console.error('Push notification error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

/**
 * Trigger push on billing events
 */
export const onBillingEvent = functions.firestore
  .document('users/{uid}/billing_events/{eventId}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const uid = context.params.uid;

    let title = '';
    let body = '';
    let type = 'billing';

    switch (event.type) {
      case 'payment_failed':
        title = 'Payment Failed';
        body = 'Please update your payment method to continue using F0';
        break;
      case 'payment_succeeded':
        title = 'Payment Successful';
        body = `Your payment of $${event.amount} was processed successfully`;
        break;
      case 'subscription_cancelled':
        title = 'Subscription Cancelled';
        body = 'Your subscription has been cancelled';
        break;
      default:
        return;
    }

    await sendMobilePush.run({
      data: { uid, title, body, type }
    } as any);
  });

/**
 * Trigger push on payout events
 */
export const onPayoutEvent = functions.firestore
  .document('payouts/{payoutId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only notify on status change to 'paid'
    if (before.status !== 'paid' && after.status === 'paid') {
      const uid = after.creatorUid;

      await sendMobilePush.run({
        data: {
          uid,
          title: 'Payout Processed',
          body: `Your payout of $${after.netUSD.toFixed(2)} has been processed`,
          type: 'payout',
          data: { payoutId: context.params.payoutId }
        }
      } as any);
    }
  });

/**
 * Trigger push on system status changes
 */
export const onStatusChange = functions.firestore
  .document('status/components')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if any component went from operational to degraded/outage
    const components = after.components || [];
    const degradedComponents = components.filter((c: any) =>
      c.state !== 'operational' &&
      before.components?.find((bc: any) => bc.id === c.id)?.state === 'operational'
    );

    if (degradedComponents.length > 0) {
      // Notify all active users
      const usersSnap = await admin.firestore()
        .collection('users')
        .where('plan', 'in', ['pro', 'teams', 'enterprise'])
        .limit(1000)
        .get();

      const pushPromises = usersSnap.docs.map(doc =>
        sendMobilePush.run({
          data: {
            uid: doc.id,
            title: 'System Status Alert',
            body: `${degradedComponents[0].name} is experiencing issues`,
            type: 'status'
          }
        } as any)
      );

      await Promise.allSettled(pushPromises);
    }
  });
```

---

## 4) Flutter Application

### 4.1 Main Entry Point

**File**: `mobile/lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'app.dart';
import 'services/notifications_service.dart';

// Background message handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  print('Handling background message: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Setup background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Initialize notifications
  await NotificationsService.initialize();

  runApp(
    const ProviderScope(
      child: F0MobileApp(),
    ),
  );
}
```

### 4.2 App Configuration

**File**: `mobile/lib/app.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'router.dart';

class F0MobileApp extends ConsumerWidget {
  const F0MobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'F0 Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
        textTheme: GoogleFonts.interTextTheme(),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.dark,
        ),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
      ),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
```

### 4.3 Router Configuration

**File**: `mobile/lib/router.dart`

```dart
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/billing_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/settings_screen.dart';

final router = GoRouter(
  initialLocation: '/splash',
  redirect: (context, state) async {
    final user = FirebaseAuth.instance.currentUser;
    final isLoggingIn = state.matchedLocation == '/login';
    final isSplash = state.matchedLocation == '/splash';

    if (isSplash) return null;

    if (user == null && !isLoggingIn) {
      return '/login';
    }

    if (user != null && isLoggingIn) {
      return '/dashboard';
    }

    return null;
  },
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/billing',
      builder: (context, state) => const BillingScreen(),
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
  ],
);
```

### 4.4 API Service

**File**: `mobile/lib/services/api_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';

class ApiService {
  static const String baseUrl = String.fromEnvironment(
    'F0_API_BASE',
    defaultValue: 'https://f0.ai',
  );

  static Future<Map<String, dynamic>> get(String path) async {
    final token = await _getToken();

    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('API Error: ${response.statusCode} - ${response.body}');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();

    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(data),
    );

    if (response.statusCode != 200) {
      throw Exception('API Error: ${response.statusCode} - ${response.body}');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> patch(
    String path,
    Map<String, dynamic> data,
  ) async {
    final token = await _getToken();

    final response = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(data),
    );

    if (response.statusCode != 200) {
      throw Exception('API Error: ${response.statusCode}');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<String> _getToken() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not authenticated');

    final token = await user.getIdToken();
    return token ?? '';
  }
}
```

---

*This implementation is getting quite long. Should I continue with the remaining sections (Push Notifications Service, Screens, CI/CD, Testing) in a separate file?*
