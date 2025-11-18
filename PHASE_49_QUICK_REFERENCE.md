# ⚡ Phase 49 Quick Reference Card

## 🚀 One-Command Testing

```bash
# Test everything
bash test-complete-phase49.sh

# Generate test data
bash seed-incidents.sh

# Test services
bash test-services.sh
```

---

## 🌐 URLs

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000/ar/ops/incidents |
| **Test Page** | http://localhost:3000/test-toast |
| **Firestore UI** | http://localhost:4000/firestore |
| **Auth Emulator** | http://localhost:4000/auth |
| **Log Endpoint** | http://localhost:3000/api/log |

---

## 📡 API Usage

### Send Log (Browser Console)
```javascript
fetch('/api/log', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    level: 'error',
    service: 'web',
    message: 'Test error',
    code: 500,
    fingerprint: 'test-error'
  })
}).then(r => r.json()).then(console.log);
```

### Trigger Error Boundary
```javascript
throw new Error('Test error tracking');
```

### Simulate Spike (15 errors)
```javascript
for (let i = 0; i < 15; i++) {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      level: 'error',
      message: `Spike test ${i}`,
      fingerprint: 'spike-test'
    })
  });
}
```

---

## 🎯 Severity Levels

| Level | Events/5min | Color |
|-------|-------------|-------|
| **Low** | 1-3 | 🟢 Green |
| **Medium** | 4-9 | 🟡 Yellow |
| **High** | 10-19 | 🟠 Orange |
| **Critical** | 20+ | 🔴 Red |

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| **[src/app/global-error.tsx](src/app/global-error.tsx)** | Global error boundary |
| **[src/app/[locale]/developers/error.tsx](src/app/[locale]/developers/error.tsx)** | Route error boundary |
| **[functions/src/http/log.ts](functions/src/http/log.ts)** | Log Cloud Function |
| **[functions/src/incidents/onEventWrite.ts](functions/src/incidents/onEventWrite.ts)** | Incident trigger |
| **[src/app/api/log/route.ts](src/app/api/log/route.ts)** | Next.js proxy |

---

## 🔐 Admin Setup (Quick)

```bash
# 1. Open Auth Emulator
open http://localhost:4000/auth

# 2. Find your user → Edit Custom Claims
# 3. Add:
{
  "admin": true,
  "role": "admin"
}

# 4. Refresh and reload
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **404 on /api/log** | Check `NEXT_PUBLIC_CF_LOG_URL` in .env.local |
| **Function not found** | `cd functions && npm run build` |
| **No incidents showing** | Check Firestore trigger logs |
| **Hydration error** | Already fixed in layouts |
| **404 on /ar/ops/incidents** | Already fixed with re-export |

---

## 📚 Documentation

| Guide | Topic |
|-------|-------|
| **[PHASE_49_COMPLETE_SUMMARY.md](PHASE_49_COMPLETE_SUMMARY.md)** | Complete reference |
| **[AUTO_ERROR_TRACKING_GUIDE.md](AUTO_ERROR_TRACKING_GUIDE.md)** | Error boundaries |
| **[PAYWALL_AND_PERMISSIONS_SETUP.md](PAYWALL_AND_PERMISSIONS_SETUP.md)** | Bypass paywall |
| **[TESTING_GUIDE.md](TESTING_GUIDE.md)** | Full testing guide |
| **[ADMIN_CLAIMS_SETUP.md](ADMIN_CLAIMS_SETUP.md)** | Admin permissions |

---

## ✅ Health Check

```bash
# Check all services
bash test-services.sh

# Should show:
# ✅ Next.js: Running on http://localhost:3000
# ✅ Firestore Emulator: Running on localhost:8080
# ✅ Functions Emulator: Running on localhost:5001
# ✅ Log API: Available at /api/log
```

---

## 🎨 Add Error Boundary to Any Route

```typescript
// src/app/YOUR_ROUTE/error.tsx
'use client';
import { useEffect } from 'react';

