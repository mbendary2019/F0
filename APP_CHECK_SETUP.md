# 🛡️ Firebase App Check Setup Guide

**F0 Phase 36 - App Check Enforcement**

Firebase App Check protects your backend resources from abuse by ensuring requests come from your authentic app.

---

## 📋 Overview

**App Check Providers:**
- **Web:** reCAPTCHA Enterprise (prod) or Debug tokens (dev)
- **iOS:** DeviceCheck (Apple)
- **Android:** Play Integrity API (Google)
- **Electron:** Debug tokens (dev) or Custom provider (prod)

**Enforcement Level:**
- `enforceAppCheck: true` - Reject unauthenticated requests
- `enforceAppCheck: false` - Log but allow (monitoring mode)

---

## 1️⃣ Enable App Check in Firebase Console

```bash
# 1. Go to Firebase Console
https://console.firebase.google.com/project/from-zero-84253/appcheck

# 2. Click "Get Started"

# 3. Register apps:
#    - Web app
#    - iOS app (if exists)
#    - Android app (if exists)
```

---

## 2️⃣ Web Setup (Next.js)

### 2.1 Install Dependencies

```bash
npm install firebase @firebase/app-check
```

### 2.2 Production: reCAPTCHA Enterprise

```bash
# 1. Enable reCAPTCHA Enterprise API
https://console.cloud.google.com/apis/library/recaptchaenterprise.googleapis.com

# 2. Create a site key
https://console.cloud.google.com/security/recaptcha
# - Choose "reCAPTCHA v3"
# - Add your domain (e.g., yourapp.web.app)

# 3. Register site key in Firebase App Check
# Firebase Console → App Check → Web app → reCAPTCHA Enterprise
# Paste site key

# 4. Add to .env.local
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=YOUR_SITE_KEY_HERE
```

### 2.3 Development: Debug Tokens

```bash
# 1. Firebase Console → App Check → Web app → Debug tokens
# 2. Click "Add debug token"
# 3. Copy token

# 4. Add to .env.local
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=YOUR_DEBUG_TOKEN_HERE
```

### 2.4 Initialize App Check (Web)

**`src/lib/appCheck.ts`:**

```typescript
import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider } from 'firebase/app-check';
import { app } from '@/lib/firebase';

const isProduction = process.env.NODE_ENV === 'production';
const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export function initAppCheck() {
  if (typeof window === 'undefined') return;

  try {
    if (isProduction && siteKey) {
      // Production: reCAPTCHA Enterprise
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ App Check initialized (reCAPTCHA)');
    } else if (debugToken) {
      // Development: Debug token
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: () => Promise.resolve({ token: debugToken, expireTimeMillis: Date.now() + 3600000 }),
        }),
        isTokenAutoRefreshEnabled: false,
      });
      console.log('✅ App Check initialized (Debug)');
    } else {
      console.warn('⚠️  App Check not initialized - no provider configured');
    }
  } catch (error) {
    console.error('Failed to initialize App Check:', error);
  }
}
```

**Call in `src/app/layout.tsx`:**

```typescript
'use client';
import { useEffect } from 'react';
import { initAppCheck } from '@/lib/appCheck';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAppCheck();
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## 3️⃣ iOS Setup (Flutter)

### 3.1 Enable DeviceCheck

**`ios/Runner/Info.plist`:**

```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>remote-notification</string>
</array>
```

### 3.2 Initialize App Check

**`lib/main.dart`:**

```dart
import 'package:firebase_app_check/firebase_app_check.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Enable App Check
  await FirebaseAppCheck.instance.activate(
    androidProvider: AndroidProvider.playIntegrity,
    appleProvider: AppleProvider.deviceCheck,
  );

  runApp(MyApp());
}
```

---

## 4️⃣ Android Setup (Flutter)

### 4.1 Enable Play Integrity API

```bash
# 1. Google Play Console → Your app → Release → App Integrity
# 2. Link to Firebase project
# 3. Copy Play Integrity API token
```

### 4.2 Initialize App Check

Already done in step 3.2 above (`androidProvider: AndroidProvider.playIntegrity`).

---

## 5️⃣ Electron Setup

### 5.1 Development: Debug Tokens

**`apps/desktop/src/main.ts`:**

```typescript
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';

const debugToken = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN;

const app = initializeApp(firebaseConfig);

