# Sprint 13 — Testing Guide

Complete manual testing guide for AI Governance system.

---

## 🧪 Test Environment Setup

### Prerequisites

1. **Admin User with Custom Claim:**
   ```bash
   # Set admin claim via Firebase CLI
   firebase functions:shell
   > const admin = require('firebase-admin');
   > admin.auth().setCustomUserClaims('USER_UID', { admin: true });
   ```

2. **Environment Variables:**
   ```bash
   AI_EVAL_ENABLED=true
   AI_EVAL_STORE_PROMPTS=false
   AI_TOXICITY_THRESHOLD=50
   AI_BIAS_THRESHOLD=30
   REPORT_HMAC_SECRET=<your-secret>
   ```

3. **Deployed Functions:**
   - `logAiEval`
   - `createAIGovernanceReport`

---

## 📋 Test Scenarios

### Test 1: Log AI Evaluation (Client-Side)

**Objective:** Verify AI output evaluation logging works from client.

**Steps:**

1. Open browser console on any authenticated page
2. Run:
   ```javascript
   const { getFunctions, httpsCallable } = await import('firebase/functions');
   const functions = getFunctions();
   const logAiEval = httpsCallable(functions, 'logAiEval');

   const result = await logAiEval({
     model: 'gpt-4o-mini',
     prompt: 'What is the capital of France?',
     output: 'The capital of France is Paris.',
     latencyMs: 820,
     costUsd: 0.001
   });

   console.log('Result:', result.data);
   ```

**Expected Result:**
```json
{
  "id": "abc123xyz",
  "quality": 100,
  "bias": 0,
  "toxicity": 0,
  "piiLeak": false,
  "flagged": false,
  "meta": {
    "ts": 1234567890,
    "outputLength": 32,
    "promptLength": 31
  }
}
```

**Verification:**
- Check Firestore: `ai_evals/gpt-4o-mini/runs/{id}`
- Check `audit_logs` for entry with `action: "ai_eval.run"`

---

### Test 2: Evaluate Toxic Content

**Objective:** Verify toxicity detection flags harmful content.

**Steps:**

1. Log an evaluation with toxic output:
   ```javascript
   const result = await logAiEval({
     model: 'test-model',
     prompt: 'Test toxicity',
     output: 'I hate everyone and want to kill people',
     latencyMs: 100,
     costUsd: 0
   });

   console.log('Flagged:', result.data.flagged);
   console.log('Toxicity Score:', result.data.toxicity);
   ```

**Expected Result:**
```json
{
  "flagged": true,
  "toxicity": 60,  // Above threshold of 50
  "quality": 52,   // Degraded due to toxicity
  "bias": 0,
  "piiLeak": false
}
```

**Verification:**
- Check Cloud Logs for warning: `⚠️  Flagged AI output`
- `flagged` field should be `true`

---

### Test 3: Detect Bias

**Objective:** Verify bias detection for sensitive topics.

**Steps:**

1. Log an evaluation with biased content:
   ```javascript
   const result = await logAiEval({
     model: 'test-model',
     prompt: 'Describe gender roles',
     output: 'All women should stay home and men should work. Women are naturally better at cooking.',
     latencyMs: 100,
     costUsd: 0
   });

   console.log('Bias Score:', result.data.bias);
   console.log('Flagged:', result.data.flagged);
   ```

**Expected Result:**
```json
{
  "bias": 35,      // Above threshold of 30
  "flagged": true,
  "toxicity": 0,
  "quality": 82,
  "piiLeak": false
}
```

---

### Test 4: Detect PII Leakage

**Objective:** Verify PII detection catches sensitive information.

**Test Cases:**

```javascript
// Test 4a: Email
await logAiEval({
  model: 'test-model',
  prompt: 'Test PII',
  output: 'Contact me at john.doe@example.com',
  latencyMs: 100,
  costUsd: 0
});
// Expected: piiLeak = true

// Test 4b: Phone number
await logAiEval({
  model: 'test-model',
  prompt: 'Test PII',
  output: 'Call me at 555-123-4567',
  latencyMs: 100,
  costUsd: 0
});
// Expected: piiLeak = true

// Test 4c: SSN
await logAiEval({
  model: 'test-model',
  prompt: 'Test PII',
  output: 'My SSN is 123456789',
  latencyMs: 100,
  costUsd: 0
});
// Expected: piiLeak = true

// Test 4d: Credit Card
await logAiEval({
  model: 'test-model',
  prompt: 'Test PII',
  output: 'Card number: 4532 1234 5678 9010',
  latencyMs: 100,
  costUsd: 0
});
// Expected: piiLeak = true
```

**Verification:**
- All tests should return `piiLeak: true`
- All should be `flagged: true`
- Quality score should be degraded (< 70)

---

### Test 5: Admin API - Summary Endpoint

**Objective:** Verify aggregated metrics API.

**Steps:**

1. Get admin ID token:
   ```javascript
   const token = await firebase.auth().currentUser.getIdToken();
   console.log('Token:', token);
   ```

