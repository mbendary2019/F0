# 🚀 Phase 35 Deploy & Test Runbook

**Project:** F0 Platform  
**Phase:** 35 - Cross-Device Sync & Push Sessions  
**Date:** October 11, 2025

---

## 📋 Prerequisites

- [x] Firebase project setup (`from-zero-84253`)
- [x] Firebase CLI installed (`npm i -g firebase-tools`)
- [x] Logged in to Firebase (`firebase login`)
- [x] VAPID keys generated for FCM
- [x] Environment variables configured

---

## 🔧 Step 1: Configure Environment

### 1.1 Generate VAPID Key (if not done)

```bash
# In Firebase Console:
# Project Settings → Cloud Messaging → Web Push certificates → Generate key pair

# Or use Firebase CLI:
firebase messaging:generate-vapid-key
```

### 1.2 Update `.env.local`

```env
# Phase 35 - Cross-Device Sync
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE

# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBhDfrCv_uqu-rs4WNH0Kav2BMK4xD4j4k
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=from-zero-84253.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=from-zero-84253
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=from-zero-84253.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=39741106357
NEXT_PUBLIC_FIREBASE_APP_ID=1:39741106357:web:709d5ce8639e63d21cb6fc
```

---

## 🏗️ Step 2: Build & Deploy Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies (if not done)
npm install

# Build TypeScript
npm run build

# Deploy Phase 35 functions
firebase deploy --only functions:heartbeat,functions:markOffline,functions:cleanupStaleDevices,functions:getPresence,functions:registerToken,functions:unregisterToken,functions:subscribeToTopic,functions:unsubscribeFromTopic,functions:processQueues,functions:enqueueItem,functions:dequeueItem,functions:clearQueue,functions:createHandoff,functions:consumeHandoff,functions:cleanupHandoffs,functions:readyz --project from-zero-84253

# Or deploy all functions
firebase deploy --only functions --project from-zero-84253
```

---

## 🔐 Step 3: Deploy Firestore Rules

```bash
# Copy secure rules to main rules file
cp firestore.rules.phase35.secure firestore.rules

# Deploy rules
firebase deploy --only firestore:rules --project from-zero-84253
```

---

## 📊 Step 4: Deploy Composite Indexes

```bash
# Make sure firestore.indexes.json includes Phase 35 indexes
# (Already in the patch)

# Deploy indexes
firebase deploy --only firestore:indexes --project from-zero-84253

# Or manually create indexes in Firebase Console:
# Firestore → Indexes → Composite → Create Index
```

**Required Indexes:**

1. **sessions** collection:
   - `userId` (Ascending)
   - `status` (Ascending)
   - `startedAt` (Descending)

2. **projects** collection:
   - `owner` (Ascending)
   - `updatedAt` (Descending)

---

## 🌐 Step 5: Deploy Web App

```bash
# Navigate to project root
cd ..

# Build Next.js app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting --project from-zero-84253
```

---

## 🧪 Step 6: Test Deployment

### 6.1 Test Health Check

```bash
# Test readyz endpoint
curl https://us-central1-from-zero-84253.cloudfunctions.net/readyz

# Expected:
# {"ok":true,"ts":1728667200000}
```

### 6.2 Test Heartbeat (via Firebase Emulator UI or Postman)

```json
POST https://us-central1-from-zero-84253.cloudfunctions.net/heartbeat
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_FIREBASE_ID_TOKEN

Body:
{
  "data": {
    "deviceId": "web-test-001",
    "appVersion": "1.0.0",
    "capabilities": {
      "push": true,
      "deeplink": false,
      "clipboard": true,
      "offline": true
    }
  }
}
```

**Expected Response:**
```json
{
  "result": {
    "ok": true
  }
}
```

### 6.3 Verify Firestore Data

```bash
# Open Firebase Console → Firestore
# Check: users/{uid}/devices/{deviceId}

# Expected structure:
{
  "appVersion": "1.0.0",
  "capabilities": {
    "push": true,
    "deeplink": false,
    "clipboard": true,
    "offline": true
  },
  "status": {
    "online": true,
    "lastSeen": Timestamp,
    "heartbeat": 1728667200000
  },
  "updatedAt": Timestamp
}
```

### 6.4 Test FCM Token Registration

```bash
# From browser console after initFcm():
const deviceId = localStorage.getItem('f0_device');
console.log('Device ID:', deviceId);

# Check Firestore: users/{uid}/devices/{deviceId}
# Verify fcmToken field is populated
```

### 6.5 Test Push Notification

```bash
# From Firebase Console → Cloud Messaging → Send test message
# Or via Cloud Function:

