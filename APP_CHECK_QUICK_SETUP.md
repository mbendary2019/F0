# 🛡️ App Check Quick Setup - This Week!

**Time Required:** 30 minutes  
**Priority:** High (Security)  
**Status:** Ready to implement

---

## 🎯 What is App Check?

App Check helps protect your app from:
- 🚫 Abuse (bots, scrapers)
- 🚫 API key theft
- 🚫 Unauthorized access
- 🚫 DDoS attacks

**How it works:**
1. Client requests App Check token
2. Provider (reCAPTCHA/DeviceCheck) verifies legitimacy
3. Token attached to Firebase requests
4. Cloud Functions validate token

---

## 🚀 Quick Setup (30 min)

### Step 1: Enable in Firebase Console (5 min)

1. **Open Firebase Console:**
   ```
   https://console.firebase.google.com/project/from-zero-84253/appcheck
   ```

2. **Click "Get Started"**

3. **Register Web App:**
   - Select your web app
   - Provider: **reCAPTCHA Enterprise** (recommended)
   - Or: reCAPTCHA v3 (simpler, free)

4. **Get Site Key:**
   - Copy the site key
   - Save for Step 2

5. **Click "Save"**

---

### Step 2: Add to Web App (10 min)

**A) Install Package:**
```bash
npm install firebase/app-check
```

**B) Update `src/lib/firebase.ts`:**
```typescript
import { getApps, initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseApp: FirebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dev',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dev',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dev',
    });

// Initialize App Check (only in browser)
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const app = firebaseApp;
```

**C) Add to `.env.local`:**
```bash
echo "NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY=YOUR_SITE_KEY_HERE" >> .env.local
```

**D) Restart Next.js:**
```bash
npm run dev
```

---

### Step 3: Configure Cloud Functions (10 min)

**A) Update Function Exports:**

```typescript
// functions/src/index.ts
import { onCall } from 'firebase-functions/v2/https';

// Example: Protect heartbeat function
export const heartbeat = onCall({
  enforceAppCheck: true, // Require valid App Check token
  consumeAppCheckToken: true, // Prevent token replay
}, async (request) => {
  const { deviceId, appVersion, capabilities } = request.data;
  
  // Your existing logic here...
  
  return { ok: true, ts: Date.now() };
});

// Apply to all sensitive functions:
export const registerToken = onCall({ enforceAppCheck: true }, async (request) => { ... });
export const processQueues = onCall({ enforceAppCheck: true }, async (request) => { ... });
export const createHandoff = onCall({ enforceAppCheck: true }, async (request) => { ... });
```

**B) Deploy Functions:**
```bash
cd functions
npm run build
firebase deploy --only functions --project from-zero-84253
```

---

### Step 4: Test & Monitor (5 min)

**A) Start with Monitoring Mode (Don't enforce yet!):**

In Firebase Console:
```
App Check → Settings → Enforcement → Monitoring
```

This allows you to:
- ✅ See which requests have valid tokens
- ✅ See which requests are missing tokens
- ✅ Monitor rejection rate
- ⚠️ Don't block users yet

**B) Add Debug Tokens (For testing):**

1. Open browser console
2. Run:
   ```javascript
   firebase.appCheck().getToken(true).then(console.log)
   ```
3. Copy debug token
4. Add to Firebase Console:
   ```
   App Check → Settings → Debug tokens → Add token
   ```

**C) Monitor for 1 Week:**
```
App Check → Usage
```

Watch for:
- Token success rate (should be >95%)
- Failed requests (investigate patterns)
- False positives (legitimate users blocked)

---

## 📊 Week 1: Monitoring Checklist

### Day 1 (Setup)
- [ ] App Check enabled in Firebase Console
- [ ] Site key added to `.env.local`
- [ ] App Check initialized in web app
- [ ] Functions updated with `enforceAppCheck: false` (monitoring only)
- [ ] Debug tokens added for testing
- [ ] Monitoring dashboard checked

