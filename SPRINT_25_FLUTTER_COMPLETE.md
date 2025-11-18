# Sprint 25 - Part 2: Flutter Screens, FCM & Deployment
## Mobile Companion - Complete Implementation

---

## 5) Push Notifications (FCM)

### 5.1 Notifications Service

**File**: `mobile/lib/services/notifications_service.dart`

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationsService {
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    final messaging = FirebaseMessaging.instance;

    // Request permissions
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted permission');

      // Get FCM token
      final token = await messaging.getToken();
      if (token != null) {
        await _saveToken(token);
      }

      // Listen for token refresh
      messaging.onTokenRefresh.listen(_saveToken);

      // Setup local notifications
      await _setupLocalNotifications();

      // Setup message handlers
      _setupMessageHandlers();
    }
  }

  static Future<void> _saveToken(String token) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    await FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .collection('devices_mobile')
        .doc(token)
        .set({
      'token': token,
      'platform': 'mobile',
      'createdAt': FieldValue.serverTimestamp(),
      'lastUsedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    print('FCM token saved: $token');
  }

  static Future<void> _setupLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _handleNotificationTap,
    );

    // Create notification channel (Android)
    const channel = AndroidNotificationChannel(
      'f0_alerts',
      'F0 Alerts',
      description: 'Important notifications from F0',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static void _setupMessageHandlers() {
    // Foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Foreground message: ${message.notification?.title}');

      if (message.notification != null) {
        _showLocalNotification(message);
      }
    });

    // Background/terminated message tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Message opened app: ${message.data}');
      _handleNotificationTap(
        NotificationResponse(
          notificationResponseType: NotificationResponseType.selectedNotification,
          payload: message.data['type'],
        ),
      );
    });
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    final android = message.notification?.android;

    if (notification == null) return;

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'f0_alerts',
          'F0 Alerts',
          channelDescription: 'Important notifications from F0',
          icon: android?.smallIcon ?? '@mipmap/ic_launcher',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['type'],
    );
  }

  static void _handleNotificationTap(NotificationResponse response) {
    final type = response.payload;

    if (type == null) return;

    // Navigate based on notification type
    switch (type) {
      case 'billing':
        // Navigate to billing screen
        // router.push('/billing');
        break;
      case 'payout':
        // Navigate to payouts
        // router.push('/payouts');
        break;
      case 'status':
        // Navigate to dashboard
        // router.push('/dashboard');
        break;
      default:
        // Navigate to notifications
        // router.push('/notifications');
    }
  }

  static Future<void> clearBadge() async {
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.cancelAll();

    // Clear iOS badge
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      badge: false,
    );
  }
}
```

---

## 6) Flutter Screens

### 6.1 Dashboard Screen

**File**: `mobile/lib/screens/dashboard_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import '../providers/dashboard_provider.dart';
import 'package:go_router/go_router.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await ApiService.get('/api/mobile/overview');
      setState(() {
        _data = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text('Error: $_error'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadData,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final user = _data?['user'] ?? {};
    final systemStatus = _data?['systemStatus'] ?? {};
    final agents = (_data?['agents'] ?? []) as List;
    final usage = _data?['usage'] ?? {};
    final notifications = (_data?['notifications'] ?? []) as List;

    return Scaffold(
      appBar: AppBar(
        title: const Text('F0 Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // User Info Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      child: Text(
                        (user['displayName'] ?? 'U')[0].toUpperCase(),
                        style: const TextStyle(fontSize: 24),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user['displayName'] ?? 'User',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          Text(
                            user['email'] ?? '',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 4),
                          Chip(
                            label: Text(
                              (user['plan'] ?? 'free').toUpperCase(),
                              style: const TextStyle(fontSize: 12),
                            ),
                            padding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // System Status
            Card(
              child: ListTile(
                leading: Icon(
                  systemStatus['overall'] == 'operational'
                      ? Icons.check_circle
                      : Icons.warning,
                  color: systemStatus['overall'] == 'operational'
                      ? Colors.green
                      : Colors.orange,
                ),
                title: const Text('System Status'),
                subtitle: Text(
                  systemStatus['overall'] ?? 'Unknown',
                  style: TextStyle(
                    color: systemStatus['overall'] == 'operational'
                        ? Colors.green
                        : Colors.orange,
                  ),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // Navigate to detailed status
                },
              ),
            ),

            const SizedBox(height: 16),

            // Usage Summary
            Text('Usage Summary', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _UsageCard(
                    title: 'Requests',
                    value: usage['requests']?.toString() ?? '0',
                    icon: Icons.api,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _UsageCard(
                    title: 'Tokens',
                    value: _formatNumber(usage['tokensUsed'] ?? 0),
                    icon: Icons.token,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _UsageCard(
                    title: 'Cost',
                    value: '\$${(usage['cost'] ?? 0).toStringAsFixed(2)}',
                    icon: Icons.attach_money,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _UsageCard(
                    title: 'Quota',
                    value: '${usage['quotaUsed']?.toString() ?? '0'}%',
                    icon: Icons.pie_chart,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Quick Actions
            Text('Quick Actions', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => context.push('/billing'),
                    icon: const Icon(Icons.credit_card),
                    label: const Text('Billing'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => context.push('/notifications'),
                    icon: const Icon(Icons.notifications),
                    label: const Text('Alerts'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Active Agents
            if (agents.isNotEmpty) ...[
              Text('Active Agents', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              ...agents.map((agent) => Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        child: Text(agent['name'][0].toUpperCase()),
                      ),
                      title: Text(agent['name']),
                      subtitle: Text(
                        'Tokens: ${agent['tokensUsed']} • Cost: \$${agent['cost'].toStringAsFixed(2)}',
                      ),
                      trailing: Chip(
                        label: Text(agent['status']),
                        backgroundColor: agent['status'] == 'active'
                            ? Colors.green.shade100
                            : Colors.grey.shade300,
                      ),
                    ),
                  )),
            ],

            const SizedBox(height: 16),

            // Recent Notifications
            if (notifications.isNotEmpty) ...[
              Text(
                'Recent Notifications',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              ...notifications.take(3).map((notif) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.notifications),
                      title: Text(notif['title'] ?? ''),
                      subtitle: Text(notif['message'] ?? ''),
                      trailing: Text(
                        _formatTime(notif['ts']),
                        style: Theme.of(context).textTheme.caption,
                      ),
                    ),
                  )),
              TextButton(
                onPressed: () => context.push('/notifications'),
                child: const Text('View All'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatNumber(int num) {
    if (num >= 1000000) {
      return '${(num / 1000000).toStringAsFixed(1)}M';
    } else if (num >= 1000) {
      return '${(num / 1000).toStringAsFixed(1)}K';
    }
    return num.toString();
  }

  String _formatTime(int? timestamp) {
    if (timestamp == null) return '';
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }
}

class _UsageCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;

  const _UsageCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 8),
                Text(title, style: Theme.of(context).textTheme.caption),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ],
        ),
      ),
    );
  }
}
```

### 6.2 Login Screen

**File**: `mobile/lib/screens/login_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (mounted) {
        context.go('/dashboard');
      }
    } on FirebaseAuthException catch (e) {
      setState(() {
        _errorMessage = e.message ?? 'Login failed';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo
                  const Icon(
                    Icons.rocket_launch,
                    size: 80,
                    color: Colors.blue,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'F0 Mobile',
                    style: Theme.of(context).textTheme.headlineMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to continue',
                    style: Theme.of(context).textTheme.bodyLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // Email field
                  TextFormField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email),
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock),
                      border: OutlineInputBorder(),
                    ),
                    obscureText: true,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Error message
                  if (_errorMessage != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(color: Colors.red.shade900),
                      ),
                    ),

                  // Login button
                  ElevatedButton(
                    onPressed: _isLoading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Sign In'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
```

---

## 7) CI/CD & Deployment

### 7.1 GitHub Actions (Android)

**File**: `.github/workflows/flutter-android.yml`

```yaml
name: Flutter Android Build

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-android:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.22.0'
          channel: 'stable'

      - name: Get dependencies
        run: |
          cd mobile
          flutter pub get

      - name: Run tests
        run: |
          cd mobile
          flutter test

      - name: Build APK
        run: |
          cd mobile
          flutter build apk --release

      - name: Build App Bundle
        run: |
          cd mobile
          flutter build appbundle --release

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-release-apk
          path: mobile/build/app/outputs/flutter-apk/app-release.apk

      - name: Upload App Bundle
        uses: actions/upload-artifact@v4
        with:
          name: app-release-aab
          path: mobile/build/app/outputs/bundle/release/app-release.aab
```

### 7.2 iOS Build Workflow

**File**: `.github/workflows/flutter-ios.yml`

```yaml
name: Flutter iOS Build

on:
  push:
    branches: [main]
    tags:
      - 'v*'

jobs:
  build-ios:
    runs-on: macos-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.22.0'
          channel: 'stable'

      - name: Get dependencies
        run: |
          cd mobile
          flutter pub get

      - name: Build iOS
        run: |
          cd mobile
          flutter build ios --release --no-codesign

      - name: Archive IPA
        run: |
          cd mobile/ios
          xcodebuild -workspace Runner.xcworkspace \
            -scheme Runner \
            -configuration Release \
            -archivePath build/Runner.xcarchive \
            archive

      - name: Export IPA
        run: |
          cd mobile/ios
          xcodebuild -exportArchive \
            -archivePath build/Runner.xcarchive \
            -exportPath build \
            -exportOptionsPlist ExportOptions.plist

      - name: Upload IPA
        uses: actions/upload-artifact@v4
        with:
          name: app-release-ipa
          path: mobile/ios/build/*.ipa
```

### 7.3 Fastlane Setup (Optional)

**File**: `mobile/android/fastlane/Fastfile`

```ruby
default_platform(:android)

platform :android do
  desc "Deploy to Play Store Internal Testing"
  lane :internal do
    gradle(
      task: "bundle",
      build_type: "Release"
    )

    upload_to_play_store(
      track: 'internal',
      aab: '../build/app/outputs/bundle/release/app-release.aab',
      skip_upload_metadata: true,
      skip_upload_images: true,
      skip_upload_screenshots: true
    )
  end

  desc "Deploy to Play Store Beta"
  lane :beta do
    gradle(
      task: "bundle",
      build_type: "Release"
    )

    upload_to_play_store(
      track: 'beta',
      aab: '../build/app/outputs/bundle/release/app-release.aab'
    )
  end
end
```

---

## 8) Testing & Smoke Tests

### 8.1 Server API Tests

**File**: `scripts/test-mobile-apis.sh`

```bash
#!/bin/bash

# Sprint 25 Mobile API Smoke Tests

set -e

BASE_URL=${BASE_URL:-https://f0.ai}
TOKEN=${FIREBASE_TOKEN:-}

echo "🧪 Testing Mobile APIs"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Overview API
echo "Test 1: Overview API"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/mobile/overview" | jq -e '.user.uid' > /dev/null \
  && echo "✅ Overview API working" || echo "❌ Overview API failed"

echo ""

# Test 2: Billing API
echo "Test 2: Billing API"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/mobile/billing" | jq -e '.plan' > /dev/null \
  && echo "✅ Billing API working" || echo "❌ Billing API failed"

echo ""

# Test 3: Notifications API
echo "Test 3: Notifications API"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/mobile/notifications" | jq -e '.notifications' > /dev/null \
  && echo "✅ Notifications API working" || echo "❌ Notifications API failed"

echo ""

# Test 4: Quick Actions API
echo "Test 4: Quick Actions API"
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"update_payment","params":{}}' \
  "$BASE_URL/api/mobile/actions" | jq -e '.portalUrl' > /dev/null \
  && echo "✅ Quick Actions API working" || echo "❌ Quick Actions API failed"

echo ""
echo "🎉 Mobile API tests complete!"
```

### 8.2 Flutter Widget Tests

**File**: `mobile/test/widget_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:f0_mobile/screens/dashboard_screen.dart';

void main() {
  testWidgets('Dashboard screen loads', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: DashboardScreen(),
    ));

    expect(find.text('F0 Dashboard'), findsOneWidget);
  });

  testWidgets('Login form validates input', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: LoginScreen(),
    ));

    // Find and tap sign in button without entering credentials
    final signInButton = find.text('Sign In');
    await tester.tap(signInButton);
    await tester.pump();

    // Expect validation errors
    expect(find.text('Please enter your email'), findsOneWidget);
    expect(find.text('Please enter your password'), findsOneWidget);
  });
}
```

### 8.3 Integration Test

**File**: `mobile/integration_test/app_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:f0_mobile/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Full app flow', (WidgetTester tester) async {
    app.main();
    await tester.pumpAndSettle();

    // Should start at login
    expect(find.text('Sign in to continue'), findsOneWidget);

    // Enter credentials
    await tester.enterText(find.byType(TextField).first, 'test@example.com');
    await tester.enterText(find.byType(TextField).last, 'password123');

    // Tap sign in
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();

    // Should navigate to dashboard
    expect(find.text('F0 Dashboard'), findsOneWidget);
  });
}
```

---

## 9) Deployment Checklist

```markdown
## Sprint 25 Mobile Deployment Checklist

### Server-Side
- [ ] Deploy mobile APIs (`/api/mobile/*`)
- [ ] Deploy push notification functions
- [ ] Update Firestore rules for mobile devices
- [ ] Configure FCM server key

### Flutter App
- [ ] Update Firebase configuration files
- [ ] Set API base URL in `.env`
- [ ] Configure deep links (Android/iOS)
- [ ] Setup code signing (iOS/Android)
- [ ] Test on physical devices

### Push Notifications
- [ ] FCM project configured
- [ ] Android notification channels created
- [ ] iOS push certificates uploaded
- [ ] Test foreground/background/terminated states

### CI/CD
- [ ] GitHub Actions workflows configured
- [ ] Fastlane setup (optional)
- [ ] Automated testing enabled
- [ ] Release signing configured

### Testing
- [ ] API smoke tests passing
- [ ] Widget tests passing
- [ ] Integration tests passing
- [ ] Manual QA on iOS
- [ ] Manual QA on Android

### Store Submission
- [ ] App Store Connect setup
- [ ] Google Play Console setup
- [ ] Screenshots prepared
- [ ] App descriptions written
- [ ] Privacy policy updated
```

---

## 10) Success Metrics (Week 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **App Install Rate** | ≥30% of active users | `app_installs / total_active_users` |
| **Push Notification Open Rate** | ≥20% | `notifications_opened / notifications_sent` |
| **Daily Active Users (Mobile)** | ≥10% of total | `mobile_dau / total_dau` |
| **Session Length** | ≥2 minutes | Average session duration |
| **Crash-Free Rate** | ≥99.5% | `crash_free_sessions / total_sessions` |
| **API Response Time** | ≤500ms p95 | Mobile API latency |

---

## Complete File Structure

```
from-zero-starter/
├── src/app/api/mobile/
│   ├── overview/route.ts          ✅ Dashboard data
│   ├── billing/route.ts           ✅ Billing & invoices
│   ├── notifications/route.ts     ✅ Notifications CRUD
│   └── actions/route.ts           ✅ Quick actions
├── functions/src/mobile/
│   └── push.ts                    ✅ FCM push functions
├── mobile/
│   ├── lib/
│   │   ├── main.dart              ✅ Entry point
│   │   ├── app.dart               ✅ App widget
│   │   ├── router.dart            ✅ GoRouter config
│   │   ├── services/
│   │   │   ├── api_service.dart   ✅ HTTP client
│   │   │   └── notifications_service.dart ✅ FCM
│   │   └── screens/
│   │       ├── splash_screen.dart
│   │       ├── login_screen.dart  ✅ Auth
│   │       ├── dashboard_screen.dart ✅ Main screen
│   │       ├── billing_screen.dart
│   │       └── notifications_screen.dart
│   ├── test/                      ✅ Unit tests
│   ├── integration_test/          ✅ E2E tests
│   └── pubspec.yaml               ✅ Dependencies
├── .github/workflows/
│   ├── flutter-android.yml        ✅ Android CI
│   └── flutter-ios.yml            ✅ iOS CI
└── scripts/
    └── test-mobile-apis.sh        ✅ API tests
```

---

🎉 **Sprint 25 Complete!** Mobile companion app is ready with real-time dashboard, push notifications, billing management, and full CI/CD pipeline.

Deploy commands:
```bash
# Server APIs
firebase deploy --only functions:sendMobilePush,functions:onBillingEvent,functions:onPayoutEvent

# Flutter (Android)
cd mobile && flutter build appbundle --release

# Flutter (iOS)
cd mobile && flutter build ios --release

# Run smoke tests
./scripts/test-mobile-apis.sh
```