POST https://us-central1-from-zero-84253.cloudfunctions.net/sendPush
Headers:
  Content-Type: application/json
Body:
{
  "userId": "YOUR_UID",
  "title": "Test Notification",
  "body": "This is a test from Phase 35!",
  "data": {
    "kind": "test",
    "timestamp": "1728667200000"
  }
}
```

### 6.6 Test Device Handoff

```javascript
// From browser console (Device A):
const createHandoff = httpsCallable(functions, 'createHandoff');
const result = await createHandoff({
  fromDevice: 'desktop-1',
  toDevice: 'mobile-1',
  payload: {
    type: 'open-project',
    projectId: 'proj_123'
  }
});

console.log('Handoff created:', result);
// Expected: { ok: true, id: 'handoff_id', deepLink: 'f0://open?project=proj_123' }

// From Device B:
const consumeHandoff = httpsCallable(functions, 'consumeHandoff');
const consumed = await consumeHandoff({
  handoffId: result.data.id,
  deviceId: 'mobile-1'
});

console.log('Handoff consumed:', consumed);
// Expected: { ok: true, payload: { type: 'open-project', projectId: 'proj_123' } }
```

---

## 🔍 Step 7: Monitor & Debug

### 7.1 View Function Logs

```bash
# View all logs
firebase functions:log --project from-zero-84253

# View specific function logs
firebase functions:log --only heartbeat --project from-zero-84253

# Stream logs in real-time
firebase functions:log --project from-zero-84253 --follow
```

### 7.2 Check Scheduled Functions

```bash
# Verify scheduled functions are running:
# - cleanupStaleDevices (every 60 minutes)
# - processQueues (every 1 minute)
# - cleanupHandoffs (every 15 minutes)

# Check in Firebase Console → Functions → Logs
# Look for scheduled execution logs
```

### 7.3 Monitor Firestore Usage

```bash
# Firebase Console → Firestore → Usage
# Check:
# - Document reads/writes
# - Storage usage
# - Index queries
```

---

## ⚠️ Troubleshooting

### Issue: Heartbeat not updating Firestore

**Solution:**
1. Check Firebase ID token is valid
2. Verify device ID format
3. Check Firestore rules allow writes
4. View function logs for errors

### Issue: FCM token not registered

**Solution:**
1. Verify VAPID key is correct
2. Check notification permission is granted
3. Ensure FCM is enabled in Firebase Console
4. Check service worker is registered

### Issue: Push notifications not received

**Solution:**
1. Verify FCM token in Firestore
2. Check browser/device allows notifications
3. Ensure service worker is active
4. Test with Firebase Console test message

### Issue: Handoff not working

**Solution:**
1. Verify both devices exist in Firestore
2. Check handoff hasn't expired (5 min)
3. Ensure deep link format is correct
4. Verify toDevice is correct device ID

---

## 📊 Step 8: Performance Monitoring

### 8.1 Enable Performance Monitoring

```bash
# Firebase Console → Performance → Enable
# Add SDK to web app (already included)
```

### 8.2 Key Metrics to Monitor

- **Heartbeat Response Time**: < 500ms
- **FCM Token Registration**: < 1s
- **Push Delivery**: < 1s
- **Handoff Creation**: < 500ms
- **Queue Processing**: < 2s per batch

---

## ✅ Definition of Done

- [ ] All Cloud Functions deployed successfully
- [ ] Firestore rules deployed and tested
- [ ] Composite indexes created
- [ ] Heartbeat working (device status updating)
- [ ] FCM tokens registered
- [ ] Push notifications delivered
- [ ] Device handoff tested end-to-end
- [ ] Offline queue processing verified
- [ ] Scheduled functions running
- [ ] No errors in function logs
- [ ] Performance metrics within targets

---

## 🚀 Next Steps

1. **Electron Integration**: Add IPC handlers for desktop
2. **Flutter Integration**: Add FCM service and presence service
3. **Deep Links**: Configure iOS/Android deep link handling
4. **Load Testing**: Simulate 100+ concurrent devices
5. **Documentation**: Complete user-facing docs

---

## 📚 References

- **Firebase Cloud Messaging**: https://firebase.google.com/docs/cloud-messaging
- **Firebase Functions**: https://firebase.google.com/docs/functions
- **Firestore Security Rules**: https://firebase.google.com/docs/firestore/security/get-started
- **Phase 35 Implementation**: `PHASE_35_COMPLETE.md`

---

**Version:** 1.0.0  
**Status:** ✅ Ready for Production  
**Last Updated:** October 11, 2025


