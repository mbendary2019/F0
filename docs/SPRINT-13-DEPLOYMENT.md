# Sprint 13 — Deployment Guide & Runbook

## 🚀 Quick Deployment Checklist

### 1. Environment Configuration

#### Local `.env.local`
Ensure all Sprint 13 variables are configured:

```bash
# AI Governance (Sprint 13)
AI_EVAL_ENABLED=true
AI_EVAL_STORE_PROMPTS=false          # Keep false for privacy
AI_TOXICITY_THRESHOLD=50
AI_BIAS_THRESHOLD=30

# Legal Reports (Sprint 12 - required for PDF signatures)
REPORT_HMAC_SECRET=<generate-random-secret>
```

**Generate HMAC Secret:**
```bash
openssl rand -base64 32
```

#### Firebase Functions Configuration
Run the setup script to configure Functions environment:

```bash
./scripts/firebase-config-setup.sh
```

Or manually:
```bash
firebase functions:config:set \
  reports.hmac_secret="YOUR_LONG_RANDOM_SECRET"
```

Verify:
```bash
firebase functions:config:get
```

---

### 2. Firestore Rules Deployment

Verify rules include Sprint 13 collections:

```bash
# Validate locally
cat firestore.rules | grep -A 3 "ai_evals"

# Expected output:
# match /ai_evals/{modelId}/runs/{runId} {
#   allow read: if isAuthenticated() && request.auth.token.admin == true;
#   allow write: if false;
# }
```

Deploy:
```bash
firebase deploy --only firestore:rules
```

---

### 3. Cloud Functions Deployment

#### Option A: Deploy All Functions
```bash
cd functions
npm ci
npm run build
firebase deploy --only functions
```

#### Option B: Deploy Sprint 13 Functions Only
```bash
firebase deploy --only \
  functions:logAiEval,\
  functions:createAIGovernanceReport
```

#### Verify Deployment
```bash
firebase functions:list | grep -E "logAiEval|createAIGovernanceReport"
```

---

### 4. Next.js Application Deployment

#### Vercel (Recommended)
1. Add environment variables in Vercel Dashboard:
   - All variables from `.env.local`
   - Ensure `AI_EVAL_ENABLED=true`
   - Set `REPORT_HMAC_SECRET` (same as Functions config)

2. Redeploy:
```bash
vercel --prod
```

#### Self-Hosted
```bash
npm run build
npm start
```

---

### 5. Post-Deployment Verification

Run the test suite to verify everything works:

```bash
# See SPRINT-13-TESTING.md for detailed test scenarios
```

---

## 🔧 CI/CD Setup

### GitHub Actions

Two workflows are included:

1. **Functions Deployment** (`.github/workflows/firebase-functions-deploy.yml`)
   - Triggers on push to `main` when `functions/**` changes
   - Auto-deploys all Functions

2. **Firestore Rules** (`.github/workflows/firestore-rules-deploy.yml`)
   - Triggers on push to `main` when `firestore.rules` changes
   - Auto-deploys security rules

#### Setup GitHub Secrets

```bash
# 1. Generate Firebase CI token
firebase login:ci

# 2. Add to GitHub Secrets:
# - FIREBASE_TOKEN (from step 1)
# - FIREBASE_PROJECT_ID (your project ID)
```

Navigate to: `Settings → Secrets and variables → Actions → New repository secret`

---

## 📊 Monitoring & Observability

### Cloud Logging Filters

**AI Evaluation Logs:**
```
resource.type="cloud_function"
resource.labels.function_name="logAiEval"
severity>=WARNING
```

**Governance Report Generation:**
```
resource.type="cloud_function"
resource.labels.function_name="createAIGovernanceReport"
```

**Flagged AI Outputs:**
```
textPayload=~"⚠️  Flagged AI output"
```

### Firestore Usage Monitoring

Track write operations to `ai_evals`:
```bash
gcloud firestore operations list --filter="ai_evals"
```

### Cloud Storage Usage

Monitor PDF report storage:
```bash
gsutil du -sh gs://YOUR_BUCKET/reports/
```