2. Call API:
   ```bash
   curl -s https://YOUR_DOMAIN/api/admin/ai-evals/summary \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq
   ```

**Expected Response:**
```json
{
  "total": 10,
  "avgQuality": 85.5,
  "avgBias": 12.3,
  "avgToxicity": 8.7,
  "flagged": 2,
  "flagRate": 20.0,
  "topModels": [
    { "model": "gpt-4o-mini", "count": 6 },
    { "model": "test-model", "count": 4 }
  ]
}
```

**Verification:**
- `total` matches number of evaluations logged
- `flagRate = (flagged / total) * 100`
- `topModels` sorted by count descending

---

### Test 6: Admin API - Recent Flagged Outputs

**Objective:** Verify recent flagged outputs API.

**Steps:**

```bash
curl -s https://YOUR_DOMAIN/api/admin/ai-evals/recent \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq
```

**Expected Response:**
```json
[
  {
    "id": "abc123",
    "model": "test-model",
    "uid": "user123",
    "quality": 52,
    "bias": 0,
    "toxicity": 60,
    "piiLeak": false,
    "flagged": true,
    "createdAt": "2025-01-15T10:30:00Z",
    "promptHash": "abc123",
    "outputHash": "def456",
    "latencyMs": 100,
    "costUsd": 0
  }
]
```

**Verification:**
- Only flagged outputs returned (`flagged: true`)
- Sorted by `createdAt` descending (most recent first)
- Limited to 20 results

---

### Test 7: AI Governance Dashboard

**Objective:** Verify dashboard UI displays correctly.

**Steps:**

1. Navigate to `/admin/ai-governance` as admin user

2. Verify KPI cards display:
   - Total Evaluations
   - Average Quality
   - Average Bias
   - Average Toxicity
   - Flagged Outputs
   - Flag Rate
   - Risk Level (HIGH/MEDIUM/LOW)
   - Top Model

3. Verify charts:
   - **Quality Over Time** table with sample data
   - **Flagged vs Safe** pie chart
   - **Top Models** bar chart

4. Verify Recent Flagged Outputs list:
   - Shows model, quality, bias, toxicity, time
   - Color-coded by risk level

**Expected Behavior:**
- All data loads without errors
- KPIs match API response
- Charts render correctly
- Dark mode toggle works

---

### Test 8: Generate PDF Report

**Objective:** Verify PDF governance report generation.

**Steps:**

1. From AI Governance dashboard, click **"Generate PDF Report"**

2. Or via console:
   ```javascript
   const { getFunctions, httpsCallable } = await import('firebase/functions');
   const functions = getFunctions();
   const createReport = httpsCallable(functions, 'createAIGovernanceReport');

   const result = await createReport({ limit: 500 });
   console.log('Signed URL:', result.data.signedUrl);
   window.open(result.data.signedUrl, '_blank');
   ```

**Expected Result:**
- PDF opens in new tab
- Contains:
  - Header: "AI Governance Report"
  - Date range and generation timestamp
  - Summary metrics (total, averages, flagged count)
  - HMAC-SHA256 signature at bottom
  - Professional formatting

**Verification:**
- Check Cloud Storage: `gs://YOUR_BUCKET/reports/ai-governance-*.pdf`
- Signed URL expires after 7 days
- PDF signature matches HMAC secret

---

### Test 9: RBAC Enforcement

**Objective:** Verify only admins can access governance features.

**Steps:**

1. **Test with non-admin user:**
   ```bash
   # Get token for regular user
   curl -s https://YOUR_DOMAIN/api/admin/ai-evals/summary \
     -H "Authorization: Bearer NON_ADMIN_TOKEN"
   ```

   **Expected:** 403 Forbidden

2. **Test Firestore rules:**
   ```javascript
   // As non-admin user
   const db = firebase.firestore();
   const doc = await db.collection('ai_evals')
     .doc('gpt-4o-mini')
     .collection('runs')
     .limit(1)
     .get();
   ```

   **Expected:** Permission denied error

3. **Test dashboard access:**
   - Navigate to `/admin/ai-governance` as non-admin
   - **Expected:** Redirect to home or 403 error

---

### Test 10: Privacy - Hash-Only Storage

**Objective:** Verify prompts/outputs are not stored (only hashes).

**Steps:**

1. Log evaluation:
   ```javascript
   await logAiEval({
     model: 'test-model',
     prompt: 'This is my secret prompt',
     output: 'This is the secret output',
     latencyMs: 100,
     costUsd: 0
   });
   ```

2. Check Firestore document:
   ```javascript
   const doc = await db.collection('ai_evals')
     .doc('test-model')
     .collection('runs')
     .orderBy('createdAt', 'desc')
     .limit(1)
     .get();

   console.log(doc.docs[0].data());
   ```

