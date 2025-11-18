# 📱 Sprint 25 — Mobile Companion

**Version:** v26.0.0
**Goal:** Launch iOS/Android lightweight app to monitor agents, billing, and send notifications.

---

## 📦 New Files & Components

### Mobile App (Flutter/React Native)

| File | Purpose |
|------|---------|
| `mobile/lib/firebase_config.dart` | Firebase Mobile SDK setup |
| `mobile/lib/main.dart` | App entry point and navigation |
| `mobile/screens/Dashboard.dart` | Active agents and status overview |
| `mobile/screens/Billing.dart` | Subscription plan and invoices |
| `mobile/screens/Notifications.dart` | Push notifications and alerts |
| `mobile/screens/Settings.dart` | Language, theme, logout |
| `mobile/widgets/AgentCard.dart` | Agent status widget |
| `mobile/widgets/UsageChart.dart` | Usage metrics visualization |

### Backend APIs

| File | Purpose |
|------|---------|
| `src/app/api/mobile/push/route.ts` | Send Firebase Cloud Messaging (FCM) notifications |
| `src/app/api/mobile/agents/route.ts` | Get user's active agents with status |
| `src/app/api/mobile/usage/route.ts` | Get usage summary (calls, tokens, cost) |

### Documentation

| File | Purpose |
|------|---------|
| `MOBILE_SETUP.md` | Build and distribution guide |
| `PUSH_NOTIFICATIONS.md` | FCM setup and notification types |

---

## ⚙️ Features

### ✅ Push Notifications (Firebase Cloud Messaging)

**Notification Types:**

1. **Subscription Updates**
   - Payment succeeded
   - Payment failed
   - Subscription canceled
   - Trial ending soon

2. **Agent Activity**
   - Agent task completed
   - Agent error occurred
   - Agent usage warning (approaching limit)

3. **Billing Alerts**
   - Invoice ready
   - Payment method expiring
   - Credit added (referral)

4. **System Notifications**
   - Service degradation
   - Scheduled maintenance
   - New features available

**FCM Integration:**

```dart
// mobile/lib/firebase_config.dart
import 'package:firebase_messaging/firebase_messaging.dart';

class PushNotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  Future<void> initialize() async {
    // Request permission (iOS)
    await _fcm.requestPermission();

    // Get FCM token
    String? token = await _fcm.getToken();
    await saveFcmToken(token);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      showLocalNotification(message);
    });

    // Handle background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  }
}
```

**Server-side Sending:**

```typescript
// src/app/api/mobile/push/route.ts
import admin from 'firebase-admin';

export async function POST(req: Request) {
  const { uid, title, body, data } = await req.json();

  // Get user's FCM token
  const user = await adminDb.collection('users').doc(uid).get();
  const fcmToken = user.data()?.fcmToken;

  if (!fcmToken) {
    return Response.json({ error: 'No FCM token' }, { status: 404 });
  }

  // Send notification
  await admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    data,
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  });

  return Response.json({ success: true });
}
```

---

### ✅ Dashboard (Realtime Sync)

**Dashboard Sections:**

1. **Active Agents**
   - Agent name and status
   - Current task (if running)
   - Uptime
   - Error count (last 24h)

2. **Usage Metrics**
   - Today's calls
   - Tokens used
   - Cost (estimated)
   - Quota percentage

3. **Quick Actions**
   - Start/stop agent
   - View logs
   - Upgrade plan
   - View invoices

**Realtime Sync:**

```dart
// mobile/screens/Dashboard.dart
import 'package:cloud_firestore/cloud_firestore.dart';

class DashboardScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('agents')
          .where('uid', isEqualTo: currentUser.uid)
          .where('status', isEqualTo: 'active')
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return CircularProgressIndicator();
        }

        final agents = snapshot.data!.docs;
        return ListView.builder(
          itemCount: agents.length,
          itemBuilder: (context, index) {
            return AgentCard(agent: agents[index]);
          }
        );
      }
    );
  }
}
```

---

### ✅ Language & Theme Support

**Supported Languages:**
- English (en)
- Arabic (ar)
- French (fr)
- Spanish (es)
- Japanese (ja)

**Theme Modes:**
- Light
- Dark
- System (auto)

**Implementation:**

```dart
// mobile/lib/main.dart
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

class F0App extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ThemeProvider(),
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) {
          return MaterialApp(
            theme: ThemeData.light(),
            darkTheme: ThemeData.dark(),
            themeMode: themeProvider.themeMode,
            localizationsDelegates: [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: [
              Locale('en', ''),
              Locale('ar', ''),
              Locale('fr', ''),
              Locale('es', ''),
              Locale('ja', ''),
            ],
            home: DashboardScreen(),
          );
        }
      )
    );
  }
}
```