---

## 🚨 Incident Runbook

### Issue: High Flagged Rate (>10%)

**Symptoms:**
- AI Governance dashboard shows `flagRate > 10%`
- Many red flags in Recent Flagged Outputs

**Immediate Actions:**
1. **Kill Switch** - Disable evaluations temporarily:
   ```bash
   # Update Vercel env
   vercel env add AI_EVAL_ENABLED
   # Enter: false
   vercel --prod
   ```

2. **Analyze flagged outputs:**
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://YOUR_DOMAIN/api/admin/ai-evals/recent
   ```

3. **Review thresholds:**
   - Check if `AI_TOXICITY_THRESHOLD=50` is too low
   - Check if `AI_BIAS_THRESHOLD=30` is too low

**Root Cause:**
- False positives from bias/toxicity detection
- Model behavior change
- User input patterns changed

**Resolution:**
1. Adjust thresholds in `.env.local`:
   ```bash
   AI_TOXICITY_THRESHOLD=60   # Increase if too many false positives
   AI_BIAS_THRESHOLD=40
   ```

2. Redeploy application

3. Re-enable evaluations:
   ```bash
   AI_EVAL_ENABLED=true
   ```

---

### Issue: PDF Generation Fails

**Symptoms:**
- Error: "HMAC secret not configured"
- Error: "Permission denied" when uploading to Storage

**Diagnosis:**
```bash
# Check Functions config
firebase functions:config:get reports.hmac_secret

# Check Storage permissions
gsutil iam get gs://YOUR_BUCKET
```

**Resolution:**

1. **Missing HMAC Secret:**
   ```bash
   ./scripts/firebase-config-setup.sh
   firebase deploy --only functions:createAIGovernanceReport
   ```

2. **Storage Permissions:**
   ```bash
   # Grant Functions service account Storage Admin role
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member=serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com \
     --role=roles/storage.objectAdmin
   ```

---

### Issue: API Returns 401/403

**Symptoms:**
- Admin APIs return "Unauthorized" or "Forbidden"
- User has admin claim but still denied

**Diagnosis:**
```bash
# Verify admin claim
firebase auth:export users.json --project YOUR_PROJECT_ID
cat users.json | jq '.users[] | select(.email=="admin@example.com") | .customClaims'
```

**Resolution:**

1. **Set admin claim:**
   ```bash
   firebase functions:shell
   > admin.auth().setCustomUserClaims('USER_UID', { admin: true })
   ```

2. **User must sign out and sign in again** to refresh token

3. **Verify in client:**
   ```typescript
   const token = await auth.currentUser?.getIdTokenResult(true);
   console.log('Admin claim:', token?.claims.admin);
   ```

---

### Issue: Firestore Quota Exceeded

**Symptoms:**
- Error: "Resource exhausted"
- High write rate to `ai_evals`

**Immediate Actions:**
1. **Enable sampling:**
   ```typescript
   // In client code
   if (Math.random() < 0.1) {  // Sample 10% of evaluations
     await logAiEval({ ... });
   }
   ```

2. **Reduce evaluation frequency:**
   ```bash
   AI_EVAL_ENABLED=false  # Temporary disable
   ```

**Long-term Fix:**
- Upgrade Firestore plan (Blaze with higher quotas)
- Implement batching (evaluate N outputs, write 1 aggregated doc)
- Archive old evaluations (move to BigQuery)

---

## 📈 Performance Targets (SLO)

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| **Evaluator Latency (P95)** | < 250ms | > 500ms |
| **PDF Generation Time** | < 3s | > 10s |
| **API Response Time (P95)** | < 500ms | > 1s |
| **False Positive Rate** | < 5% | > 10% |
| **Flagged Output Rate** | < 10% | > 15% |

---

## 🔄 Rollback Procedures

### Rollback Functions
```bash
# List recent deployments
firebase functions:log --limit 10