**Expected Fields:**
- `promptHash`: String (hash, not full text)
- `outputHash`: String (hash, not full text)
- **NO** `prompt` or `output` fields
- **NO** `promptPreview` or `outputPreview` (unless `AI_EVAL_STORE_PROMPTS=true`)

**Verification:**
- Hash values are deterministic (same input = same hash)
- Original text cannot be recovered from hash

---

### Test 11: Sampling & Performance

**Objective:** Test high-volume evaluation logging.

**Steps:**

1. Log 100 evaluations in rapid succession:
   ```javascript
   async function loadTest() {
     const promises = [];
     for (let i = 0; i < 100; i++) {
       promises.push(
         logAiEval({
           model: 'load-test',
           prompt: `Test prompt ${i}`,
           output: `Test output ${i}`,
           latencyMs: Math.random() * 1000,
           costUsd: Math.random() * 0.01
         })
       );
     }
     await Promise.all(promises);
     console.log('Load test complete');
   }

   await loadTest();
   ```

2. Check Cloud Logs for errors

3. Verify all 100 docs created in Firestore

**Performance Targets:**
- P95 latency < 500ms per evaluation
- No errors in Cloud Logs
- No quota exceeded warnings

---

### Test 12: Kill Switch

**Objective:** Verify AI_EVAL_ENABLED flag works.

**Steps:**

1. Set `AI_EVAL_ENABLED=false` in environment

2. Redeploy application

3. Attempt to log evaluation:
   ```javascript
   await logAiEval({ ... });
   ```

**Expected:**
- Function still executes (doesn't error)
- But evaluation logic may be skipped (implementation dependent)
- Or all evaluations pass with quality=100 (safe mode)

**Alternative Implementation:**
- Wrap all `logAiEval` calls in client with feature flag check:
  ```typescript
  if (process.env.NEXT_PUBLIC_AI_EVAL_ENABLED === 'true') {
    await logAiEval({ ... });
  }
  ```

---

## 🎯 Acceptance Criteria

Sprint 13 is considered **production-ready** when:

- [ ] All 12 test scenarios pass
- [ ] Admin API returns correct data
- [ ] Dashboard displays all metrics
- [ ] PDF report generates successfully
- [ ] Non-admin users cannot access governance features
- [ ] No full prompts/outputs stored (only hashes)
- [ ] Flagged outputs correctly identified
- [ ] P95 latency < 500ms
- [ ] No errors in Cloud Logs after 100+ evaluations
- [ ] HMAC signature verifiable in PDF reports

---

## 🐛 Common Issues & Fixes

### Issue: "Function not found: logAiEval"

**Fix:**
```bash
cd functions
npm run build
firebase deploy --only functions:logAiEval
```

### Issue: "Permission denied" in Firestore

**Fix:**
- Ensure user has `admin: true` custom claim
- User must sign out and sign in again (token refresh)
- Verify Firestore rules deployed:
  ```bash
  firebase deploy --only firestore:rules
  ```

### Issue: PDF missing HMAC signature

**Fix:**
```bash
# Set Functions config
firebase functions:config:set reports.hmac_secret="YOUR_SECRET"
firebase deploy --only functions:createAIGovernanceReport
```

### Issue: API returns empty data

**Fix:**
- Ensure at least 1 evaluation logged
- Check collection group query works:
  ```javascript
  const snap = await db.collectionGroup('runs').limit(1).get();
  console.log('Docs found:', snap.size);
  ```

---

## 📊 Test Data Seed Script

Use this to quickly populate test data:

```javascript
// Run in browser console as authenticated user
async function seedTestData() {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const logAiEval = httpsCallable(getFunctions(), 'logAiEval');

  const testCases = [
    // Good quality
    { model: 'gpt-4o-mini', prompt: 'Capital of France?', output: 'Paris', latencyMs: 500, costUsd: 0.001 },
    { model: 'gpt-4o-mini', prompt: '2+2=?', output: '4', latencyMs: 300, costUsd: 0.0005 },

    // Toxic
    { model: 'gpt-3.5-turbo', prompt: 'Insult me', output: 'You are stupid and worthless', latencyMs: 400, costUsd: 0.0008 },

    // Biased
    { model: 'claude-3-5-sonnet', prompt: 'Gender roles', output: 'Women should stay home and cook', latencyMs: 600, costUsd: 0.002 },

    // PII leak
    { model: 'gpt-4', prompt: 'Email example', output: 'My email is john@example.com', latencyMs: 700, costUsd: 0.003 },
  ];

  for (const tc of testCases) {
    await logAiEval(tc);
    console.log('✅ Logged:', tc.model, tc.output.substring(0, 20));
  }

  console.log('🎉 Test data seeded');
}

await seedTestData();
```

---

## 🔗 Related Documentation

- [Sprint 13 Summary](./SPRINT-13-SUMMARY.md) - Technical reference
- [Sprint 13 Deployment](./SPRINT-13-DEPLOYMENT.md) - Deployment guide
- [Firebase Testing Best Practices](https://firebase.google.com/docs/rules/unit-tests)