---

### ✅ Deep Links to Web

**Deep Link Scenarios:**

1. **Manage Subscription** → Opens web `/billing` in in-app browser
2. **View Invoice** → Opens web `/invoices/{id}` with PDF
3. **Agent Details** → Opens web `/admin/agents/{id}`
4. **Settings** → Opens web `/account/settings`

**Implementation:**

```dart
// mobile/widgets/DeepLink.dart
import 'package:url_launcher/url_launcher.dart';

Future<void> openWebPage(String path) async {
  final url = Uri.parse('https://yourapp.web.app$path');

  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.inAppWebView);
  } else {
    throw 'Could not launch $url';
  }
}

// Usage
ElevatedButton(
  onPressed: () => openWebPage('/billing'),
  child: Text('Manage Subscription')
)
```

---

## 📁 Firestore Structure

### users/{uid}/fcm_tokens/{tokenId}

```javascript
{
  token: string,
  platform: "ios" | "android",
  deviceName: string,
  createdAt: timestamp,
  lastUsed: timestamp
}
```

### mobile_sessions/{sessionId}

```javascript
{
  uid: string,
  platform: "ios" | "android",
  appVersion: string,
  startedAt: timestamp,
  lastActive: timestamp,
  fcmToken: string
}
```

---

## 🧪 Smoke Tests (8 Tests)

### Test 1: Push Notification Delivery

1. Install app on iOS/Android device
2. Complete authentication
3. Grant notification permission
4. Trigger test notification from admin panel
5. Verify notification received
6. Tap notification
7. Verify deep link opens correct screen

**✅ Pass Criteria:**
- Notification delivers within 5 seconds
- Deep link works
- Notification appears in system tray

---

### Test 2: Dashboard Real-time Updates

1. Open mobile app dashboard
2. Start agent task from web
3. Verify dashboard updates immediately (within 2 seconds)
4. Stop agent from mobile app
5. Verify web reflects change

**✅ Pass Criteria:**
- Real-time sync working both ways
- No polling delay
- UI updates smoothly

---

### Test 3: Language Switching

1. Open Settings
2. Change language to Arabic
3. Verify entire app UI switches to RTL Arabic
4. Change to Japanese
5. Verify proper rendering
6. Change back to English

**✅ Pass Criteria:**
- All text translates correctly
- RTL layout works for Arabic
- No UI glitches

---

### Test 4: Theme Toggle

1. Open Settings
2. Select "Dark" theme
3. Verify entire app switches to dark mode
4. Select "System" theme
5. Change system theme
6. Verify app follows system

**✅ Pass Criteria:**
- Theme persists across app restarts
- All screens themed correctly
- System theme detection works

---

### Test 5: Billing View

1. Open Billing screen
2. Verify current plan displayed
3. View invoice history
4. Tap "Manage Subscription"
5. Verify redirects to web `/billing` in in-app browser
6. Complete action (e.g., update payment method)
7. Return to app
8. Verify changes reflected

**✅ Pass Criteria:**
- Plan info accurate
- Invoice list complete
- In-app browser works
- Changes sync back

---

### Test 6: Usage Metrics

1. Open Dashboard
2. Verify today's usage displayed (calls, tokens, cost)
3. View usage chart (last 7 days)
4. Make API call from web
5. Verify mobile app updates within 10 seconds

**✅ Pass Criteria:**
- Metrics accurate
- Chart renders correctly
- Real-time updates working

---

### Test 7: TestFlight / Internal Testing Distribution

1. Upload iOS build to TestFlight
2. Invite 10 beta testers
3. Upload Android build to Google Play Internal Testing
4. Invite 10 beta testers
5. Verify all testers can install
6. Collect crash reports

**✅ Pass Criteria:**
- Builds install successfully
- No critical crashes
- Feedback collected

---

### Test 8: Offline Mode

1. Open app (online)
2. Load dashboard
3. Disconnect internet
4. Verify cached data still visible
5. Try performing action (e.g., stop agent)
6. Verify queued for retry
7. Reconnect internet
8. Verify action executes

**✅ Pass Criteria:**
- Offline mode shows cached data
- Actions queue correctly
- Sync happens on reconnect

---

## ⏱ Timeline (5 Weeks)

### Week 1: Firebase Mobile + FCM Setup

**Tasks:**
- Set up Firebase project for mobile
- Configure FCM for iOS and Android
- Implement push notification handler
- Test notification delivery
- Set up deep links

**Deliverables:**
- FCM working on both platforms
- Push notifications delivering
- Deep links tested

---

### Week 2: Dashboards + Notifications

**Tasks:**
- Build Dashboard screen (agents, usage)
- Build Notifications screen (inbox)
- Implement real-time sync with Firestore
- Create agent status widgets
- Usage charts

