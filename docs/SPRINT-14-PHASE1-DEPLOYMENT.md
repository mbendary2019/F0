# Sprint 14 — Phase 1 Deployment Guide

## 🎯 Phase 1: Core HITL Review System

This phase implements the foundational Human-in-the-Loop review queue with assignment and resolution capabilities.

---

## ✅ Components Delivered

### **Cloud Functions (3)**
1. ✅ `hitlQueueIngest` - Scheduled (every 5 minutes) - Ingests flagged AI outputs
2. ✅ `hitlAssign` - Callable - Assigns review to reviewer
3. ✅ `hitlResolve` - Callable - Resolves review with approve/reject

### **Admin API (1)**
1. ✅ `GET /api/admin/hitl/reviews` - Lists reviews with filters

### **Admin UI (1)**
1. ✅ `/admin/hitl` - Review queue dashboard

### **Infrastructure (2)**
1. ✅ Firestore rules updated (reviewer/admin RBAC)
2. ✅ Function exports in `index.ts`

---

## 🚀 Deployment Steps

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**Verify:**
```bash
# Check rules include isReviewer() helper and ai_reviews match
cat firestore.rules | grep -A 5 "ai_reviews"
```

### 2. Deploy Functions

```bash
firebase deploy --only functions:hitlQueueIngest,functions:hitlAssign,functions:hitlResolve
```

**Verify:**
```bash
firebase functions:list | grep -E "hitlQueueIngest|hitlAssign|hitlResolve"
# Expected: All 3 functions listed with ACTIVE status
```

### 3. Set Reviewer Custom Claim

Grant reviewer access to at least one user:

```bash
# Option 1: Via Firebase CLI
firebase functions:shell
> const admin = require('firebase-admin');
> admin.auth().setCustomUserClaims('USER_UID', { reviewer: true });

# Option 2: Via Firebase Console
# Authentication → Users → Select user → Custom claims → {"reviewer": true}
```

**Verify:**
```bash
firebase auth:export users.json
cat users.json | jq '.users[] | select(.customClaims.reviewer == true)'
# Expected: At least one user with reviewer claim
```

### 4. Test Locally (Optional)

```bash
npm run dev
# Navigate to: http://localhost:3000/admin/hitl
```

---

## 🧪 Smoke Tests

### Test 1: Queue Ingest

**Prerequisite:** Have at least one flagged AI evaluation run in `ai_evals/{model}/runs/*`

**Steps:**

1. Check if flagged runs exist:
   ```javascript
   // Firestore Console or CLI
   db.collectionGroup('runs').where('flagged', '==', true).get()
   ```

2. Trigger `hitlQueueIngest` manually (or wait 5 minutes):
   ```bash
   # Option 1: Cloud Console → Cloud Functions → hitlQueueIngest → Testing
   # Option 2: Wait for scheduled trigger (every 5 minutes)
   ```

3. Verify review created:
   ```javascript
   // Firestore Console
   db.collection('ai_reviews').get()
   // Expected: At least one document with status='queued'
   ```

**Expected Result:**
- `ai_reviews` collection has new documents
- Each review has: `status='queued'`, `severity`, `labels`, `timeline`
- `config/hitl_ingest` document updated with `lastTs`

---

### Test 2: Assign Review

**Steps:**

1. Navigate to `/admin/hitl` as reviewer
2. Select status filter: "Queued"
3. Click "Assign to me" on any review

**Expected Result:**
- Review status changes to "assigned"
- `assignedTo` field set to current user's UID
- Timeline event added: `{event: 'assigned', actor: UID}`
- Review appears in "Assigned" tab

**Verify in Firestore:**
```javascript
db.collection('ai_reviews').doc('REVIEW_ID').get()
// Expected: status='assigned', assignedTo='USER_UID', timeline has 2 events
```

---

### Test 3: Resolve Review (Approve)

**Steps:**

1. Navigate to `/admin/hitl` as reviewer
2. Select status filter: "Assigned" (or "Queued")
3. Click "Approve" on any review

**Expected Result:**
- Review status changes to "resolved"
- `outcome` field created: `{action: 'approve', resolvedAt: timestamp, resolvedBy: UID}`
- Timeline event added: `{event: 'resolved', actor: UID, diff: {action: 'approve'}}`
- Review appears in "Resolved" tab

**Verify in Firestore:**
```javascript
db.collection('ai_reviews').doc('REVIEW_ID').get()
// Expected: status='resolved', outcome.action='approve', timeline has 3 events
```

---

### Test 4: Resolve Review (Reject)

**Steps:**

1. Navigate to `/admin/hitl`
2. Click "Reject" on any queued/assigned review

