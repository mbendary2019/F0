# 🚀 Production Deployment Checklist

## 📋 Pre-Launch Security & Configuration

### 1. Environment Variables

#### **apps/web/.env.local** (Development)
```env
# F0 Orchestrator
NEXT_PUBLIC_F0_BASE=http://localhost:8787
F0_API_KEY=40553a48faf4ab1e9f77670df6444229535be8ff7ad4d511d3ee0d87ce1a936a

# Stripe (Test Mode)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_1SH2QsLYNFMhXeTeuOtumXG9
SUB_PRICE_USD=29
FZ_RATE_PER_USD=1

# Firebase Client-Side
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBhDfrCv_uqu-rs4WNH0Kav2BMK4xD4j4k
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=from-zero-84253.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=from-zero-84253
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=from-zero-84253.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=39741106357
NEXT_PUBLIC_FIREBASE_APP_ID=1:39741106357:web:709d5ce8639e63d21cb6fc
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-DGHKQEJGBC

# Firebase Admin (Server-Side)
FIREBASE_PROJECT_ID=from-zero-84253
GOOGLE_APPLICATION_CREDENTIALS=/Users/abdo/.secrets/firebase.json

# OpenAI
OPENAI_API_KEY=sk-proj-...
```

#### **Production .env** (Replace with Production Keys)
```env
# ⚠️ IMPORTANT: Replace ALL test/dev keys before going live!

# F0 Orchestrator (Production URL)
NEXT_PUBLIC_F0_BASE=https://api.fromzero.ai  # Or your production domain
F0_API_KEY=<GENERATE_NEW_PRODUCTION_KEY>     # ⚠️ Rotate!

# Stripe (Production Mode - NOT Test!)
STRIPE_PUBLIC_KEY=pk_live_...                # ⚠️ Live key
STRIPE_SECRET_KEY=sk_live_...                # ⚠️ Live key
STRIPE_WEBHOOK_SECRET=whsec_...              # ⚠️ From production webhook
STRIPE_PRICE_MONTHLY=price_PRODUCTION_ID     # ⚠️ Production price

# Firebase (Production project)
NEXT_PUBLIC_FIREBASE_API_KEY=...             # ⚠️ Production Firebase
# ... (all Firebase keys from production project)

# OpenAI (Production - with usage limits)
OPENAI_API_KEY=sk-...                        # ⚠️ Production key with rate limits
```

---

### 2. Firestore Security Rules

#### **Deploy Secure Rules:**
```bash
# Review firestore.rules.secure first!
cp firestore.rules.secure firestore.rules

# Deploy to Firebase
firebase deploy --only firestore:rules --project from-zero-84253
```

#### **Key Security Principles:**
- ✅ **Default deny all:** `allow read, write: if false`
- ✅ **User isolation:** Users can only access their own data
- ✅ **Admin-only collections:** Protected by custom claims
- ✅ **Function-only writes:** Sensitive collections (RL, predictions, anomalies)
- ✅ **No public writes:** Ever!

#### **Test Rules Locally:**
```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Run tests
firebase emulators:exec --only firestore "npm run test:firestore-rules"
```

---

### 3. API Key Rotation Strategy

#### **Before Production:**
```bash
# 1. Generate new F0 API key
openssl rand -hex 32

# 2. Generate new Stripe webhook secret
# Go to: https://dashboard.stripe.com/webhooks
# Create production webhook → Get signing secret

# 3. Rotate OpenAI key
# Go to: https://platform.openai.com/api-keys
# Create new production key with usage limits

# 4. Firebase service account
# Download new production service account JSON
# Store in secure location (NOT in repo)
```

#### **Key Management Best Practices:**
- 🔐 Store in **GitHub Secrets** for CI/CD
- 🔐 Use **environment variables** (never hardcode)
- 🔐 Rotate keys **every 90 days**
- 🔐 Revoke old keys **immediately after rotation**
- 🔐 Monitor usage via logs and alerts

---

### 4. Stripe Webhook Configuration

#### **Development (CLI):**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

#### **Production (Dashboard):**
1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Enter URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy **Signing secret** → Add to production `.env`

#### **Verify Webhook:**
```bash
# Send test event from dashboard
# Check Next.js logs for successful processing
```

---

### 5. Logging & Monitoring

#### **Web App Logging:**

**Create: `src/lib/logger.ts`**
```typescript
import * as Sentry from '@sentry/nextjs';

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta);
    Sentry.addBreadcrumb({ message, level: 'info', data: meta });
  },
  
  error: (message: string, error?: Error, meta?: any) => {
    console.error(`[ERROR] ${message}`, error, meta);
    Sentry.captureException(error || new Error(message), { extra: meta });
  },
  
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta);
    Sentry.addBreadcrumb({ message, level: 'warning', data: meta });
  },
};
```

**Update API routes to use logger:**
```typescript
// Example: src/app/api/tasks/route.ts
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Fetching tasks from F0');
    // ... fetch logic
    logger.info(`Fetched ${tasks.length} tasks`);
    return NextResponse.json({ ok: true, tasks });
  } catch (error) {
    logger.error('Failed to fetch tasks', error as Error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
```

#### **Orchestrator Logging:**