**Deliverables:**
- Dashboard functional
- Real-time updates working
- Charts rendering

---

### Week 3: Billing + Settings

**Tasks:**
- Build Billing screen (plan, invoices)
- Build Settings screen (language, theme, logout)
- Implement in-app browser for web actions
- Theme switching (light/dark/system)
- Language switching (5 languages)

**Deliverables:**
- Billing screen complete
- Settings functional
- Multi-language support

---

### Week 4: Testing + Fixes

**Tasks:**
- Internal testing (10 iOS, 10 Android)
- Fix critical bugs
- Performance optimization
- Crash reporting setup (Sentry/Firebase Crashlytics)
- UI polish

**Deliverables:**
- <1% crash rate
- All smoke tests passing
- Bug fixes deployed

---

### Week 5: Beta Launch

**Tasks:**
- Submit to TestFlight (iOS)
- Submit to Google Play Internal Testing (Android)
- Invite 100 beta users
- Monitor crash reports
- Gather feedback
- Documentation

**Deliverables:**
- 100 beta users onboarded
- Feedback collected
- Public release ready

---

## 🎯 Success Metrics

### Week 1 Post-Launch

| Metric | Target |
|--------|--------|
| Mobile installs | ≥ 200 |
| Push notification opt-in rate | ≥ 60% |
| Notification delivery success | ≥ 98% |
| Daily active users (mobile) | ≥ 20% of total DAU |
| Crash rate | < 2% |
| Average session duration | ≥ 5 minutes |

### Month 1 Post-Launch

| Metric | Target |
|--------|--------|
| Mobile adoption | ≥ 30% of users |
| Daily active users (mobile) | ≥ 25% |
| Push notification open rate | ≥ 40% |
| Mobile conversion rate | ≥ 15% (free → paid) |
| Retention (7-day) | ≥ 50% |
| App store rating | ≥ 4.5/5 |

---

## 📐 Technical Architecture

### Push Notification Flow

```
Event triggers (e.g., subscription activated)
  ↓
Cloud Function: txEmail + Push Notification
  ↓
Query: users/{uid}/fcm_tokens
  ↓
For each token:
  Send FCM message
    {
      notification: { title, body },
      data: { type, link },
      priority: "high"
    }
  ↓
FCM delivers to device
  ↓
App receives notification
  ↓
If app in foreground:
  Show in-app notification
  ↓
If app in background:
  Show system notification
  ↓
User taps notification
  ↓
Deep link opens relevant screen
```

### Real-time Dashboard Sync

```
Mobile app opens Dashboard
  ↓
StreamBuilder listens to Firestore:
  collection: agents
  where: uid == currentUser.uid
  where: status == "active"
  ↓
Firestore streams changes
  ↓
UI rebuilds automatically
  ↓
No polling needed
```

---

## 🔐 Security Considerations

### FCM Token Management

- **Rotate tokens:** Refresh every 30 days
- **Revoke on logout:** Delete FCM token from Firestore
- **Platform-specific:** Store iOS and Android tokens separately
- **Rate limiting:** Max 100 push notifications per user per day

### Deep Link Security

- **Validate URLs:** Only allow whitelisted domains
- **Auth required:** Deep links require authenticated session
- **HTTPS only:** Never open http:// links
- **User confirmation:** Show confirmation for sensitive actions

---

## 🧯 Emergency Controls

| Issue | Kill Switch |
|-------|-------------|
| Push notification spam | Reduce notification frequency via feature flag |
| FCM quota exceeded | Disable non-critical notifications |
| App crash wave | Force update to previous version |
| API overload from mobile | Rate limit mobile endpoints |

---

## 📚 Documentation to Create

1. **MOBILE_SETUP.md** - Build instructions, certificates, provisioning
2. **PUSH_NOTIFICATIONS.md** - FCM setup, notification types
3. **DEEP_LINKS.md** - Deep link schema and handling
4. **MOBILE_TROUBLESHOOTING.md** - Common issues and fixes

---

## 🟢 Status Goal

**Target State:**
- ✅ 30% mobile adoption
- ✅ 60%+ push notification opt-in
- ✅ <2% crash rate
- ✅ 4.5+ app store rating
- ✅ 25% daily active (mobile)

**Go-Live Criteria:**
- All 8 smoke tests passing
- Beta tested with 100 users
- <1% critical crash rate
- App store review approved (iOS/Android)
- Push notifications working in production

---

**Sprint Owner:** _____________________
**Start Date:** _____________________
**Target Completion:** 5 weeks
**Dependencies:** Sprint 20-22 (SaaS Platform)

📱 **Sprint 25 - Ready to Execute**