**Expected Result:**
- Same as Test 3, but `outcome.action='reject'`

---

### Test 5: RBAC Enforcement

**Steps:**

1. Sign in as user **without** `reviewer` or `admin` custom claim
2. Navigate to `/admin/hitl`
3. Attempt to call API

**Expected Result:**
- API returns 403 Forbidden
- No reviews displayed (or error message)

**Verify:**
```bash
# Get token for non-reviewer user
curl -H "Authorization: Bearer NON_REVIEWER_TOKEN" \
  https://YOUR_DOMAIN/api/admin/hitl/reviews?status=queued
# Expected: 403 Forbidden
```

---

## 📊 Metrics to Monitor

After deployment, monitor these metrics:

### **Queue Health**
- Backlog count (reviews with `status='queued'`)
- Ingestion rate (reviews created per hour)
- Avg time from flagged → review created (should be < 5 minutes)

### **Performance**
- `hitlQueueIngest` execution time (target: < 10s)
- `hitlAssign` latency (target: < 500ms)
- `hitlResolve` latency (target: < 500ms)

### **User Activity**
- Reviews assigned per reviewer
- Reviews resolved per reviewer
- Avg time from assignment → resolution (MTTR)

---

## 🔍 Cloud Logging Queries

**All HITL Functions:**
```
resource.type="cloud_function"
("hitlQueueIngest" OR "hitlAssign" OR "hitlResolve")
```

**Errors Only:**
```
resource.type="cloud_function"
("hitlQueueIngest" OR "hitlAssign" OR "hitlResolve")
severity>=ERROR
```

**Queue Ingestion Success:**
```
resource.type="cloud_function"
"hitlQueueIngest"
"Ingested"
```

**Assignment Activity:**
```
resource.type="cloud_function"
"hitlAssign"
severity=INFO
```

---

## 🚨 Troubleshooting

### Issue: No Reviews Appearing

**Diagnosis:**
```javascript
// Check if flagged runs exist
db.collectionGroup('runs').where('flagged', '==', true).get()

// Check hitl_ingest config
db.collection('config').doc('hitl_ingest').get()
```

**Resolution:**
- Ensure you have flagged AI evaluation runs (Sprint 13)
- Check `hitlQueueIngest` logs for errors
- Manually trigger function if needed

---

### Issue: "Forbidden" Error on API

**Diagnosis:**
```javascript
// Check user's custom claims
const token = await firebase.auth().currentUser.getIdTokenResult(true);
console.log('Claims:', token.claims);
// Expected: {reviewer: true} or {admin: true}
```

**Resolution:**
```bash
# Set reviewer claim
firebase functions:shell
> admin.auth().setCustomUserClaims('USER_UID', { reviewer: true });

# User must sign out and sign in again
```

---

### Issue: Function Deployment Failed

**Diagnosis:**
```bash
# Check function logs
firebase functions:log --limit 50

# Check build errors
cd functions
npm run build
```

**Resolution:**
- Ensure all imports are correct
- Check `firebase.json` has correct region settings
- Verify Firebase project is selected: `firebase use --add`

---

## 📋 Post-Deployment Checklist

- [ ] All 3 Functions deployed successfully
- [ ] Firestore rules deployed
- [ ] At least one reviewer user configured
- [ ] Test 1: Queue ingest works (flagged → review)
- [ ] Test 2: Assign works (queued → assigned)
- [ ] Test 3: Approve works (assigned → resolved)
- [ ] Test 4: Reject works (assigned → resolved)
- [ ] Test 5: RBAC enforced (non-reviewer denied)
- [ ] Cloud Logging shows no errors
- [ ] UI loads at `/admin/hitl`

---

## 🎯 Next Steps (Phase 2)

After Phase 1 is stable, proceed to Phase 2:

1. **Remediation Tools** (2 components):
   - `safeRegenerate` - Regenerate AI output with safety constraints
   - `redactPII` - Redact PII from flagged content

2. **Enhanced UI**:
   - ReviewDrawer component for detailed view
   - Timeline visualization
   - Notes/comments on reviews

3. **Metrics Dashboard**:
   - MTTD (Mean Time To Detect)
   - MTTR (Mean Time To Resolve)
   - Throughput per reviewer
   - SLA compliance

---

## 📞 Support

**Common Issues:**
- Review Firestore rules if access denied
- Check custom claims if forbidden errors
- Verify flagged runs exist before testing ingest

**Escalation:**
- Check Cloud Logging for detailed error messages
- Review function code for logic errors
- Consult [SPRINT-14-PRD.md](./SPRINT-14-PRD.md) for full specification