**Create: `orchestrator/src/logger.ts`**
```typescript
export const logger = {
  info: (msg: string, meta?: any) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`, meta || ''),
  error: (msg: string, err?: any) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, err || ''),
  warn: (msg: string, meta?: any) => console.warn(`[${new Date().toISOString()}] WARN: ${msg}`, meta || ''),
};
```

#### **Sentry Integration:**
```bash
# Already configured in sentry.config.js
# Verify DSN is set in production .env
```

---

### 6. Rate Limiting

#### **Add Rate Limiting Middleware:**

**Create: `src/middleware/rateLimit.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT = 100; // requests per minute
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return null; // Allow
  }
  
  if (record.count >= RATE_LIMIT) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  record.count++;
  return null;
}
```

**Apply to API routes:**
```typescript
// src/app/api/tasks/run/route.ts
import { rateLimit } from '@/middleware/rateLimit';

export async function POST(req: NextRequest) {
  const rateLimitResponse = rateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;
  
  // ... rest of handler
}
```

---

## 🧪 3-Task Demo (Batch Test)

### Run All 3 Tasks:

```bash
# Task 1: README Documentation
curl -s -X POST http://localhost:3000/api/tasks/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a 5-line README for From Zero platform (EN/AR).","tags":["docs","demo"]}'

# Task 2: Next.js Page
curl -s -X POST http://localhost:3000/api/tasks/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a minimal Next.js page /hello-world with a bilingual heading and a link back to /.","tags":["web","ui"]}'

# Task 3: Flutter Widget
curl -s -X POST http://localhost:3000/api/tasks/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Generate a Flutter widget HelloCard(title: \"مرحبا | Hello\", subtitle: \"From Zero\" ) using Material.","tags":["mobile","dart"]}'

echo ""
echo "✅ 3 tasks created!"
echo "Open http://localhost:3000/tasks to watch them execute!"
```

---

## 🚀 Deployment Steps

### 1. Pre-Deploy Checks

```bash
# ✅ Check environment variables
grep -E "^(NEXT_PUBLIC_|STRIPE_|FIREBASE_|OPENAI_)" .env.local

# ✅ Verify Firestore rules
firebase deploy --only firestore:rules --dry-run

# ✅ Run linter
pnpm run lint

# ✅ Run type check
pnpm run typecheck

# ✅ Build production bundle
pnpm run build

# ✅ Test production build locally
pnpm run start
```

### 2. Deploy to Firebase Hosting

```bash
# Deploy web app
firebase deploy --only hosting --project from-zero-84253

# Deploy functions (if any updates)
firebase deploy --only functions --project from-zero-84253

# Deploy Firestore rules
firebase deploy --only firestore:rules --project from-zero-84253
```

### 3. Deploy Orchestrator

```bash
# If using a VM/server:
cd orchestrator
pnpm run build
pm2 start npm --name "f0-orchestrator" -- start

# If using Docker:
docker build -t f0-orchestrator .
docker run -d -p 8787:8787 --env-file .env f0-orchestrator
```

### 4. Post-Deploy Verification

```bash
# ✅ Check web app
curl -s https://your-domain.com/api/tasks | jq

# ✅ Check Orchestrator
curl -s https://api.your-domain.com/readyz | jq

# ✅ Test Stripe webhook
# Send test event from Stripe Dashboard

# ✅ Check Sentry
# Visit: https://sentry.io/organizations/your-org/projects/

# ✅ Monitor logs
# Check Firebase Console → Functions → Logs
# Check Orchestrator logs via pm2 or Docker
```

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor:

1. **API Response Times**
   - `/api/tasks` < 500ms
   - `/api/checkout` < 2s
   - F0 Orchestrator < 1s

2. **Error Rates**
   - < 0.5% for all endpoints
   - < 1% for Stripe webhooks

3. **Task Success Rate**
   - > 95% tasks complete successfully

4. **User FZ Balances**
   - Monitor for anomalies (e.g., sudden spikes)

5. **Stripe Payments**
   - Monitor failed payments
   - Track subscription churn

### Setup Alerts:

```typescript
// Example: Alert on high error rate
// Add to your monitoring service (Sentry, Datadog, etc.)
```

---

## 🔒 Security Hardening (Final Checklist)

- [ ] **All API keys rotated** (F0, Stripe, OpenAI, Firebase)
- [ ] **Firestore rules deployed** (default deny all)
- [ ] **Rate limiting enabled** on all public endpoints
- [ ] **CORS configured** (whitelist production domains only)
- [ ] **CSP headers** enabled (strict Content Security Policy)
- [ ] **HTTPS enforced** (redirect HTTP to HTTPS)
- [ ] **Secrets stored securely** (GitHub Secrets, env vars, not in code)
- [ ] **Logging enabled** (Sentry, Console, Firebase)
- [ ] **Monitoring active** (Sentry, Firebase Console)
- [ ] **Webhook signature verification** (Stripe)
- [ ] **Input validation** on all API routes (Zod schemas)
- [ ] **SQL injection protection** (N/A for Firestore, but good practice)
- [ ] **XSS protection** (React auto-escapes, but validate user inputs)
- [ ] **CSRF protection** (Next.js built-in for API routes)
- [ ] **DDoS protection** (Cloudflare, rate limiting)

---

## 📝 Final Notes

### API Key Rotation Schedule:
- **Every 90 days:** Rotate all keys
- **After team member leaves:** Rotate immediately
- **After suspected breach:** Rotate immediately

### Backup Strategy:
- **Firestore:** Auto-backup enabled (Firebase Console)
- **Code:** GitHub (private repo)
- **Secrets:** Secure password manager (1Password, etc.)

### Support & Escalation:
- **On-call engineer:** Define on-call rotation
- **Incident response:** Document procedures
- **Rollback plan:** Keep previous deployment ready

---

**Status:** Ready for Production 🚀

**Last Updated:** October 11, 2025