# Rollback to previous version
firebase deploy --only functions --version PREVIOUS_VERSION
```

### Rollback Firestore Rules
```bash
# View rule history in Firebase Console
# Rules → History → Restore previous version
```

### Feature Flag Kill Switch
```bash
# Hide AI Governance dashboard in admin nav
# Edit src/app/(admin)/_components/AdminNav.tsx
# Comment out AI Governance link temporarily
```

---

## 🧪 Canary Deployment Strategy

For safer production rollouts:

1. **Deploy to staging first:**
   ```bash
   firebase use staging
   firebase deploy --only functions:logAiEval,functions:createAIGovernanceReport
   ```

2. **Test with small user sample** (use feature flag)

3. **Monitor for 24 hours:**
   - Check Cloud Logging for errors
   - Verify flagged rate stays < 10%
   - Test PDF generation

4. **Deploy to production:**
   ```bash
   firebase use production
   firebase deploy --only functions:logAiEval,functions:createAIGovernanceReport
   ```

---

## 📝 Post-Deployment Checklist

After deploying Sprint 13, verify:

- [ ] Functions deployed successfully
- [ ] Firestore rules updated
- [ ] Environment variables configured
- [ ] HMAC secret set in Functions config
- [ ] Admin user has `admin: true` custom claim
- [ ] Test AI evaluation logging works
- [ ] Test Admin API endpoints (summary, recent)
- [ ] Test AI Governance dashboard loads
- [ ] Test PDF report generation
- [ ] Cloud Logging shows no errors
- [ ] Storage bucket has correct permissions
- [ ] GitHub Actions workflows passing (if using CI/CD)

---

## 🔗 Related Documentation

- [Sprint 13 Summary](./SPRINT-13-SUMMARY.md) - Technical reference
- [Sprint 13 Testing Guide](./SPRINT-13-TESTING.md) - Test scenarios
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

## 📞 Support & Escalation

**Common Issues:**
1. Check this runbook first
2. Review Cloud Logging for errors
3. Verify environment variables
4. Test with clean browser/incognito mode (token refresh)

**Escalation:**
- Firebase Support: https://firebase.google.com/support
- GitHub Issues: https://github.com/YOUR_ORG/from-zero-starter/issues

---

## ✈️ Production Pre-Flight Checklist

Run this checklist before deploying Sprint 13 to production:

### Configuration
- [ ] **Firestore Config Document**: `config/ai_governance` exists with default values OR will be created via API on first call
  ```bash
  # Optional: Pre-create via Firebase Console or API
  {
    "enabled": true,
    "sampleRate": 0.1,  // Start with 10% sampling
    "thresholds": {
      "toxicity": 50,
      "bias": 30
    },
    "alertFlagRatePct": 10
  }
  ```

- [ ] **Functions Config**: HMAC secret is set
  ```bash
  firebase functions:config:get reports.hmac_secret
  # Should return: YOUR_SECRET_VALUE
  ```

- [ ] **Alert Webhook** (optional): Configured for Slack or Discord
  ```bash
  firebase functions:config:get alerts.slack_webhook
  # OR
  firebase functions:config:get alerts.discord_webhook
  ```

### Security
- [ ] **Firestore Rules**: Deployed with Sprint 13 rules
  ```bash
  firebase deploy --only firestore:rules
  # Verify: config/ai_governance and ai_evals rules present
  ```

- [ ] **Admin Claim**: Your account has admin privileges
  ```bash
  # Method 1: Firebase Console → Authentication → User → Custom Claims
  # Method 2: Firebase CLI
  firebase auth:export users.json
  cat users.json | jq '.users[] | select(.email=="YOUR_EMAIL") | .customClaims'
  # Expected: {"admin": true}
  ```

- [ ] **Admin API Test**: Can access governance endpoints
  ```bash
  # Get your admin ID token (browser console)
  const token = await firebase.auth().currentUser.getIdToken();

  # Test API
  curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    https://YOUR_DOMAIN/api/admin/ai-evals/summary
  # Expected: 200 OK with {"total": 0, ...} or actual data
  ```

### Storage
- [ ] **Cloud Storage Bucket**: Functions have write permissions
  ```bash
  # Verify service account has storage.objectAdmin role
  gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:YOUR_PROJECT_ID@appspot.gserviceaccount.com"
  ```

- [ ] **Bucket Lifecycle** (optional): Reports cleaned by job, but can set lifecycle policy
  ```bash
  # Optional: Set 30-day lifecycle on reports/
  gsutil lifecycle set lifecycle.json gs://YOUR_BUCKET
  ```

### Functions
- [ ] **All 4 Functions Deployed**: No errors in deployment
  ```bash
  firebase deploy --only functions:logAiEval,functions:createAIGovernanceReport,functions:aiGovCleanup,functions:aiGovFlagRateAlert
  ```

- [ ] **Function Logs**: Accessible in Cloud Console
  ```bash
  # Check recent logs
  gcloud functions logs read logAiEval --limit 10
  ```

- [ ] **Scheduled Jobs**: Verify schedules are active
  ```bash
  firebase functions:list | grep -E "aiGovCleanup|aiGovFlagRateAlert"
  # Expected: Both listed with schedule info
  ```

### Retention Policy
- [ ] **Default Retention Rule**: Add to retention policies panel
  ```json
  {
    "collection": "ai_evals_runs",
    "days": 30,
    "autoClean": true
  }
  ```
  This ensures cleanup job has a default value in production.

### Observability
- [ ] **Cloud Logging Filters**: Bookmarked for quick access
  ```
  resource.type="cloud_function"
  ("logAiEval" OR "createAIGovernanceReport" OR "aiGovCleanup" OR "aiGovFlagRateAlert")
  severity>=ERROR
  ```

- [ ] **Alert Channels**: Slack/Discord webhooks tested
  ```bash
  # Test webhook manually
  curl -X POST YOUR_WEBHOOK_URL \
    -H "Content-Type: application/json" \
    -d '{"text": "Test alert from AI Governance setup"}'
  ```

### Testing
- [ ] **Smoke Test 1**: Log single evaluation (see SPRINT-13-TESTING.md Test 1)
- [ ] **Smoke Test 2**: Admin summary API returns data (Test 5)
- [ ] **Smoke Test 3**: Dashboard loads without errors (Test 7)
- [ ] **Smoke Test 4**: PDF report generates successfully (Test 8)

### Documentation
- [ ] **Team Onboarding**: Internal docs updated with AI Governance info
- [ ] **Runbook Access**: Ops team has access to SPRINT-13-DEPLOYMENT.md
- [ ] **Changelog**: Updated with v13.0.0 entry

---

## 🔍 Observability Quick Filters

### Cloud Logging

Copy these filters to your Cloud Console for quick debugging:

**All AI Governance Functions:**
```
resource.type="cloud_function"
("logAiEval" OR "createAIGovernanceReport" OR "aiGovCleanup" OR "aiGovFlagRateAlert")
```

**Errors Only:**
```
resource.type="cloud_function"
("logAiEval" OR "createAIGovernanceReport" OR "aiGovCleanup" OR "aiGovFlagRateAlert")
severity>=ERROR
```

**Flagged Outputs (Info Level):**
```
resource.type="cloud_function"
"logAiEval"
severity=INFO
"flagged": true
```

**Sampled Out (Debug):**
```
resource.type="cloud_function"
"logAiEval"
"sampledOut"
```

**Cleanup Job Runs:**
```
resource.type="cloud_function"
"aiGovCleanup"
"Starting AI Governance cleanup"
```

**Alert Job Triggers:**
```
resource.type="cloud_function"
"aiGovFlagRateAlert"
"Flag rate"
```

### Firestore Monitoring

```bash
# Monitor write operations to ai_evals
gcloud firestore operations list --filter="ai_evals"

# Check collection size
gcloud firestore indexes composite list
```

### Storage Monitoring

```bash
# Check reports/ directory size
gsutil du -sh gs://YOUR_BUCKET/reports/

# List recent reports
gsutil ls -l gs://YOUR_BUCKET/reports/ | tail -n 10
```
