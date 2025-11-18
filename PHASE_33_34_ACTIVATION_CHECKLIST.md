# ✅ Phase 33.3/34 Activation Checklist

**Project:** F0 Platform  
**Phase:** 33.3/34 - Extensions, Auto-Publish, Billing v2, License Keys  
**Date:** October 11, 2025

---

## 📋 Pre-Activation Setup

### 1. Environment Setup

- [ ] Create `.env.local` with all required variables
- [ ] Move Firebase service account to `~/.secrets/firebase.json`
- [ ] Export environment variables in `~/.zshrc`
- [ ] Install dependencies: `pnpm install`
- [ ] Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
- [ ] Install Firebase CLI: `npm install -g firebase-tools`

### 2. Firebase Configuration

- [ ] Enable Firestore API in Google Cloud Console
- [ ] Create Firestore database (Native mode)
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Enable Firebase Auth
- [ ] Add admin custom claims to your user
- [ ] Test Firestore connection

### 3. Stripe Configuration

- [ ] Create Stripe account (or use existing)
- [ ] Switch to **Test Mode**
- [ ] Create products:
  - [ ] F0 Free ($0)
  - [ ] F0 Pro ($29/mo)
  - [ ] F0 Team ($99/mo)
- [ ] Create recurring prices for each product
- [ ] Copy Price IDs to `.env.local`
- [ ] Set up webhook endpoint (Stripe Dashboard)
- [ ] Copy webhook signing secret
- [ ] Test webhook with Stripe CLI

---

## 🔧 Component Activation

### 1. Extensions Platform ✅

#### File Checklist:
- [ ] `f0/extensions/manifest.schema.json`
- [ ] `f0/extensions/registry.json`
- [ ] `f0/extensions/examples/firebase.deploy.json`
- [ ] `f0/extensions/examples/stripe.billing.json`
- [ ] `orchestrator/src/extensions/index.ts`
- [ ] `orchestrator/src/extensions/types.ts`
- [ ] `orchestrator/src/extensions/sandbox.ts`
- [ ] `orchestrator/src/extensions/validators/jsonschema.ts`
- [ ] `orchestrator/src/extensions/runners/http.ts`
- [ ] `orchestrator/src/extensions/runners/cli.ts`

#### Testing:
```bash
# Test extension loading
curl -X POST http://localhost:8787/api/extensions/load \
  -H "Content-Type: application/json" \
  -d @f0/extensions/examples/firebase.deploy.json | jq

# Test extension execution (requires FIREBASE_TOKEN)
export FIREBASE_TOKEN=your_token_here
curl -X POST http://localhost:8787/api/extensions/run \
  -H "Content-Type: application/json" \
  -H "x-f0-key: $F0_API_KEY" \
  -d '{
    "extension": "firebase-deploy",
    "inputs": {
      "projectId": "from-zero-84253",
      "only": "hosting"
    },
    "secrets": {
      "token": "'$FIREBASE_TOKEN'"
    }
  }' | jq
```

- [ ] Extension loads successfully
- [ ] Sandbox created without errors
- [ ] CLI runner executes whitelisted commands
- [ ] HTTP runner makes API calls
- [ ] Template variables replaced correctly
- [ ] Audit trail logged

---

### 2. Auto-Publish ✅

#### File Checklist:
- [ ] `f0.project.schema.json`
- [ ] `f0.project.example.json`
- [ ] `orchestrator/src/deployers/firebase.ts`
- [ ] `orchestrator/src/deployers/vercel.ts`
- [ ] `orchestrator/src/deployers/index.ts`

#### Testing:
```bash
# Test Firebase deployer
curl -X POST http://localhost:8787/api/deploy/firebase \
  -H "Content-Type: application/json" \
  -H "x-f0-key: $F0_API_KEY" \
  -d '{
    "projectId": "from-zero-84253",
    "token": "'$FIREBASE_TOKEN'",
    "only": "hosting"
  }' | jq

# Test project config loading
curl -X POST http://localhost:8787/api/deploy/project \
  -H "Content-Type: application/json" \
  -H "x-f0-key: $F0_API_KEY" \
  -d @f0.project.example.json | jq
```

