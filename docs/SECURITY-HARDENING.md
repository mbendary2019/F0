# Security Hardening & Custom Claims

**Sprint 6**: Complete security hardening implementation with custom claims, route protection, rate limiting, and audit logging.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Custom Claims Sync](#custom-claims-sync)
4. [Authentication Helper](#authentication-helper)
5. [Middleware Protection](#middleware-protection)
6. [Rate Limiting](#rate-limiting)
7. [Audit Logging](#audit-logging)
8. [Protected Routes Example](#protected-routes-example)
9. [Firestore Security Rules](#firestore-security-rules)
10. [Environment Variables](#environment-variables)
11. [Deployment](#deployment)
12. [Testing](#testing)
13. [Monitoring](#monitoring)

---

## Overview

This sprint implements a comprehensive security stack that protects your application at multiple layers:

### Security Layers

```
┌─────────────────────────────────────────────────┐
│  1. Edge Middleware (Lightweight Check)        │
│     - Redirects unauthenticated users           │
│     - No signature verification (fast)          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. API Route (Full Verification)               │
│     - Token signature verification              │
│     - Custom claims check (sub_active, tier)    │
│     - Subscription expiry check                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. Rate Limiting                               │
│     - Redis (Upstash) - Production              │
│     - Firestore - Development fallback          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  4. Business Logic                              │
│     - Execute protected operation               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  5. Audit Logging                               │
│     - Log all requests (success/failure)        │
│     - Track rate limits, latency, errors        │
└─────────────────────────────────────────────────┘
```

### Key Features

✅ **Custom Claims**: Subscription data synced to Firebase Auth claims
✅ **Fast Authorization**: Check claims without Firestore reads
✅ **Route Protection**: Middleware + API-level guards
✅ **Rate Limiting**: Prevent abuse with Redis or Firestore
✅ **Audit Logs**: Track all requests with minimal PII
✅ **Firestore Rules**: Deny client writes to protected data

---

## Architecture

### Custom Claims Flow

```
Stripe Webhook
     ↓
Update users/{uid}.entitlements (Firestore)
     ↓
Cloud Function: syncClaimsOnEntitlementsWrite
     ↓
Update Firebase Auth Custom Claims
  {
    sub_active: boolean,
    sub_tier: string,
    sub_exp: number
  }
     ↓
Client refreshes ID Token
     ↓
New ID Token includes claims (no Firestore read needed)
```

### Request Flow

```
Client Request → Middleware → API Route → Business Logic
                    ↓             ↓            ↓
                 Quick         assertAuth   Execute
                 Check         + Claims     Operation
                              + Rate Limit
                              + Audit Log
```

---

## Custom Claims Sync

### Cloud Function

File: `functions/src/claims.ts`

```typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export const syncClaimsOnEntitlementsWrite = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid as string;
    const after = change.after.exists ? change.after.data() : null;

    if (!after) {
      await admin.auth().setCustomUserClaims(uid, {
        sub_active: false,
        sub_tier: "free",
        sub_exp: null,
      });
      return;
    }

    const ent = after.entitlements;

    const sub_active = !!ent?.active;
    const sub_tier = (ent?.tier || "free").toLowerCase();
    let sub_exp: number | null = null;

    if (ent?.periodEnd) {
      if (typeof ent.periodEnd._seconds === "number") {
        sub_exp = ent.periodEnd._seconds;
      } else if (ent.periodEnd.seconds) {
        sub_exp = ent.periodEnd.seconds;
      }
    }

    await admin.auth().setCustomUserClaims(uid, {
      sub_active,
      sub_tier,
      sub_exp,
    });
  });
```

### Deploy Function

```bash
cd functions
npm run deploy
```

### Client-Side: Refresh Token

After subscription change, client must refresh token:

```typescript
import { auth } from "@/lib/firebase";

// Force token refresh to get updated claims
await auth.currentUser?.getIdToken(true);

// Now token includes new claims
const token = await auth.currentUser?.getIdToken();
```

---

## Authentication Helper

File: `src/server/authAssert.ts`

### Usage

```typescript
import { assertAuth } from "@/server/authAssert";

// Require any authenticated user
const auth = await assertAuth(request);

// Require active subscription
const auth = await assertAuth(request, { requireActive: true });

// Require specific tier
const auth = await assertAuth(request, { tiers: ["pro"] });

// Require pro or enterprise
const auth = await assertAuth(request, { tiers: ["pro", "enterprise"] });

if (!auth.ok) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status }
  );
}

// Use auth.uid and auth.claims
console.log(`User ${auth.uid} with tier ${auth.claims.sub_tier}`);
```

### Response Types

#### Success
```typescript
{
  ok: true,
  uid: string,
  claims: {
    sub_active: boolean,
    sub_tier: string,
    sub_exp: number | null
  }
}
```

#### Error
```typescript
{
  ok: false,
  status: 401 | 402 | 403,
  error: string
}
```

**Status Codes:**
- `401` - Missing/invalid token
- `402` - Payment required (inactive subscription or expired)
- `403` - Forbidden (wrong tier)

---

## Middleware Protection

File: `src/middleware.ts`

### Configuration

```typescript
export const config = {
  matcher: [
    "/pro/:path*",       // Pro features
    "/api/pro/:path*",   // Pro API
    "/account/:path*",   // Account pages
    "/admin/:path*",     // Admin pages
  ],
};
```

### Behavior

- **Public paths**: Always allowed (/, /auth, /pricing, etc.)
- **Protected paths**: Require authentication token presence
- **API routes**: Return 401 JSON response
- **Page routes**: Redirect to /auth with ?next= parameter

### Limitations

⚠️ **Edge middleware cannot verify token signatures**
⚠️ **Cannot check custom claims in middleware**
✅ **Only checks for token presence (fast)**
✅ **Full verification happens in API routes**

---

## Rate Limiting

### Upstash Redis (Recommended)

**Install:**
```bash
npm i @upstash/ratelimit @upstash/redis
```

**Environment:**
```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_POINTS=60
RATE_LIMIT_DURATION_SECONDS=60
```

**Usage:**
```typescript
import { limitOrNull } from "@/server/rateLimit";

const rl = await limitOrNull(`api:endpoint:${uid}`);

if (rl && !rl.ok) {
  return NextResponse.json(
    {
      error: "Too many requests",
      resetAt: new Date(rl.reset!).toISOString(),
      remaining: rl.remaining,
    },
    { status: 429 }
  );
}
```

### Firestore Fallback

**Usage:**
```typescript
import { limitFs } from "@/server/rateLimitFirestore";

try {
  const result = await limitFs(`api:task:${uid}`, 60, 60);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }
} catch (error) {
  // Handle error
}
```

### Rate Limit Strategies

**Per-User:**
```typescript
const key = `api:endpoint:${uid}`;
```

**Per-IP:**
```typescript
const ip = req.headers.get("x-forwarded-for")?.split(",")[0];
const key = `api:endpoint:${ip}`;
```

**Per-User-Per-IP (Most Secure):**
```typescript
const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "noip";
const key = `api:endpoint:${uid}:${ip}`;
```

### Cleanup (Firestore Only)

Add to Cloud Scheduler or cron:

```typescript
import { cleanupExpiredRateLimits } from "@/server/rateLimitFirestore";

// Delete rate limits older than 1 hour
await cleanupExpiredRateLimits(60);
```

---

## Audit Logging

File: `src/server/audit.ts`

### Enable Logging

```bash
AUDIT_LOGS_ENABLED=1
AUDIT_IP_HASH_SECRET=your-random-secret-here
```

### Usage

```typescript
import { logAudit } from "@/server/audit";

await logAudit({
  uid: auth.uid,
  path: "/api/pro/task",
  method: "POST",
  status: 200,
  ok: true,
  ip: req.headers.get("x-forwarded-for"),
  ua: req.headers.get("user-agent"),
  latency_ms: Date.now() - t0,
  claims: auth.claims,
  rl: { remaining: rl.remaining, reset: rl.reset },
});
```

### Log Schema

```typescript
{
  ts: Timestamp,              // Request timestamp
  uid: string | null,         // User ID
  path: string,               // API path
  method: string,             // HTTP method
  status: number,             // HTTP status code
  ok: boolean,                // Success/failure
  ip_hash: string | null,     // HMAC(IP, secret)
  ua: string | null,          // User agent (truncated)
  latency_ms: number,         // Request latency
  claims: {                   // Sanitized claims
    sub_active: boolean,
    sub_tier: string
  } | null,
  rl: {                       // Rate limit info
    remaining: number,
    reset: number
  } | null,
  err_code: string | null,    // Error code
  metadata: object | null     // Custom metadata
}
```

### Privacy Features

✅ **IP Hashing**: IPs are HMAC-hashed, not stored raw
✅ **Claims Sanitization**: Only subscription data logged
✅ **UA Truncation**: User agents limited to 200 chars
✅ **No PII**: Email, names, passwords never logged

### Query Logs

```typescript
import { queryAuditLogs, getAuditStats } from "@/server/audit";

// Get user's recent logs
const logs = await queryAuditLogs({
  uid: "user123",
  limit: 50,
});

// Get statistics
const stats = await getAuditStats("user123");
// { total: 150, success: 140, errors: 5, rateLimited: 5 }
```

### Firestore Indexes

Create these composite indexes:

1. **Collection:** `audit_logs`
   - Fields: `uid` (Ascending), `ts` (Descending)

2. **Collection:** `audit_logs`
   - Fields: `path` (Ascending), `ts` (Descending)

3. **Collection:** `audit_logs`
   - Fields: `status` (Ascending), `ts` (Descending)

### Cleanup

```typescript
import { cleanupOldAuditLogs } from "@/server/audit";

// Keep logs for 30 days
await cleanupOldAuditLogs(30);
```

---

## Protected Routes Example

File: `src/app/api/pro/task/route.ts`

### Complete Security Stack

```typescript
import { NextRequest, NextResponse } from "next/server";
import { assertAuth } from "@/server/authAssert";
import { limitOrNull } from "@/server/rateLimit";
import { limitFs } from "@/server/rateLimitFirestore";
import { logAudit } from "@/server/audit";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const path = "/api/pro/task";
  const method = "POST";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    // 1. Auth + Claims Check
    const auth = await assertAuth(req, {
      requireActive: true,
      tiers: ["pro"],
    });

    if (!auth.ok) {
      await logAudit({
        path, method,
        status: auth.status,
        ok: false,
        ip, ua,
        latency_ms: Date.now() - t0,
        err_code: auth.error,
      });

      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // 2. Rate Limiting
    const rlKey = `pro:task:${auth.uid}:${ip ?? "noip"}`;
    let rl = await limitOrNull(rlKey);

    if (rl && !rl.ok) {
      await logAudit({
        uid: auth.uid,
        path, method,
        status: 429,
        ok: false,
        ip, ua,
        claims: auth.claims,
        rl,
        err_code: "RATE_LIMIT",
      });

      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // Firestore fallback
    if (!rl || rl.ok === undefined) {
      const fsResult = await limitFs(rlKey, 60, 60);
      if (!fsResult.ok) {
        await logAudit({
          uid: auth.uid,
          path, method,
          status: 429,
          ok: false,
          ip, ua,
          claims: auth.claims,
          err_code: "RATE_LIMIT",
        });

        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 }
        );
      }
      rl = { ok: true, remaining: fsResult.remaining };
    }

    // 3. Business Logic
    const body = await req.json();
    const result = {
      ok: true,
      task: {
        id: crypto.randomUUID(),
        name: body.taskName,
        userId: auth.uid,
      },
    };

    // 4. Audit Log
    await logAudit({
      uid: auth.uid,
      path, method,
      status: 200,
      ok: true,
      ip, ua,
      latency_ms: Date.now() - t0,
      claims: auth.claims,
      rl,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    await logAudit({
      path, method,
      status: 500,
      ok: false,
      ip, ua,
      err_code: "INTERNAL_ERROR",
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

## Firestore Security Rules

File: `firestore.rules`

### Protected Collections

```javascript
// Users collection
match /users/{uid} {
  allow read: if isOwner(uid);
  allow update: if isOwner(uid) &&
    !request.resource.data.diff(resource.data).affectedKeys().hasAny([
      'entitlements',
      'stripeCustomerId',
      'backupCodes',
      'backupCodesGeneratedAt'
    ]);
}

// Passkeys (WebAuthn)
match /users/{uid}/passkeys/{credentialId} {
  allow read: if isOwner(uid);
  allow write: if false; // API routes only
}

// Audit logs (server-side only)
match /audit_logs/{logId} {
  allow read, write: if false;
}

// Rate limits (server-side only)
match /rate_limits/{key} {
  allow read, write: if false;
}

// WebAuthn challenges
match /webauthn_challenges/{challengeId} {
  allow read, write: if false;
}
```

### Deploy Rules

```bash
firebase deploy --only firestore:rules
```

---

## Environment Variables

### Required

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json

# Audit Logging
AUDIT_LOGS_ENABLED=1
AUDIT_IP_HASH_SECRET=your-random-secret-here-min-32-chars
```

### Optional (Rate Limiting)

```bash
# Upstash Redis (recommended for production)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Rate limit configuration
RATE_LIMIT_POINTS=60                # requests per window
RATE_LIMIT_DURATION_SECONDS=60      # window size in seconds
```

### Generate Secrets

```bash
# Generate AUDIT_IP_HASH_SECRET
openssl rand -base64 32

# Or in Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Deployment

### 1. Deploy Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

Verify deployment:
```bash
firebase functions:log --only syncClaimsOnEntitlementsWrite
```

### 2. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 3. Set Environment Variables

**Vercel:**
```bash
vercel env add AUDIT_LOGS_ENABLED
vercel env add AUDIT_IP_HASH_SECRET
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### 4. Deploy Application

```bash
git add .
git commit -m "feat: Add security hardening (Sprint 6)"
git push origin main
```

---

## Testing

### 1. Test Custom Claims

```typescript
// In browser console or test file
const user = auth.currentUser;
const token = await user.getIdToken();

// Decode JWT at https://jwt.io
// Should see claims:
// {
//   "sub_active": true,
//   "sub_tier": "pro",
//   "sub_exp": 1735689600
// }
```

### 2. Test Route Protection

```bash
# Without token (should fail)
curl https://your-app.com/api/pro/task

# With token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app.com/api/pro/task
```

### 3. Test Rate Limiting

```bash
# Spam requests
for i in {1..100}; do
  curl -H "Authorization: Bearer TOKEN" \
       https://your-app.com/api/pro/task
done

# Should return 429 after limit
```

### 4. Test Audit Logs

```typescript
import { queryAuditLogs } from "@/server/audit";

const logs = await queryAuditLogs({ limit: 10 });
console.log(logs);
```

---

## Monitoring

### Cloud Functions

```bash
# View logs
firebase functions:log

# Filter specific function
firebase functions:log --only syncClaimsOnEntitlementsWrite
```

### Firestore Usage

Monitor in Firebase Console → Firestore → Usage tab:
- Document reads/writes
- Storage size
- Indexes

### Rate Limit Monitoring

```typescript
import { getRateLimitStatus } from "@/server/rateLimit";

const status = await getRateLimitStatus(`api:task:${uid}`);
console.log(`Remaining: ${status.remaining}/${status.limit}`);
```

### Audit Log Analytics

```typescript
import { getAuditStats } from "@/server/audit";

const stats = await getAuditStats();
console.log(`
  Total: ${stats.total}
  Success: ${stats.success}
  Errors: ${stats.errors}
  Rate Limited: ${stats.rateLimited}
`);
```

---

## Best Practices

### Security

1. ✅ **Always verify tokens**: Use `assertAuth()` in every protected route
2. ✅ **Check claims**: Verify subscription tier and expiry
3. ✅ **Rate limit**: Apply to all API routes, especially expensive operations
4. ✅ **Audit log**: Track all sensitive operations
5. ✅ **Minimal PII**: Hash IPs, truncate UAs, sanitize claims
6. ✅ **Firestore rules**: Deny client writes to protected fields

### Performance

1. ✅ **Use Redis**: Upstash is much faster than Firestore for rate limiting
2. ✅ **Claims in token**: No Firestore read needed for authorization
3. ✅ **Edge middleware**: Quick redirects at the edge
4. ✅ **Async logging**: Don't await audit logs (fire-and-forget)
5. ✅ **Batch cleanups**: Use Cloud Scheduler for periodic cleanup

### Compliance

1. ✅ **GDPR**: Hash IPs, allow user data export/deletion
2. ✅ **Data Retention**: Auto-delete old audit logs (30-90 days)
3. ✅ **PCI DSS**: Never log payment details
4. ✅ **SOC 2**: Comprehensive audit trail for all access

---

## Troubleshooting

### Claims Not Updating

```typescript
// Force token refresh
await auth.currentUser?.getIdToken(true);

// Check claims
const token = await auth.currentUser?.getIdToken();
// Decode at jwt.io
```

### Rate Limit Not Working

```bash
# Check Redis connection
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# Test Firestore fallback
# Remove Redis env vars temporarily
```

### Audit Logs Not Saving

```bash
# Check env
echo $AUDIT_LOGS_ENABLED  # Should be "1"

# Check Firestore rules
firebase firestore:rules:get

# Check function logs
firebase functions:log
```

### Middleware Redirecting Public Pages

Update `PUBLIC_PATHS` in `src/middleware.ts`:

```typescript
const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/your-new-path",
];
```

---

## Summary

Sprint 6 provides enterprise-grade security with:

- ✅ Custom claims for fast authorization
- ✅ Multi-layer protection (middleware + API)
- ✅ Rate limiting (Redis + Firestore fallback)
- ✅ Comprehensive audit logging
- ✅ Firestore security rules
- ✅ GDPR-compliant privacy features

All protected routes now have:
1. Token verification with claims
2. Rate limiting
3. Audit logging
4. Error handling

Next steps:
- Monitor audit logs for abuse
- Set up Cloud Scheduler for cleanup
- Configure alerting for rate limit violations
- Implement admin dashboard for audit log analytics
