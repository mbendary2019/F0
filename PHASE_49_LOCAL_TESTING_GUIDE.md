# 🧪 Phase 49: Local Testing Quick Guide

## ✅ What's Ready

- ✅ Firestore Rules & Indexes deployed
- ✅ 3 Cloud Functions deployed (log, onEventWrite, processAlerts)
- ✅ .env.local configured for local development
- ✅ All scripts ready to use

## 🚀 Quick Start

### Step 1: Start Local Services (Terminal 1)

```bash
./start-local.sh
```

**This will start:**
- ✅ Next.js on port **3000**
- ✅ Firestore Emulator on port **8080**
- ✅ Functions Emulator on port **5001**
- ✅ Emulator UI on port **4000**

### Step 2: Run Phase 49 Tests (Terminal 2)

Open a new terminal:

```bash
./test-phase49-local.sh
```

**Tests included:**
1. ✅ Check Next.js (port 3000)
2. ✅ Check Firestore Emulator (port 8080)
3. 📝 Send single error
4. ⚡ Send 15 errors (Spike Test)
5. ⚠️ Send warning
6. ℹ️ Send info
7. 🔥 Verify Firestore data

### Step 3: Open Dashboard

```bash
open http://localhost:3000/ops/incidents
```

**Expected Results:**
- ✅ Incident created/updated (id = fingerprint)
- ✅ eventCount increments
- ✅ status = "open"
- ✅ Acknowledge/Resolve buttons (Admin only)

### Step 4: Check Emulator UI

Open: `http://localhost:4000`

**Verify Collections:**
- `ops_events` - Raw events
- `ops_incidents` - Incidents
- `ops_incident_updates` - Timeline
- `_alerts_queue` - Alerts (if High/Critical)

## 🧪 Manual Testing with CURL

```bash
curl -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{
    "level":"error",
    "service":"web",
    "code":500,
    "message":"TEST_500 manual",
    "context":{"route":"/api/test"}
  }'
```

## 🎯 Acceptance Criteria

| Criteria | Expected |
|----------|----------|
| Document in ops_events | ✅ level="error" or code>=500 |
| Incident in ops_incidents | ✅ id = fingerprint |
| Timeline in ops_incident_updates | ✅ Event type logged |
| Severity | ✅ medium (≥10), high (≥30), critical (≥100) |
| Alerts | ✅ In _alerts_queue if High/Critical |

## 🧯 Troubleshooting

### rate_limited (429)
**Cause:** Script sends requests too fast
**Fix:** Reduce requests or increase limit in `functions/src/util/rateLimit.ts`

### Incident doesn't appear
**Check:**
1. Message has `level="error"` or `code>=500`
2. Trigger is running (check Logs in Emulator UI)
3. Indexes are deployed

### Dashboard is empty
**Cause:** Need Admin permissions
**Fix:** Login with account having `token.admin=true`

### Telegram alerts not working
**Fix:**
```bash
firebase functions:config:set \
  alerts.telegram_bot_token="YOUR_BOT_TOKEN" \
  alerts.telegram_chat_id="YOUR_CHAT_ID"
```

## 🌐 Deploy to Production

After local testing:

```bash
# 1. Deploy Firestore (if not done)
firebase deploy --only firestore:rules,firestore:indexes

# 2. Build and deploy Functions
cd functions && npm run build && cd ..
firebase deploy --only functions:log,functions:onEventWrite,functions:processAlerts

# 3. Update .env.local for production
# Change: NEXT_PUBLIC_CF_LOG_URL=https://us-central1-from-zero-84253.cloudfunctions.net/log

# 4. Deploy Next.js
pnpm run build
firebase deploy --only hosting
```

## 📊 Important URLs

| Service | Local | Production |
|---------|-------|------------|
| Next.js | http://localhost:3000 | https://from-zero-84253.web.app |
| Emulator UI | http://localhost:4000 | - |
| Functions | http://localhost:5001 | - |
| log Function | 127.0.0.1:5001/.../log | us-central1-.../log |
| Dashboard | /ops/incidents | /ops/incidents |

## 📝 Important Notes

1. **Admin Access**: Dashboard requires `admin=true` in Custom Claims
2. **Rate Limiting**: 120 requests/minute per IP
3. **TTL**: Data expires after 7 days automatically
4. **PII Redaction**: Sensitive data is automatically sanitized

---

**Phase 49 Implementation Complete** 🚀
