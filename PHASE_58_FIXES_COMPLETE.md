# Phase 58 Implementation + Critical Fixes ✅

## Status: In Progress

---

## ✅ Completed Fixes

### 1. Firebase Admin Exports Fixed

**Problem:** Missing `db` and `initAdmin` exports causing import errors

**Files Fixed:**
- ✅ [src/lib/firebase-admin.ts](src/lib/firebase-admin.ts)
  - Added `export const db = adminDb;`
  - Added `export function initAdmin()`

- ✅ [src/server/firebase-admin.ts](src/server/firebase-admin.ts)
  - Added `export function initAdmin()`
  - Improved error handling

**Usage:**
```typescript
// Both work now
import { db } from '@/lib/firebase-admin';
import { db, initAdmin } from '@/server/firebase-admin';
```

---

### 2. Cloud Functions v1 → v2 Conversion

#### ✅ Scheduled Functions

**Fixed: aggregateDailyMetrics**
- File: [functions/src/aggregateDailyMetrics.ts](functions/src/aggregateDailyMetrics.ts)
- Changed from: `functions.pubsub.schedule().onRun()`
- Changed to: `onSchedule({ schedule, timeZone, memory, timeoutSeconds })`
- Removed return value (v2 requires `void`)
- Converted manual trigger from v1 `onCall(data, context)` to v2 `onCall(request)`

**Already v2:**
- ✅ [functions/src/schedules/compactSnippets.ts](functions/src/schedules/compactSnippets.ts) - Already using v2

---

## 🔄 In Progress

### 3. Cloud Functions v1 → v2 (Remaining)

Need to convert these files:

#### Callable HTTPS Functions
- [ ] `functions/src/deploy/pollDeployStatus.ts`
- [ ] `functions/src/deploy/exportDeployLogs.ts`
- [ ] `functions/src/deploy/triggerDeploy.ts`
- [ ] `functions/src/exportIncidentsCsv.ts`
- [ ] Any other `functions.https.onCall()` instances

**Pattern to follow:**
```typescript
// Before (v1)
import * as functions from 'firebase-functions';
export const myFunction = functions.https.onCall((data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '...');
  // ...
  return { result };
});

// After (v2)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
export const myFunction = onCall(
  { timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    const data = request.data;
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', '...');
    // ...
    return { result };
  }
);
```

#### Firestore Triggers
- [ ] `functions/src/collab/triggers.ts`
- [ ] Any `functions.firestore.document().onCreate/onUpdate/onDelete()`

**Pattern to follow:**
```typescript
// Before (v1)
import * as functions from 'firebase-functions';
export const onJobCreated = functions.firestore
  .document('studio_jobs/{jobId}')
  .onCreate((snap, context) => {
    const data = snap.data();
    const jobId = context.params.jobId;
    // ...
  });

// After (v2)
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
export const onJobCreated = onDocumentCreated('studio_jobs/{jobId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const jobId = event.params.jobId;
  // ...
});
```

---

### 4. Next.js Dynamic Routes

Need to add `export const dynamic = "force-dynamic"` to:

- [ ] `src/app/api/billing/usage/route.ts`
- [ ] `src/app/api/ops/*/route.ts` (any that use headers/cookies)
- [ ] `src/app/admin/page.tsx` (or layout.tsx)
- [ ] `src/app/f0/page.tsx`

**Pattern:**
```typescript
// At the top of route.ts or page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  // Your code
}
```

---

### 5. Next.js Config Cleanup

- [ ] Remove `experimental.allowedDevOrigins` from `next.config.js`
- [ ] Ensure NOT using `output: 'export'`
- [ ] Verify Firebase Hosting adapter is configured

---

### 6. TTL Policy Setup

- [ ] Go to Firebase Console
- [ ] Firestore → Indexes → TTL Policies
- [ ] Create policy for `ops_rag_cache` collection on `expire_at` field
- [ ] Wait for "Building" → "Serving" status

---

## 🧪 Testing Plan

### 1. Build Functions

```bash
cd functions
pnpm install
pnpm run build
cd ..
```

**Expected:** No TypeScript errors

### 2. Test Individual Function

```bash
# Test the converted schedule function
firebase deploy --only functions:aggregateDailyMetrics

# Test manual trigger
firebase functions:call aggregateDailyMetrics_manual --data='{"date":"2025-11-05"}'
```

### 3. Build Next.js

```bash
pnpm run build
```

**Expected:**
- No prerender errors on `/f0` or `/admin`
- No dynamic usage errors

### 4. Deploy Incrementally

```bash
# 1. Deploy indexes first
firebase deploy --only firestore:indexes

# 2. Deploy rules
firebase deploy --only firestore:rules

# 3. Deploy converted functions one by one
firebase deploy --only functions:aggregateDailyMetrics
firebase deploy --only functions:weeklyCompactSnippets

# 4. Deploy hosting
firebase deploy --only hosting
```

---

## 📋 Conversion Checklist

### Scheduled Functions
- [x] aggregateDailyMetrics - CONVERTED
- [x] weeklyCompactSnippets - Already v2
- [ ] aggregateMonthly (if exists)
- [ ] Any other cron jobs in `functions/src/`

### Callable Functions
- [x] aggregateDailyMetrics_manual - CONVERTED
- [ ] pollDeployStatus
- [ ] exportDeployLogs
- [ ] triggerDeploy
- [ ] exportIncidentsCsv
- [ ] Any other `onCall` functions

### Firestore Triggers
- [ ] collab/triggers.ts
- [ ] Any other `.onCreate/.onUpdate/.onDelete` handlers

### Next.js Routes
- [ ] /api/billing/usage
- [ ] /api/ops/* (check all)
- [ ] /admin pages
- [ ] /f0 pages

---

## 🚀 Quick Commands

```bash
# Fix all at once (after manual edits)
pnpm install
cd functions && pnpm run build && cd ..
pnpm run build

# Deploy everything
firebase deploy --only firestore:indexes,firestore:rules
firebase deploy --only functions
firebase deploy --only hosting

# Or deploy incrementally (safer)
firebase deploy --only functions:aggregateDailyMetrics
firebase deploy --only functions:weeklyCompactSnippets
# ... one at a time
```

---

## 📞 Need Help?

Check these files for reference:
- ✅ Good v2 example: `functions/src/schedules/compactSnippets.ts`
- ✅ Fixed callable: `functions/src/aggregateDailyMetrics.ts` (manual trigger)
- 📚 Official docs: https://firebase.google.com/docs/functions/2nd-gen-upgrade

---

## Next Steps

1. **Convert remaining functions** (use patterns above)
2. **Add `force-dynamic` to routes**
3. **Test builds** (functions + Next.js)
4. **Deploy incrementally**
5. **Monitor for errors**

**Status:** 2/25+ functions converted, Phase 58 RAG complete ✅