### Day 3 (Mid-week Check)
- [ ] Token success rate checked (target: >95%)
- [ ] Failed requests reviewed
- [ ] No false positives reported
- [ ] Debug tokens working

### Day 7 (Week End Review)
- [ ] Token success rate >95%
- [ ] No major issues reported
- [ ] Ready to enable enforcement
- [ ] Plan enforcement rollout

---

## 🚦 Week 2: Enable Enforcement

### Gradual Rollout Strategy

**Phase 1: Enable for 10% of traffic**
```typescript
// In Firebase Console or via code
const enforceForPercentage = 10; // 10%

export const heartbeat = onCall({
  enforceAppCheck: Math.random() < (enforceForPercentage / 100),
}, async (request) => { ... });
```

**Phase 2: Enable for 50% of traffic** (after 2 days)
**Phase 3: Enable for 100% of traffic** (after 4 days)

---

## 🔧 Troubleshooting

### Issue: "App Check token is invalid"

**Cause:** Token expired or site key mismatch

**Solution:**
```bash
# 1. Verify site key in .env.local
grep APP_CHECK .env.local

# 2. Verify in Firebase Console
# App Check → Settings → Web app → Site key

# 3. Restart app
npm run dev

# 4. Clear browser cache
# DevTools → Application → Clear storage
```

---

### Issue: High rejection rate (>5%)

**Cause:** Legitimate users being blocked

**Solution:**
```typescript
// Temporarily disable enforcement
export const heartbeat = onCall({
  enforceAppCheck: false, // Disable temporarily
}, async (request) => { ... });

// Monitor for 24 hours
// Check Firebase Console for patterns
// Adjust reCAPTCHA settings if needed
```

---

### Issue: Development environment fails

**Cause:** No valid App Check token in dev

**Solution:**
```typescript
// Add debug token support
if (typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'development') {
    // Use debug token in development
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
```

Then add debug token to Firebase Console.

---

## ✅ Success Criteria

**Ready for Enforcement When:**
- ✅ Token success rate >95%
- ✅ No false positives in 7 days
- ✅ All critical functions protected
- ✅ Debug tokens working
- ✅ Monitoring dashboard healthy
- ✅ Team trained on troubleshooting

---

## 📚 Additional Resources

**Firebase Docs:**
- [App Check Overview](https://firebase.google.com/docs/app-check)
- [reCAPTCHA Enterprise Setup](https://cloud.google.com/recaptcha-enterprise/docs/quickstart)
- [Debug Tokens](https://firebase.google.com/docs/app-check/web/debug-provider)

**Best Practices:**
- Start with monitoring mode
- Use gradual rollout
- Monitor rejection rates
- Add debug tokens for testing
- Plan for false positives

---

## 🎯 Quick Commands

```bash
# Install App Check
npm install firebase/app-check

# Add site key
echo "NEXT_PUBLIC_FIREBASE_APP_CHECK_KEY=YOUR_KEY" >> .env.local

# Deploy functions with App Check
cd functions && npm run build
firebase deploy --only functions --project from-zero-84253

# Check status
open https://console.firebase.google.com/project/from-zero-84253/appcheck

# Monitor usage
# Firebase Console → App Check → Usage
```

---

## 🎊 Summary

**What App Check Protects:**
- ✅ Cloud Functions from unauthorized access
- ✅ Firestore from bot abuse
- ✅ Firebase Auth from credential stuffing
- ✅ Storage from unauthorized downloads

**Timeline:**
- **Week 1:** Monitoring mode, collect data
- **Week 2:** Enable enforcement (gradual rollout)
- **Week 3:** Full enforcement, monitor closely
- **Week 4:** Standard monitoring

**Impact:**
- 🔒 Security: **High** (blocks 90%+ of bot traffic)
- 📊 Performance: **Low** (<50ms overhead)
- 👥 User Experience: **None** (invisible to users)

---

**Next Step:** Enable App Check in Firebase Console **this week!**

**Version:** 1.0.0  
**Date:** October 11, 2025  
**Status:** ✅ Ready to implement

🛡️ **Protect your app from abuse - Enable App Check today!** 🛡️