- [ ] Firebase deployer works
- [ ] Vercel deployer works (if configured)
- [ ] Project config validates
- [ ] Deploy steps execute in order
- [ ] Deploy job queued in Firestore
- [ ] Deploy status tracked

---

### 3. Billing v2 (Credits) ✅

#### File Checklist:
- [ ] `src/lib/billing/types.ts`
- [ ] `src/lib/billing/credits.ts`
- [ ] `src/lib/billing/webhook.ts`
- [ ] `src/app/api/billing/credits/route.ts`
- [ ] `src/app/api/webhooks/stripe/route.ts` (update with new webhook handler)

#### Testing:
```bash
# Get credits balance
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/billing/credits | jq

# Consume credits
curl -X POST -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sinkId":"generate.code","quantity":5}' \
  http://localhost:3000/api/billing/credits | jq

# Test Stripe webhook (via CLI)
stripe trigger checkout.session.completed
```

- [ ] User credits fetched
- [ ] Credits consumed successfully
- [ ] Insufficient credits returns 402
- [ ] Usage logged to Firestore
- [ ] Stripe webhook processes events
- [ ] Credits refilled on subscription
- [ ] Plan updated correctly

---

### 4. License Keys ✅

#### File Checklist:
- [ ] `src/lib/license/types.ts`
- [ ] `src/lib/license/generator.ts`
- [ ] `src/lib/license/manager.ts`
- [ ] `src/lib/license/signature.ts`
- [ ] `src/app/api/license/issue/route.ts`
- [ ] `src/app/api/license/activate/route.ts`
- [ ] `src/app/api/license/validate/route.ts`
- [ ] `src/app/api/license/revoke/route.ts`

#### Testing:
```bash
# Issue license (admin only)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "pro",
    "seats": 5,
    "issuedTo": "user123",
    "expiresAt": 1760000000000
  }' \
  http://localhost:3000/api/license/issue | jq

# Save the license key from response
export LICENSE_KEY="F0-PRO-XXXXXX-XXXXXX-XXXXXX"

# Activate license
curl -X POST -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "'$LICENSE_KEY'",
    "deviceId": "my-macbook-pro"
  }' \
  http://localhost:3000/api/license/activate | jq

# Validate license
curl -X POST -H "Content-Type: application/json" \
  -d '{"key": "'$LICENSE_KEY'"}' \
  http://localhost:3000/api/license/validate | jq

# Revoke license (admin only)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "'$LICENSE_KEY'",
    "reason": "Test revocation"
  }' \
  http://localhost:3000/api/license/revoke | jq
```

- [ ] License generated with correct format
- [ ] License activated on device
- [ ] Activation receipt signed
- [ ] License validates online
- [ ] Offline validation works (with receipt)
- [ ] Grace period respected
- [ ] Max activations enforced
- [ ] License revoked successfully

---

## 🔐 Security Verification

### Firestore Rules

```bash
# Deploy secure rules
cp firestore.rules.phase34.secure firestore.rules
firebase deploy --only firestore:rules --project from-zero-84253

# Test rules with emulator
firebase emulators:start --only firestore
```

- [ ] Default deny all works
- [ ] Users can only read/write their own data
- [ ] Admin-only collections protected
- [ ] License activations restricted
- [ ] Credits can't be modified directly
- [ ] Deploy jobs are user-scoped

### API Authorization

Test without token:
```bash
curl http://localhost:3000/api/billing/credits | jq
# Expected: {"ok": false, "error": "Unauthorized"} (401)

curl -X POST http://localhost:3000/api/license/issue \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro","seats":1,"issuedTo":"test"}' | jq
# Expected: {"ok": false, "error": "Unauthorized"} (401)
```

- [ ] Unauthorized requests return 401
- [ ] Non-admin requests to admin routes return 403
- [ ] Invalid tokens rejected
- [ ] Rate limiting works (if implemented)