export default function YourRouteError({ error, reset }) {
  useEffect(() => {
    fetch('/api/log', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        level: 'error',
        message: error.message,
        stack: error.stack,
        context: { route: '/YOUR_ROUTE' },
        fingerprint: `YOUR_ROUTE-error-${error.name}`
      })
    });
  }, [error]);

  return (
    <div>
      <h2>Error occurred</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## 🔥 Quick Tests

### 1. Test Toast
```javascript
// In browser console
import('sonner').then(({toast}) => {
  toast.success('تم الاختبار ✅');
});
```

### 2. Test Error Logging
```javascript
fetch('/api/log', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    level: 'error',
    message: 'Quick test',
    fingerprint: 'quick-test'
  })
}).then(r => r.json()).then(console.log);
// Expected: {ok: true, eventId: "..."}
```

### 3. Test Dashboard
1. Open: http://localhost:3000/ar/ops/incidents
2. Run: `bash seed-incidents.sh`
3. Refresh dashboard
4. Should see 6 incidents

---

## 🚨 Emergency Commands

```bash
# Restart emulators
pkill -f firebase && firebase emulators:start

# Rebuild functions
cd functions && npm run build

# Clear Firestore
firebase firestore:delete --all-collections --yes

# Check function logs
firebase functions:log

# Kill dev servers
pkill -f "next dev" && pkill -f "firebase"
```

---

## 📊 Firestore Collections

| Collection | Purpose |
|------------|---------|
| **ops_events** | All logged events (TTL: 30 days) |
| **ops_incidents** | Aggregated incidents |
| **ops_incident_updates** | Status changes |

---

## 🎯 Environment Variables

```bash
# Required in .env.local
NEXT_PUBLIC_CF_LOG_URL=http://127.0.0.1:5001/from-zero-84253/us-central1/log

# Optional for development
NEXT_PUBLIC_DISABLE_PAYWALL=true
```

---

## 🏁 Production Checklist

- [ ] Update `NEXT_PUBLIC_CF_LOG_URL` to production URL
- [ ] Remove `NEXT_PUBLIC_DISABLE_PAYWALL`
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Deploy hosting: `firebase deploy --only hosting`
- [ ] Test error boundaries in production build
- [ ] Set up admin claims for real users
- [ ] Configure alerting for critical incidents
- [ ] Apply Firestore indexes from `firestore.indexes.json`

---

## 📞 Support

- **Full Guide**: See [PHASE_49_COMPLETE_SUMMARY.md](PHASE_49_COMPLETE_SUMMARY.md)
- **Error Tracking**: See [AUTO_ERROR_TRACKING_GUIDE.md](AUTO_ERROR_TRACKING_GUIDE.md)
- **Testing**: See [TESTING_GUIDE.md](TESTING_GUIDE.md)

---

---

## 🔧 New: 7-Day Stabilization Features

### Firebase Consolidation ✅
- **Client:** [src/lib/firebaseClient.ts](src/lib/firebaseClient.ts)
- **Admin:** [src/lib/firebase-admin.ts](src/lib/firebase-admin.ts)
- **Status:** Unified, no duplicates, singleton pattern

### CSV Export ✅
```bash
# Export incidents to CSV
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?limit=100" -o incidents.csv

# With filters
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?level=error&status=open" -o errors.csv
```

### Daily Metrics Aggregation ✅
```bash
# Manual trigger
firebase functions:call aggregateDailyMetrics_manual --data='{"date":"2025-11-05"}'

# Scheduled: Every day at 02:10 (Kuwait time)
# Collection: ops_metrics_daily/{YYYY-MM-DD}
```

### Emulator Verification ✅
```bash
./scripts/verify-emulators.sh
```

---

## 📚 New Documentation

| Document | Topic |
|----------|-------|
| **[PHASE_49_7DAY_STABILIZATION.md](PHASE_49_7DAY_STABILIZATION.md)** | Full 7-day plan & implementation |
| **[QUICK_START_PHASE49.md](QUICK_START_PHASE49.md)** | 5-minute quick start guide |
| **[TESTING_GUIDE_PHASE49.md](TESTING_GUIDE_PHASE49.md)** | Complete testing procedures |
| **[PHASE_49_CHECKLIST.md](PHASE_49_CHECKLIST.md)** | 145-item task checklist |
| **[ملخص_التنفيذ_المرحلة_49.md](ملخص_التنفيذ_المرحلة_49.md)** | Arabic implementation summary |

---

**Phase 49 Status:** ✅ **COMPLETE & PRODUCTION READY**

**What's Working:**
- ✅ Automatic error capture via React Error Boundaries
- ✅ Manual logging API with PII redaction
- ✅ Real-time incident dashboard with severity classification
- ✅ Spike detection and alerting
- ✅ i18n support (Arabic/English)
- ✅ Comprehensive testing tools
- ✅ Complete documentation
- ✅ **NEW:** Firebase initialization consolidated (no duplicates)
- ✅ **NEW:** CSV export functions (HTTP + Callable)
- ✅ **NEW:** Daily metrics aggregation verified
- ✅ **NEW:** Emulator verification script
- ✅ **NEW:** Comprehensive .env.local.example

**Last Updated:** 2025-11-05
