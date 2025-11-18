# Quick Start Guide - Phase 49 Stabilization

**Time to Complete:** 15-20 minutes
**Prerequisites:** Node.js, Firebase CLI installed

---

## 🚀 Quick Setup (5 Commands)

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Copy environment template
cp .env.local.example .env.local
# Edit .env.local with your Firebase project credentials

# 3. Start Firebase emulators
firebase emulators:start --only firestore,auth,functions,storage,ui

# 4. In a new terminal, verify emulators
chmod +x scripts/verify-emulators.sh
./scripts/verify-emulators.sh

# 5. Start development server
npm run dev
```

---

## 📋 Step-by-Step Guide

### Step 1: Environment Configuration (2 min)

```bash
# Copy the template
cp .env.local.example .env.local
```

**Edit .env.local** and update these key values:
```env
# Your Firebase Project
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Enable emulators for local development
NEXT_PUBLIC_USE_EMULATORS=1

# (Optional) Add Sentry DSN for error tracking
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### Step 2: Install Dependencies (3 min)

```bash
# Root dependencies
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

### Step 3: Start Firebase Emulators (1 min)

```bash
# Start all required emulators
firebase emulators:start --only firestore,auth,functions,storage,ui
```

**Expected Output:**
```
✔ functions: Emulator started at http://127.0.0.1:5001
✔ firestore: Emulator started at http://127.0.0.1:8080
✔ auth: Emulator started at http://127.0.0.1:9099
✔ storage: Emulator started at http://127.0.0.1:9199
✔ ui: Emulator UI running at http://127.0.0.1:4000
```

### Step 4: Verify Emulators (1 min)

**In a new terminal:**
```bash
chmod +x scripts/verify-emulators.sh
./scripts/verify-emulators.sh
```

**Expected Output:**
```
🔍 Verifying Firebase Emulators...

Checking Firebase Emulator ports...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Emulator UI is running on port 4000
✅ Auth Emulator is running on port 9099
✅ Firestore Emulator is running on port 8080
✅ Functions Emulator is running on port 5001

✨ Emulator verification complete!
```

### Step 5: Start Development Server (1 min)

```bash
npm run dev
```

**Access Points:**
- **App:** http://localhost:3000
- **Emulator UI:** http://127.0.0.1:4000
- **Functions:** http://127.0.0.1:5001

---

## 🧪 Testing Phase 49 Features

### 1. Test Incident Tracking

**Create a test incident in Firestore:**

Visit Emulator UI → Firestore → Add Document

```json
Collection: ops_incidents
Document ID: (auto)

Data:
{
  "source": "manual",
  "level": "error",
  "message": "Test incident for CSV export",
  "stack": "Error: Test error\n  at testFunction",
  "context": {
    "test": true,
    "timestamp": "2025-11-05T10:00:00Z"
  },
  "status": "open",
  "createdAt": "2025-11-05T10:00:00Z",
  "updatedAt": "2025-11-05T10:00:00Z"
}
```

### 2. Test CSV Export

```bash
# Export all incidents
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?limit=10" -o incidents.csv

# Open the CSV file
open incidents.csv  # macOS
# or
cat incidents.csv   # Linux/Unix
```

### 3. Test Metrics Aggregation

**Create test events:**

```bash
# Visit Emulator UI → Firestore → Add Document
Collection: ops_events
Document ID: (auto)

Data:
{
  "type": "api",
  "ts": "2025-11-05T10:00:00Z",
  "uid": "test-user-123",
  "orgId": "test-org-456",
  "n": 1
}
```

**Manually trigger aggregation:**

```bash
firebase functions:call aggregateDailyMetrics_manual --data='{"date":"2025-11-05"}'
```

**Verify results:**
- Visit Emulator UI → Firestore
- Check `ops_metrics_daily` collection
- Look for document with ID `2025-11-05`

---

## 🔍 Verification Checklist

After setup, verify these work:

### Firebase Client ✅
```bash
# In browser console at http://localhost:3000
import { db, auth } from '@/lib/firebaseClient';
console.log('DB:', db);
console.log('Auth:', auth);
// Should see Firebase instances without errors
```

### Emulator Connectivity ✅
```bash
# Check logs in terminal running emulators
# Should see connection messages from your app
```

### Functions Deployed ✅
```bash
# List all functions
firebase functions:list