if (debugToken) {
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: () => Promise.resolve({ token: debugToken, expireTimeMillis: Date.now() + 3600000 }),
    }),
    isTokenAutoRefreshEnabled: false,
  });
}
```

### 5.2 Production: Custom Provider

For production, implement a custom App Check provider that:
1. Generates a token on the Electron main process
2. Sends it to your backend for verification
3. Backend verifies device signature/hardware ID
4. Returns an App Check token

---

## 6️⃣ Cloud Functions Enforcement

### 6.1 Enable on Callable Functions

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const heartbeat = onCall(
  { enforceAppCheck: true }, // ← Enable here
  async (request) => {
    if (!request.app) {
      throw new HttpsError('failed-precondition', 'App Check verification failed');
    }

    // ... existing logic
  }
);
```

### 6.2 Enable on HTTP Functions

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { getAppCheck } from 'firebase-admin/app-check';

export const apiEndpoint = onRequest(async (req, res) => {
  try {
    const appCheckToken = req.headers['x-firebase-appcheck'] as string;

    if (!appCheckToken) {
      res.status(401).json({ error: 'App Check token missing' });
      return;
    }

    // Verify token
    const appCheck = getAppCheck();
    await appCheck.verifyToken(appCheckToken);

    // ... existing logic
  } catch (error) {
    res.status(401).json({ error: 'App Check verification failed' });
  }
});
```

---

## 7️⃣ Testing App Check

### 7.1 Test Debug Tokens

```bash
# 1. Add debug token to .env.local
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=your-debug-token

# 2. Start dev server
npm run dev

# 3. Open browser console
# Should see: "✅ App Check initialized (Debug)"

# 4. Call a protected function
const result = await httpsCallable(functions, 'heartbeat')({ deviceId: 'test' });
console.log(result);

# 5. Check logs for App Check verification
```

### 7.2 Test Production (reCAPTCHA)

```bash
# 1. Build production bundle
npm run build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting

# 3. Open production URL
# reCAPTCHA badge should appear in bottom-right

# 4. Call protected functions
# Should work without errors

# 5. Check Firebase Console → App Check → Metrics
# Verify requests are passing
```

---

## 8️⃣ Monitoring & Metrics

### 8.1 Firebase Console

```bash
# Go to: Firebase Console → App Check → Metrics
# View:
# - Requests verified
# - Requests rejected
# - Token refresh rate
# - Provider distribution
```

### 8.2 Cloud Functions Logs

```bash
firebase functions:log --project from-zero-84253

# Look for:
# - "App Check verification successful"
# - "App Check verification failed"
```

---

## 9️⃣ Troubleshooting

### Issue: "App Check verification failed"

**Solution:**
1. Check debug token is correct
2. Verify token is not expired
3. Ensure App Check is initialized before calling functions
4. Check Firebase Console → App Check → Web app is registered

### Issue: reCAPTCHA not loading

**Solution:**
1. Check site key is correct in `.env.local`
2. Verify domain is whitelisted in reCAPTCHA settings
3. Check for CSP errors (Content Security Policy)
4. Ensure `https://www.google.com` is allowed in CSP

### Issue: iOS DeviceCheck not working

**Solution:**
1. Verify App ID is correct in Firebase
2. Check `Info.plist` has required keys
3. Ensure running on physical device (not simulator)
4. Check Apple Developer account is active

### Issue: Android Play Integrity errors

**Solution:**
1. Verify app is published (at least internal testing)
2. Check SHA-256 fingerprint matches Firebase
3. Ensure Play Integrity API is enabled
4. Wait 24 hours after first setup (propagation time)

---

## 🔟 Rollout Strategy

### Phase 1: Monitoring (Week 1-2)

```typescript
// Enforce: false (log only)
export const heartbeat = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.app) {
      console.warn('App Check missing - would reject in enforcement mode');
    }
    // ... logic
  }
);
```

### Phase 2: Enforcement (Week 3+)

```typescript
// Enforce: true (reject invalid)
export const heartbeat = onCall(
  { enforceAppCheck: true },
  async (request) => {
    // Will automatically reject if App Check fails
    // ... logic
  }
);
```

### Phase 3: Full Enforcement (Week 4+)

- Enable on all callable functions
- Enable on all HTTP functions
- Enable on Firestore/Storage (optional)

---

## ✅ Activation Checklist

- [ ] App Check enabled in Firebase Console
- [ ] Web: reCAPTCHA Enterprise configured (prod) + Debug tokens (dev)
- [ ] iOS: DeviceCheck enabled
- [ ] Android: Play Integrity linked
- [ ] Electron: Debug tokens configured
- [ ] Cloud Functions: `enforceAppCheck: true` on critical functions
- [ ] Monitoring: Firebase Console metrics reviewed
- [ ] Testing: All platforms verified
- [ ] Documentation: Team trained on troubleshooting

---

**Version:** 1.0.0  
**Last Updated:** October 11, 2025  
**Status:** Ready for Production