---

## 📊 Integration Testing

### Full Flow Test

```bash
# 1. Create user and get token
export USER_TOKEN=$(curl -X POST http://localhost:3000/api/auth/token ... | jq -r '.token')

# 2. Check initial credits (should be 1000 for free plan)
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/billing/credits | jq

# 3. Consume some credits
curl -X POST -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sinkId":"generate.code","quantity":10}' \
  http://localhost:3000/api/billing/credits | jq

# 4. Run extension (consumes 25 credits)
curl -X POST -H "Authorization: Bearer $USER_TOKEN" \
  -H "x-f0-key: $F0_API_KEY" \
  -d '{"extension":"firebase-deploy","inputs":{...}}' \
  http://localhost:8787/api/extensions/run | jq

# 5. Check updated credits
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/billing/credits | jq

# 6. Upgrade to Pro (via Stripe checkout)
# ... complete checkout ...

# 7. Verify credits refilled to 25,000
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/billing/credits | jq

# 8. Issue license (as admin)
export ADMIN_TOKEN=...
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro","seats":5,"issuedTo":"'$USER_ID'"}' \
  http://localhost:3000/api/license/issue | jq

# 9. Activate license
export LICENSE_KEY="F0-PRO-..."
curl -X POST -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"'$LICENSE_KEY'","deviceId":"test-device"}' \
  http://localhost:3000/api/license/activate | jq
```

- [ ] All steps complete without errors
- [ ] Credits tracked correctly
- [ ] Subscriptions work end-to-end
- [ ] Licenses integrate with billing

---

## 🚀 Production Deployment

### Pre-Deployment

- [ ] All tests passing
- [ ] Secrets rotated to production keys
- [ ] Stripe in LIVE mode
- [ ] Firebase production project
- [ ] Ed25519 keys generated for licenses
- [ ] WAF rules configured
- [ ] Monitoring enabled (Sentry)
- [ ] Backup strategy in place

### Deployment Steps

```bash
# 1. Build production
pnpm run build

# 2. Deploy Firestore rules
firebase deploy --only firestore:rules --project PROD_PROJECT

# 3. Deploy Functions
firebase deploy --only functions --project PROD_PROJECT

# 4. Deploy Hosting
firebase deploy --only hosting --project PROD_PROJECT

# 5. Verify deployment
curl https://your-domain.com/api/billing/credits
```

- [ ] Production build successful
- [ ] All services deployed
- [ ] Health checks passing
- [ ] Monitoring active
- [ ] Logs flowing to Sentry

---

## 📈 Post-Activation Monitoring

### Metrics to Watch

- [ ] Extension execution success rate > 95%
- [ ] Deploy success rate > 90%
- [ ] API response times < 500ms (p95)
- [ ] Credit consumption patterns normal
- [ ] License activation rate tracking
- [ ] Stripe webhook success rate > 99%

### Alerts to Configure

- [ ] High credit consumption (>80% in < 7 days)
- [ ] Failed deploys (> 3 consecutive)
- [ ] License activation failures (> 10%)
- [ ] Stripe webhook failures
- [ ] API error rate > 1%
- [ ] Firestore quota approaching limit

---

## ✅ Final Checklist

- [ ] All 4 systems functional
- [ ] Security rules deployed
- [ ] API routes working
- [ ] Integration tests passing
- [ ] Documentation complete
- [ ] Team trained on new features
- [ ] Support runbooks created
- [ ] Rollback plan documented
- [ ] Production deployment successful
- [ ] Monitoring configured

---

**Sign-off:**

- [ ] **Tech Lead:** _____________________ Date: _______
- [ ] **Security:** _____________________ Date: _______
- [ ] **QA:** _____________________ Date: _______
- [ ] **Product:** _____________________ Date: _______

---

**Status:** ✅ Ready for Production  
**Version:** 1.0.0  
**Last Updated:** October 11, 2025


