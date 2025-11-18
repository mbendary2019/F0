# Analytics Testing Guide - Phase 72

## Quick Start: Test Analytics Page with Mock Mode

Since Firebase Functions have build issues, we'll test Analytics directly with Firestore Emulator.

### Prerequisites
- ✅ Mock Mode enabled for the rest of the app
- ✅ Analytics page configured to use real Firebase
- ✅ Firestore Emulator ready

### Step 1: Start Firestore Emulator Only

Open a new terminal and run:

```bash
firebase emulators:start --only firestore
```

**Expected Output:**
```
✔  firestore: Firestore Emulator logging to firestore-debug.log
┌─────────────┬────────────────┬─────────────────────────────────┐
│ Emulator    │ Host:Port      │ View in Emulator UI             │
├─────────────┼────────────────┼─────────────────────────────────┤
│ Firestore   │ localhost:8080 │ http://localhost:4000/firestore │
└─────────────┴────────────────┴─────────────────────────────────┘
```

### Step 2: Seed Test Data

In another terminal, run the seed script:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seed-analytics-data.ts
```

**Expected Output:**
```
🌱 Starting analytics data seed...

📊 Day 1/30: 2025-11-12 - 1234 events (25 errors)
📊 Day 2/30: 2025-11-11 - 1456 events (31 errors)
...
✅ Successfully seeded 30 days of analytics data!
```

### Step 3: Start Next.js Dev Server

The dev server should already be running on port 3030. If not:

```bash
pnpm dev
```

### Step 4: Test Analytics Page

1. **Open Browser**: http://localhost:3030/ar/ops/analytics

2. **Login** (if needed): Use Firebase Auth Emulator
   - Email: `test@example.com`
   - Password: any password (emulator accepts all)

3. **Verify Data Loading**:
   - ✅ KPI cards show metrics (Total, Error Rate, Avg Latency)
   - ✅ Chart displays trends over time
   - ✅ No "Failed to load" errors

### Step 5: Test Different Time Ranges

Use the range selector to test:
- 7 days
- 30 days
- 90 days (may show fewer data points)

### Troubleshooting

#### "User not authenticated" Error

**Solution**: Login through Firebase Auth

```bash
# In browser console
firebase.auth().signInWithEmailAndPassword('test@example.com', 'password')
```

#### "Failed to fetch metrics" Error

**Check**:
1. Firestore Emulator running on port 8080
2. Data seeded successfully
3. Browser console for detailed errors

#### Empty Charts

**Solution**: Re-run seed script

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seed-analytics-data.ts
```

### Verify in Firestore UI

Open: http://localhost:4000/firestore

Navigate to: `ops_metrics_daily` collection

You should see 30 documents with dates as IDs.

### What's Working

✅ **Analytics API** (`/api/ops/metrics`)
  - Reads from Firestore
  - Calculates KPIs
  - Returns time series data

✅ **Analytics Page** (`/ar/ops/analytics`)
  - Fetches real data from API
  - Displays KPI cards
  - Shows trend charts
  - NOT using Mock Mode

✅ **Firebase Client**
  - Connects to Firestore Emulator (localhost:8080)
  - Auto-detects emulator on localhost

### What's NOT Working (But OK for Now)

❌ **Firebase Functions**
  - Build errors due to firebase-functions v6 compatibility
  - Not needed for this test
  - Can be fixed later

❌ **Scheduled Functions**
  - `aggregateDailyMetrics` - would normally run daily
  - `generateDailyReport` - would generate PDFs
  - `generateTrendInsights` - would generate AI summaries

**Workaround**: We seed data directly with the script

### Next Steps

1. ✅ Test Analytics page with seeded data
2. ⏳ Fix Firebase Functions build issues
3. ⏳ Deploy functions for automated data aggregation
4. ⏳ Enable Reports and Insights panels

### Configuration Summary

**Environment Variables** (`.env.local`):
```env
NEXT_PUBLIC_F0_MOCK_MODE=1          # Mock mode for projects
NEXT_PUBLIC_USE_EMULATORS=1         # Use emulators on localhost
PORT=3030
```

**Firebase Emulators**:
- Firestore: `localhost:8080`
- Firestore UI: `localhost:4000`

**Dev Server**:
- Next.js: `http://localhost:3030`

---

**Status**: ✅ Analytics testing ready without Functions!
**Date**: 2025-11-13
