# Phase 63 Day 1 - Quick Testing Guide ⚡

Quick commands to test the daily metrics aggregation system.

---

## 🚀 Deploy

```bash
./deploy-phase63-day1.sh
```

Or manually:
```bash
cd functions && pnpm build
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions:aggregateDailyMetrics,functions:aggregateDailyMetricsBackfill,functions:seedOpsEvents
```

---

## 🧪 Local Testing with Emulators

### Start Emulators
```bash
firebase emulators:start --only functions,firestore
```

### Seed Test Data (Firebase Functions Shell)
```bash
firebase functions:shell
```

Then in the shell:
```javascript
// Generate 500 test events
seedOpsEvents({ count: 500 })

// Trigger aggregation manually
aggregateDailyMetrics()

// Backfill last 3 days
aggregateDailyMetricsBackfill({ days: 3 })
```

### Check Results (Firestore Emulator UI)
Open: http://localhost:4000/firestore

Navigate to: `ops_metrics_daily` collection

---

## 🔥 Production Testing

### 1. Seed Test Data (Web/Mobile App)
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Must be admin user
const seed = httpsCallable(functions, 'seedOpsEvents');
const result = await seed({ count: 1000 });

console.log(result.data);
// { success: true, inserted: 1000, sessions: 5, timeRange: "last 24 hours" }
```

### 2. Backfill Historical Data
```typescript
const backfill = httpsCallable(functions, 'aggregateDailyMetricsBackfill');

// Recalculate last 7 days
const result = await backfill({ days: 7 });

console.log(result.data);
// {
//   success: true,
//   processed: 7,
//   results: [
//     { date: "2025-11-06", total: 1523 },
//     { date: "2025-11-05", total: 1789 },
//     ...
//   ]
// }
```

### 3. Query Metrics
```typescript
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const db = getFirestore();

// Get last 7 days
const q = query(
  collection(db, 'ops_metrics_daily'),
  orderBy('date', 'desc'),
  limit(7)
);

const snapshot = await getDocs(q);
const metrics = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));

console.log(metrics);
```

---

## 📊 Example Metrics Output

```json
{
  "date": "2025-11-06",
  "total": 1523,
  "info": 1205,
  "warn": 245,
  "error": 73,
  "avgLatency": 156,
  "p50Latency": 142,
  "p95Latency": 387,
  "byType": {
    "ingest": 456,
    "normalize": 389,
    "rag.validate": 234,
    "export": 221,
    "ui": 123,
    "api": 100
  },
  "byStrategy": {
    "default": 892,
    "fast": 431,
    "safe": 200
  },
  "updatedAt": 1730900000000,
  "dau": 42,
  "tokens": 1234567,
  "requests": 5678,
  "orgsActive": 8
}
```

---

## 🔍 Monitor Logs

### View Scheduled Function Logs
```bash
# All logs
firebase functions:log --only aggregateDailyMetrics

# Follow live
firebase functions:log --only aggregateDailyMetrics --follow

# Last 10 entries
firebase functions:log --only aggregateDailyMetrics --limit 10
```

### Expected Log Output (Daily at 02:10 Kuwait)
```
📊 Aggregating metrics for 2025-11-06 (1730844000000 to 1730930400000)
✅ Metrics aggregated for 2025-11-06: {
  total: 1523,
  info: 1205,
  warn: 245,
  error: 73,
  avgLatency: 156,
  p50: 142,
  p95: 387
}
```

---

## 📱 Quick cURL Tests (HTTP endpoints)

### Test Log Ingestion (if you have log endpoint)
```bash
curl -X POST http://localhost:5001/from-zero-84253/us-central1/log \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "type": "api",
    "strategy": "default",
    "message": "Test error",
    "latency": 250,
    "sessionId": "test_session_1"
  }'
```

---

## 🔐 Set Admin User

To test callable functions, you need admin privileges:

### Using script (if exists)
```bash
node scripts/set-admin.js "your-email@example.com"
```

### Or manually
```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

const uid = 'USER_UID_HERE';
await admin.auth().setCustomUserClaims(uid, { admin: true });

console.log('Admin claims set');
```

### Verify Admin Claims
```bash
firebase auth:export users.json
cat users.json | jq '.users[] | select(.email=="your-email@example.com") | .customClaims'
```

---

## 📈 Calculate Metrics

### Error Rate
```typescript
const doc = await db.collection('ops_metrics_daily').doc('2025-11-06').get();
const data = doc.data();
const errorRate = (data.error / data.total * 100).toFixed(2);
console.log(`Error rate: ${errorRate}%`);
```

### Latency Improvement
```typescript
const today = await db.collection('ops_metrics_daily').doc('2025-11-06').get();
const yesterday = await db.collection('ops_metrics_daily').doc('2025-11-05').get();

const improvement = (
  (yesterday.data().p95Latency - today.data().p95Latency) /
  yesterday.data().p95Latency * 100
).toFixed(2);

console.log(`P95 latency improvement: ${improvement}%`);
```

---

## 🐛 Troubleshooting

### Issue: "Permission denied"
**Solution**: Ensure user has admin custom claims set

### Issue: "No data in ops_metrics_daily"
**Solution**:
1. Check if ops_events has data: `firebase firestore:get ops_events --limit 1`
2. Run backfill: `aggregateDailyMetricsBackfill({ days: 1 })`

### Issue: "Missing index" error
**Solution**: Deploy indexes: `firebase deploy --only firestore:indexes`

### Issue: Scheduled function not running
**Solution**: Check Cloud Scheduler in GCP Console
```bash
gcloud scheduler jobs list --project=from-zero-84253
```

---

## ✅ Verification Checklist

- [ ] Build successful: `cd functions && pnpm build`
- [ ] Firestore rules deployed
- [ ] Firestore indexes deployed
- [ ] Functions deployed (3 functions)
- [ ] Admin user configured
- [ ] Test data seeded successfully
- [ ] Metrics aggregated for at least 1 day
- [ ] Can query ops_metrics_daily collection
- [ ] Scheduled function appears in Cloud Scheduler
- [ ] Logs showing successful aggregation

---

## 📚 Full Documentation

- English: [PHASE_63_DAY1_COMPLETE.md](PHASE_63_DAY1_COMPLETE.md)
- Arabic: [PHASE_63_DAY1_COMPLETE_AR.md](PHASE_63_DAY1_COMPLETE_AR.md)

---

**Quick Deploy**: `./deploy-phase63-day1.sh`