# Should include:
# - exportIncidentsCsv
# - exportIncidentsCsvCallable
# - aggregateDailyMetrics
```

### CSV Export Working ✅
```bash
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?limit=1"
# Should return CSV data or "No incidents found"
```

---

## 🐛 Troubleshooting

### Issue: Emulators won't start

**Error:** `Port XXXX is already in use`

**Solution:**
```bash
# Kill existing processes
pkill -9 -f "firebase"
pkill -9 -f "java"
sleep 2

# Try again
firebase emulators:start --only firestore,auth,functions,storage,ui
```

### Issue: "Failed to initialize Firebase Admin"

**Solution:**
```bash
# Set GOOGLE_APPLICATION_CREDENTIALS
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Or use emulator mode (no credentials needed)
export NEXT_PUBLIC_USE_EMULATORS=1
```

### Issue: Functions not found

**Solution:**
```bash
# Rebuild functions
cd functions
npm run build
cd ..

# Restart emulators
firebase emulators:start --only functions
```

### Issue: CSV export returns 404

**Solution:**
```bash
# Check function is deployed in emulator
firebase functions:list

# Check function logs
firebase functions:log --only exportIncidentsCsv

# Verify URL format
# Correct: http://127.0.0.1:5001/{project-id}/us-central1/exportIncidentsCsv
```

### Issue: App Check blocking requests

**Solution:**
In `.env.local`:
```env
# Disable App Check in emulator mode
NEXT_PUBLIC_USE_EMULATORS=1
NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=true
```

---

## 📊 What's Working

After following this guide, you should have:

✅ **Firebase Client** - Unified initialization, no duplicates
✅ **Firebase Admin** - Server-side operations ready
✅ **Emulators** - All services running locally
✅ **Functions** - exportIncidentsCsv, aggregateDailyMetrics
✅ **CSV Export** - Download incidents as CSV
✅ **Metrics** - Daily aggregation scheduled
✅ **Environment** - Properly configured for dev/prod

---

## 🎯 Next Steps

### Immediate (Day 2)
- [ ] Test auth signup/login flows
- [ ] Enable Google OAuth in emulator
- [ ] Verify App Check integration

### Short-term (Days 3-6)
- [ ] Implement Incident Center UI
- [ ] Add Sentry integration
- [ ] Create analytics dashboard
- [ ] Set up Firestore indexes

### Production Deployment
- [ ] Review security rules
- [ ] Enable App Check in production
- [ ] Deploy functions to production
- [ ] Set up monitoring/alerts

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| [src/lib/firebaseClient.ts](src/lib/firebaseClient.ts) | Client Firebase SDK |
| [src/lib/firebase-admin.ts](src/lib/firebase-admin.ts) | Server Firebase Admin |
| [functions/src/exportIncidentsCsv.ts](functions/src/exportIncidentsCsv.ts) | CSV export function |
| [functions/src/analytics/aggregateDailyMetrics.ts](functions/src/analytics/aggregateDailyMetrics.ts) | Metrics aggregation |
| [.env.local.example](.env.local.example) | Environment template |
| [scripts/verify-emulators.sh](scripts/verify-emulators.sh) | Emulator verification |

---

## 🆘 Getting Help

### Check Logs
```bash
# Emulator logs (in terminal running emulators)
# Functions logs
firebase functions:log

# App logs (browser console)
# Firestore data (Emulator UI)
open http://127.0.0.1:4000
```

### Documentation
- [Full Implementation Guide](PHASE_49_7DAY_STABILIZATION.md)
- [Phase 49 Complete](PHASE_49_COMPLETE.md)
- [Firebase Docs](https://firebase.google.com/docs)

### Support
- Check GitHub issues
- Review existing Phase 49 documentation
- Consult Firebase community forums

---

**Last Updated:** 2025-11-05
**Status:** Ready for Development ✅
