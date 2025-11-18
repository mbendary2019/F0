# Quick Conversion Script for Remaining Functions

## Done ✅
- `functions/src/aggregateDailyMetrics.ts` - CONVERTED
- `functions/src/deploy/exportDeployLogs.ts` - CONVERTED

## Quick Conversion Pattern

For each remaining file, apply these changes:

### 1. Import Changes
```typescript
// Remove
import * as functions from 'firebase-functions';

// Add
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler'; // if needed
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'; // if needed
import * as logger from 'firebase-functions/logger';
```

### 2. onCall Conversion
```typescript
// Before
export const myFunc = functions.https.onCall(async (data: MyType, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '...');
  const userId = context.auth.uid;
  // ...
});

// After
export const myFunc = onCall({ timeoutSeconds: 60 }, async (request) => {
  const data = request.data as MyType;
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', '...');
  const userId = auth.uid;
  // ...
});
```

### 3. Firestore Trigger Conversion
```typescript
// Before
export const onCreated = functions.firestore
  .document('collection/{id}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const id = context.params.id;
  });

// After
export const onCreated = onDocumentCreated('collection/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const id = event.params.id;
});
```

## Remaining Files to Convert

### Deploy Functions
1. ✅ `functions/src/deploy/exportDeployLogs.ts` - DONE
2. `functions/src/deploy/pollDeployStatus.ts` - Apply onCall pattern
3. `functions/src/deploy/triggerDeploy.ts` - Apply onCall pattern with memory/timeout

### Other Functions
4. `functions/src/exportIncidentsCsv.ts` - Apply onCall pattern
5. `functions/src/collab/triggers.ts` - Apply Firestore trigger pattern
6. Any studio webhooks - Apply Firestore trigger pattern

## Batch Commands

After converting each file:

```bash
cd functions
pnpm run build
cd ..
```

If build succeeds, deploy:

```bash
firebase deploy --only functions:functionName
```

Or deploy all at once (after all conversions):

```bash
firebase deploy --only functions
```
