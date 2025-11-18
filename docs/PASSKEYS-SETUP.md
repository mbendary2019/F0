# Passkeys (WebAuthn) Setup Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Browser Compatibility](#browser-compatibility)
4. [Environment Configuration](#environment-configuration)
5. [Firebase Admin SDK Setup](#firebase-admin-sdk-setup)
6. [Installation](#installation)
7. [Architecture Overview](#architecture-overview)
8. [Registration Flow](#registration-flow)
9. [Authentication Flow](#authentication-flow)
10. [Firestore Schema](#firestore-schema)
11. [Security Rules](#security-rules)
12. [Testing Locally](#testing-locally)
13. [Production Deployment](#production-deployment)
14. [Troubleshooting](#troubleshooting)
15. [Security Considerations](#security-considerations)

---

## Overview

This implementation provides **passwordless authentication** using WebAuthn Passkeys, allowing users to sign in with:
- Face ID / Touch ID (macOS, iOS)
- Windows Hello (Windows)
- Android Biometrics
- Hardware security keys (YubiKey, etc.)

**Key Features:**
- ✅ Phishing-resistant authentication
- ✅ No password required
- ✅ Platform authenticator preference
- ✅ Discoverable credentials (resident keys)
- ✅ Firebase Custom Token integration
- ✅ Real-time passkey management
- ✅ Counter-based replay protection

---

## Prerequisites

### Required Services

1. **Firebase Project** with:
   - Firebase Authentication enabled
   - Firestore database configured
   - Firebase Admin SDK credentials

2. **Node.js Environment**:
   - Node.js 18+ recommended
   - Next.js 14+ (App Router)

3. **HTTPS Required**:
   - WebAuthn only works over HTTPS
   - Exception: `localhost` works over HTTP for development

### Required Knowledge

- Basic understanding of public key cryptography
- Familiarity with Firebase Authentication
- Next.js App Router concepts
- TypeScript basics

---

## Browser Compatibility

### Fully Supported Browsers

| Browser | Version | Platform | Notes |
|---------|---------|----------|-------|
| Chrome | 67+ | All | Full support |
| Edge | 18+ | All | Full support |
| Safari | 13+ | macOS/iOS | Requires iOS 14+ for platform authenticators |
| Firefox | 60+ | All | Full support |

### Platform Authenticators

| Platform | Authenticator | Supported |
|----------|--------------|-----------|
| macOS | Touch ID | ✅ Safari 14+, Chrome 87+ |
| iOS | Face ID / Touch ID | ✅ Safari 14+ |
| Windows | Windows Hello | ✅ Edge 18+, Chrome 87+ |
| Android | Biometrics | ✅ Chrome 70+ |

### Feature Detection

The implementation includes automatic feature detection:

```typescript
if (!window.PublicKeyCredential) {
  // WebAuthn not supported
  console.error("WebAuthn is not supported in this browser");
}
```

---

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.local.template .env.local
```

### 2. Configure WebAuthn Variables

Add these variables to `.env.local`:

```bash
# WebAuthn / Passkeys Configuration
NEXT_PUBLIC_RP_ID=localhost
NEXT_PUBLIC_RP_NAME="F0 Agent"
ORIGIN=http://localhost:3000

# Firebase Admin SDK (for Custom Tokens)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
```

### Variable Explanations

#### `NEXT_PUBLIC_RP_ID`
- **Relying Party ID** - Must match your domain
- Local dev: `localhost`
- Production: `yourdomain.com` (no protocol, no port)
- **Important**: Cannot include subdomains unless explicitly allowed

Examples:
```bash
# ✅ Correct
NEXT_PUBLIC_RP_ID=localhost
NEXT_PUBLIC_RP_ID=example.com

# ❌ Wrong
NEXT_PUBLIC_RP_ID=https://example.com
NEXT_PUBLIC_RP_ID=example.com:3000
```

#### `NEXT_PUBLIC_RP_NAME`
- **Display Name** shown to users in authenticator prompts
- Keep it short and recognizable
- Examples: `"MyApp"`, `"Acme Corp"`, `"F0 Agent"`

#### `ORIGIN`
- **Full URL** including protocol and port
- Used for origin verification during registration/authentication
- Must match exactly what browser sends

Examples:
```bash
# Local
ORIGIN=http://localhost:3000

# Production
ORIGIN=https://app.example.com
```

#### `GOOGLE_APPLICATION_CREDENTIALS`
- Path to Firebase Admin SDK service account JSON file
- Required for creating Firebase Custom Tokens
- Download from Firebase Console → Project Settings → Service Accounts

---

## Firebase Admin SDK Setup

### 1. Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file securely

### 2. Set Environment Variable

**Option A: Local Development**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```

**Option B: Production (Vercel)**
1. Copy the entire JSON file content
2. In Vercel dashboard → Settings → Environment Variables
3. Add variable: `GOOGLE_APPLICATION_CREDENTIALS`
4. Paste the JSON content as the value

### 3. Verify Admin SDK Initialization

The Admin SDK is initialized in `src/server/firebaseAdmin.ts`:

```typescript
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
```

---

## Installation

### 1. Install Dependencies

```bash
npm install @simplewebauthn/browser @simplewebauthn/server firebase-admin base64url
```

### 2. Verify Package Versions

Check `package.json`:

```json
{
  "dependencies": {
    "@simplewebauthn/browser": "^9.0.0",
    "@simplewebauthn/server": "^9.0.0",
    "firebase-admin": "^12.0.0",
    "base64url": "^3.0.1"
  }
}
```

### 3. File Structure

Ensure these files exist:

```
src/
├── server/
│   └── firebaseAdmin.ts                           # Admin SDK initialization
├── app/
│   └── api/
│       └── webauthn/
│           ├── registration/
│           │   ├── options/
│           │   │   └── route.ts                   # Generate registration options
│           │   └── verify/
│           │       └── route.ts                   # Verify registration
│           └── authentication/
│               ├── options/
│               │   └── route.ts                   # Generate auth options
│               └── verify/
│                   └── route.ts                   # Verify authentication
└── components/
    └── passkeys/
        ├── AddPasskeyButton.tsx                   # Enrollment UI
        ├── SignInWithPasskey.tsx                  # Sign-in UI
        └── PasskeysList.tsx                       # Manage passkeys
```

---

## Architecture Overview

### Flow Diagram

```
Registration Flow:
┌──────────┐    1. Get Options     ┌──────────────────┐
│          │ ──────────────────────>│  API: /options   │
│          │                        │  (verify token)  │
│  Client  │<───────────────────────│  (gen challenge) │
│          │    2. Options + ID     └──────────────────┘
│          │
│          │    3. startRegistration()
│          │    (user gesture)
│          │
│          │    4. Attestation      ┌──────────────────┐
│          │ ──────────────────────>│  API: /verify    │
│          │                        │  (verify)        │
│          │<───────────────────────│  (store cred)    │
└──────────┘    5. Success          └──────────────────┘

Authentication Flow:
┌──────────┐    1. Get Options     ┌──────────────────┐
│          │ ──────────────────────>│  API: /options   │
│          │                        │  (gen challenge) │
│  Client  │<───────────────────────│  (store temp)    │
│          │    2. Options + ID     └──────────────────┘
│          │
│          │    3. startAuthentication()
│          │    (user gesture)
│          │
│          │    4. Assertion        ┌──────────────────┐
│          │ ──────────────────────>│  API: /verify    │
│          │                        │  (verify)        │
│          │                        │  (find user)     │
│          │<───────────────────────│  (custom token)  │
│          │    5. Custom Token     └──────────────────┘
│          │
│          │    6. signInWithCustomToken()
│          │    (Firebase Auth)
└──────────┘
```

### Key Components

1. **Client-Side** (`@simplewebauthn/browser`):
   - `startRegistration()` - Initiates WebAuthn registration
   - `startAuthentication()` - Initiates WebAuthn authentication

2. **Server-Side** (`@simplewebauthn/server`):
   - `generateRegistrationOptions()` - Creates registration challenge
   - `verifyRegistrationResponse()` - Verifies attestation
   - `generateAuthenticationOptions()` - Creates auth challenge
   - `verifyAuthenticationResponse()` - Verifies assertion

3. **Storage** (Firestore):
   - `users/{uid}/passkeys/{credId}` - Stored credentials
   - `webauthn_challenges/{challengeId}` - Temporary challenges

4. **Authentication** (Firebase):
   - Custom tokens created after verification
   - User signs in with `signInWithCustomToken()`

---

## Registration Flow

### Step-by-Step Process

#### 1. Client Requests Registration Options

Component: `src/components/passkeys/AddPasskeyButton.tsx`

```typescript
const user = auth.currentUser;
const idToken = await user.getIdToken();

const optionsRes = await fetch("/api/webauthn/registration/options", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idToken }),
});

const options = await optionsRes.json();
```

#### 2. Server Generates Options

Route: `src/app/api/webauthn/registration/options/route.ts`

```typescript
// Verify user
const decoded = await adminAuth.verifyIdToken(idToken);
const uid = decoded.uid;

// Get existing credentials to exclude
const passkeysSnap = await adminDb.collection(`users/${uid}/passkeys`).get();
const excludeCredentials = passkeysSnap.docs.map(doc => ({
  id: base64url.toBuffer(doc.data().id),
  type: "public-key",
}));

// Generate options
const options = await generateRegistrationOptions({
  rpID,
  rpName,
  userID: uid,
  userName: decoded.email || uid,
  attestationType: "none",
  excludeCredentials,
  authenticatorSelection: {
    residentKey: "preferred",
    userVerification: "required",
    authenticatorAttachment: "platform",
  },
});

// Store challenge
await adminDb.doc(`users/${uid}/webauthn_state/registration`).set({
  challenge: options.challenge,
  timestamp: new Date(),
});

return NextResponse.json(options);
```

**Key Parameters:**

- `attestationType: "none"` - Don't require attestation (faster, privacy-friendly)
- `residentKey: "preferred"` - Enable discoverable credentials
- `userVerification: "required"` - Require biometrics/PIN
- `authenticatorAttachment: "platform"` - Prefer built-in authenticators

#### 3. Client Calls WebAuthn API

```typescript
import { startRegistration } from "@simplewebauthn/browser";

const attResp = await startRegistration(options);
// Browser shows native prompt for Face ID / Touch ID / etc.
```

#### 4. Client Sends Attestation to Server

```typescript
const verifyRes = await fetch("/api/webauthn/registration/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idToken, attResp }),
});
```

#### 5. Server Verifies and Stores Credential

Route: `src/app/api/webauthn/registration/verify/route.ts`

```typescript
// Verify user
const decoded = await adminAuth.verifyIdToken(idToken);
const uid = decoded.uid;

// Get stored challenge
const stateDoc = await adminDb.doc(`users/${uid}/webauthn_state/registration`).get();
const expectedChallenge = stateDoc.data()?.challenge;

// Verify response
const verification = await verifyRegistrationResponse({
  response: attResp,
  expectedChallenge,
  expectedOrigin: origin,
  expectedRPID: rpID,
  requireUserVerification: true,
});

if (!verification.verified) {
  throw new Error("Verification failed");
}

// Store credential
const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
const credIdB64 = Buffer.from(credentialID).toString("base64url");

await adminDb.doc(`users/${uid}/passkeys/${credIdB64}`).set({
  id: credIdB64,
  publicKey: Buffer.from(credentialPublicKey).toString("base64"),
  counter,
  deviceType: attResp.response.authenticatorAttachment || "unknown",
  backedUp: attResp.response.authenticatorData?.flags?.be || false,
  createdAt: new Date(),
  lastUsedAt: new Date(),
  userAgent: headers.get("user-agent") || "Unknown",
});
```

---

## Authentication Flow

### Step-by-Step Process

#### 1. Client Requests Authentication Options

Component: `src/components/passkeys/SignInWithPasskey.tsx`

```typescript
const optionsRes = await fetch("/api/webauthn/authentication/options", {
  method: "POST",
});

const { challengeId, ...options } = await optionsRes.json();
```

#### 2. Server Generates Options

Route: `src/app/api/webauthn/authentication/options/route.ts`

```typescript
import { randomUUID } from "crypto";

const options = await generateAuthenticationOptions({
  rpID,
  userVerification: "required",
  allowCredentials: [], // Empty = discoverable credentials
});

// Store challenge temporarily with unique ID
const challengeId = randomUUID();
await adminDb.doc(`webauthn_challenges/${challengeId}`).set({
  challenge: options.challenge,
  type: "auth",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
});

return NextResponse.json({ challengeId, ...options });
```

**Key: Empty `allowCredentials`**
- Enables discoverable credentials (resident keys)
- User doesn't need to enter username
- Authenticator presents available credentials

#### 3. Client Calls WebAuthn API

```typescript
import { startAuthentication } from "@simplewebauthn/browser";

const assertion = await startAuthentication(options);
// Browser shows available passkeys for this RP
```

#### 4. Client Sends Assertion to Server

```typescript
const verifyRes = await fetch("/api/webauthn/authentication/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ challengeId, assertion }),
});

const result = await verifyRes.json();
```

#### 5. Server Verifies and Issues Custom Token

Route: `src/app/api/webauthn/authentication/verify/route.ts`

```typescript
// Get stored challenge
const challengeDoc = await adminDb.doc(`webauthn_challenges/${challengeId}`).get();
const expectedChallenge = challengeDoc.data()?.challenge;

// Find credential owner using collection group query
const credIdB64 = Buffer.from(assertion.rawId, "base64url").toString("base64url");
const passkeysQuery = await adminDb
  .collectionGroup("passkeys")
  .where("id", "==", credIdB64)
  .get();

if (passkeysQuery.empty) {
  throw new Error("Passkey not found");
}

const passkeyDoc = passkeysQuery.docs[0];
const uid = passkeyDoc.ref.parent.parent.id; // Extract user ID from path

// Get credential data
const credential = passkeyDoc.data();

// Verify assertion
const verification = await verifyAuthenticationResponse({
  response: assertion,
  expectedChallenge,
  expectedOrigin: origin,
  expectedRPID: rpID,
  authenticator: {
    credentialID: base64url.toBuffer(credential.id),
    credentialPublicKey: Buffer.from(credential.publicKey, "base64"),
    counter: credential.counter,
  },
  requireUserVerification: true,
});

if (!verification.verified) {
  throw new Error("Verification failed");
}

// Update counter (prevent replay attacks)
await passkeyDoc.ref.update({
  counter: verification.authenticationInfo.newCounter,
  lastUsedAt: new Date(),
});

// Create Firebase Custom Token
const customToken = await adminAuth.createCustomToken(uid);

// Delete used challenge
await adminDb.doc(`webauthn_challenges/${challengeId}`).delete();

return NextResponse.json({ ok: true, uid, customToken });
```

#### 6. Client Signs In with Custom Token

```typescript
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

await signInWithCustomToken(auth, result.customToken);
// User is now signed in!
```

---

## Firestore Schema

### Collections Structure

```
users/
  {uid}/
    passkeys/
      {credentialId}/         # base64url encoded credential ID
        - id: string          # base64url credential ID
        - publicKey: string   # base64 encoded public key
        - counter: number     # signature counter
        - deviceType: string  # "multiDevice" | "singleDevice" | "unknown"
        - backedUp: boolean   # synced to cloud
        - createdAt: timestamp
        - lastUsedAt: timestamp
        - userAgent: string

    webauthn_state/
      registration/           # Temporary challenge storage
        - challenge: string
        - timestamp: timestamp

webauthn_challenges/
  {challengeId}/              # UUID
    - challenge: string
    - type: "auth"
    - createdAt: timestamp
    - expiresAt: timestamp
```

### Field Explanations

#### Passkey Document

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | base64url encoded credential ID (used as document ID) |
| `publicKey` | string | base64 encoded COSE public key |
| `counter` | number | Signature counter for replay protection |
| `deviceType` | string | Authenticator type: `multiDevice`, `singleDevice`, `unknown` |
| `backedUp` | boolean | Whether credential is synced to cloud (e.g., iCloud Keychain) |
| `createdAt` | timestamp | When passkey was enrolled |
| `lastUsedAt` | timestamp | Last successful authentication |
| `userAgent` | string | Browser/OS user agent for display |

#### Challenge Document

| Field | Type | Description |
|-------|------|-------------|
| `challenge` | string | base64url random challenge |
| `type` | string | `"auth"` for authentication challenges |
| `createdAt` | timestamp | Challenge creation time |
| `expiresAt` | timestamp | Auto-delete after 5 minutes |

---

## Security Rules

File: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // Passkeys (WebAuthn Credentials)
    match /users/{uid}/passkeys/{credentialId} {
      // Read: Only owner can read their passkeys
      allow read: if isOwner(uid);

      // Write: Never allow from client (API routes only)
      allow write: if false;
    }

    // WebAuthn registration state
    match /users/{uid}/webauthn_state/{doc} {
      // Read: Only owner can read
      allow read: if isOwner(uid);

      // Write: Never allow from client (API routes only)
      allow write: if false;
    }

    // WebAuthn challenges (temporary storage)
    match /webauthn_challenges/{challengeId} {
      // No client access (API routes only)
      allow read, write: if false;
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Why These Rules?

1. **Passkeys are read-only from client**:
   - Prevents users from tampering with public keys or counters
   - Only server-side API routes can write

2. **Challenges have zero client access**:
   - Prevents challenge reuse attacks
   - Ensures challenges are only generated by server

3. **Owner-only reads**:
   - Users can only see their own passkeys
   - Privacy protection

---

## Testing Locally

### 1. Start Development Server

```bash
npm run dev
```

Server should start on `http://localhost:3000`

### 2. Test Registration Flow

1. Navigate to `/account/security`
2. Sign in with existing account
3. Scroll to **Passkeys** section
4. Click **"Add a passkey"**
5. Browser should prompt for Face ID / Touch ID / etc.
6. Complete biometric verification
7. Check Firestore - credential should appear in `users/{uid}/passkeys/`

**Expected Result:**
```
✅ Passkey added successfully!
```

### 3. Test Authentication Flow

1. Sign out of your account
2. Navigate to `/auth`
3. Click **"Sign in with a passkey"**
4. Browser shows available passkeys
5. Select your passkey
6. Complete biometric verification
7. Should be redirected to dashboard

**Expected Result:**
```
✅ Signed in successfully!
```

### 4. Test Passkey Management

1. Go to `/account/security`
2. Under **"Your Passkeys"**, you should see:
   - Device name (detected from user agent)
   - Creation date
   - Last used date
   - "Synced" badge if backed up
3. Click **"Remove"** on a passkey
4. Confirm deletion
5. Passkey should disappear
6. Check Firestore - document should be deleted

### 5. Check Console for Errors

Open browser DevTools → Console:

```javascript
// ✅ Good - No errors

// ❌ Bad - Check these errors:
// "WebAuthn is not supported"
//   → Update browser or use HTTPS

// "NotAllowedError: The operation either timed out or was not allowed"
//   → User cancelled or authenticator unavailable

// "Origin mismatch"
//   → Check ORIGIN env variable matches exactly

// "RP ID mismatch"
//   → Check NEXT_PUBLIC_RP_ID matches domain
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update `NEXT_PUBLIC_RP_ID` to production domain
- [ ] Update `ORIGIN` to production URL (with HTTPS)
- [ ] Set up Firebase Admin SDK credentials in hosting platform
- [ ] Deploy Firestore security rules
- [ ] Test HTTPS is working (WebAuthn requires it)
- [ ] Verify service account has correct permissions

### Environment Variables (Production)

```bash
# Vercel / Netlify / etc.
NEXT_PUBLIC_RP_ID=yourdomain.com
NEXT_PUBLIC_RP_NAME="Your App Name"
ORIGIN=https://yourdomain.com

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=<paste entire JSON content>

# Firebase Client (same as before)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

### Deploy Firestore Rules

```bash
# Install Firebase CLI if not already
npm install -g firebase-tools

# Login
firebase login

# Deploy rules only
firebase deploy --only firestore:rules
```

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

**Important for Service Account:**
- In Vercel, paste the **entire JSON file content** as the value for `GOOGLE_APPLICATION_CREDENTIALS`
- Don't upload the file itself

### Post-Deployment Testing

1. Open production URL in browser
2. Test registration with different authenticators:
   - Platform (Face ID / Touch ID / Windows Hello)
   - Cross-platform (YubiKey, if available)
3. Test authentication
4. Test passkey removal
5. Check Firestore data is being written correctly
6. Monitor for errors in Vercel logs

### Domain Configuration

**Important**: `RP_ID` must match your domain exactly:

```bash
# ✅ Correct
App URL: https://app.example.com
RP_ID: app.example.com

# ✅ Also correct (root domain works for all subdomains)
App URL: https://app.example.com
RP_ID: example.com

# ❌ Wrong
App URL: https://app.example.com
RP_ID: example.com  # Use root OR subdomain, not both
```

---

## Troubleshooting

### Common Issues

#### 1. "WebAuthn is not supported in this browser"

**Cause**: Browser doesn't support WebAuthn API

**Solution**:
- Update to latest browser version
- Use Chrome 67+, Safari 13+, Edge 18+, or Firefox 60+
- Check if running over HTTPS (required except for localhost)

#### 2. "NotAllowedError: The operation either timed out or was not allowed"

**Causes**:
- User cancelled the prompt
- Authenticator not available
- User gesture required (must be triggered by button click)

**Solutions**:
- Ensure function is called from user interaction (button click)
- Check if authenticator is available on device
- User must actively click "Allow" in browser prompt

#### 3. "Origin mismatch"

**Cause**: `ORIGIN` env variable doesn't match actual URL

**Solutions**:
```bash
# Check exact URL in browser
# Make sure ORIGIN matches exactly, including protocol and port

# ✅ Correct
ORIGIN=http://localhost:3000  # Local dev
ORIGIN=https://app.example.com  # Production

# ❌ Wrong
ORIGIN=localhost:3000  # Missing protocol
ORIGIN=http://app.example.com/  # Extra trailing slash
```

#### 4. "RP ID mismatch"

**Cause**: `NEXT_PUBLIC_RP_ID` doesn't match domain

**Solutions**:
```bash
# RP_ID must be domain without protocol/port

# ✅ Correct
NEXT_PUBLIC_RP_ID=localhost  # Local
NEXT_PUBLIC_RP_ID=example.com  # Production

# ❌ Wrong
NEXT_PUBLIC_RP_ID=https://example.com
NEXT_PUBLIC_RP_ID=example.com:3000
```

#### 5. "Passkey not found" during authentication

**Causes**:
- Credential was deleted from Firestore
- Wrong RP ID (credential registered for different domain)
- Browser autofill conflict

**Solutions**:
- Check Firestore for credential existence
- Verify RP_ID hasn't changed since registration
- Try different authenticator
- Clear browser autofill data

#### 6. Firebase Admin SDK errors

**Error**: `"Error: Could not load the default credentials"`

**Solution**:
```bash
# Make sure GOOGLE_APPLICATION_CREDENTIALS is set correctly

# Local: Point to file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"

# Production: Paste entire JSON content
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...}
```

#### 7. "Custom token verification failed"

**Causes**:
- Wrong Firebase project
- Service account doesn't have permissions

**Solutions**:
- Verify `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matches service account project
- Check service account has "Firebase Authentication Admin" role
- Regenerate service account key

#### 8. Counter validation errors

**Error**: Signature counter is lower than stored counter

**Cause**: Replay attack attempt OR authenticator counter reset

**Solution**:
- This is a security feature - DO NOT bypass
- If legitimate (e.g., user reset device), remove and re-enroll passkey
- Check for duplicated credentials in Firestore

#### 9. Challenges expiring too fast

**Symptom**: Users report "Challenge expired" errors

**Solution**:
```typescript
// Increase expiry time in authentication/options/route.ts
expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes instead of 5
```

#### 10. Mobile Safari issues

**Common Issues**:
- Face ID doesn't trigger
- "This authenticator is not supported"

**Solutions**:
- iOS 14+ required for platform authenticators
- Safari 14+ required
- User must have Face ID / Touch ID set up in device settings
- Check if user has allowed Safari to use Face ID (Settings → Safari → Camera & Microphone Access)

---

## Security Considerations

### Best Practices

#### 1. Always Require User Verification
```typescript
authenticatorSelection: {
  userVerification: "required", // ✅ Forces biometrics/PIN
}
```

Never use `"discouraged"` or `"preferred"` - this weakens security.

#### 2. Validate Counter for Replay Protection
```typescript
// In verify route
if (verification.authenticationInfo.newCounter <= credential.counter) {
  // Possible replay attack!
  throw new Error("Invalid counter");
}

// Always update counter after successful verification
await passkeyDoc.ref.update({
  counter: verification.authenticationInfo.newCounter,
});
```

#### 3. Use Attestation Only If Needed
```typescript
attestationType: "none", // ✅ Faster, more privacy-friendly
```

Only use `"direct"` or `"indirect"` if you need to verify specific authenticator models.

#### 4. Set Short Challenge Expiry
```typescript
expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes max
```

Prevents old challenges from being reused.

#### 5. Delete Challenges After Use
```typescript
// Always delete challenge after verification
await adminDb.doc(`webauthn_challenges/${challengeId}`).delete();
```

Prevents replay attacks.

#### 6. Verify Origin Strictly
```typescript
const verification = await verifyAuthenticationResponse({
  expectedOrigin: process.env.ORIGIN, // Must match exactly
  expectedRPID: process.env.NEXT_PUBLIC_RP_ID,
  // ...
});
```

Never skip origin/RP ID validation.

#### 7. Rate Limit Registration/Authentication
```typescript
// Add rate limiting middleware to API routes
// Example: max 5 attempts per IP per minute
```

Prevents brute force attacks.

#### 8. Monitor for Suspicious Activity
```typescript
// Log failed verification attempts
console.error("Verification failed:", {
  uid,
  credentialId,
  timestamp: new Date(),
  reason: error.message,
});
```

Set up alerts for unusual patterns.

#### 9. Secure Admin SDK Credentials
- Never commit service account JSON to Git
- Use environment variables
- Rotate keys periodically
- Restrict service account permissions to minimum needed

#### 10. Implement Backup Authentication
- Passkeys should be **additional** security, not only method
- Keep email/password as fallback
- Implement account recovery flow

### Attack Vectors to Consider

| Attack | Mitigation |
|--------|------------|
| Phishing | RP ID validation prevents credentials from working on fake sites |
| Man-in-the-Middle | Origin validation + HTTPS required |
| Replay Attack | Counter validation detects reused signatures |
| Credential Theft | Private key never leaves authenticator device |
| Session Hijacking | Use secure, httpOnly cookies for Firebase session |
| Brute Force | Rate limiting on API routes |
| Challenge Reuse | Challenges deleted after use + short expiry |

### Compliance Considerations

- **GDPR**: Store minimal user data, allow passkey deletion
- **PCI DSS**: Passkeys can help meet strong authentication requirements
- **HIPAA**: Passkeys provide phishing-resistant authentication
- **NIST 800-63B**: Passkeys meet AAL3 (highest assurance level)

---

## Production Checklist

Before going live, verify:

### Configuration
- [ ] `NEXT_PUBLIC_RP_ID` matches production domain
- [ ] `ORIGIN` uses HTTPS and matches production URL
- [ ] `NEXT_PUBLIC_RP_NAME` is user-friendly
- [ ] Firebase Admin SDK credentials are set correctly
- [ ] All environment variables are set in hosting platform

### Security
- [ ] HTTPS is enforced (WebAuthn requirement)
- [ ] Firestore security rules deployed
- [ ] Service account has minimum required permissions
- [ ] Rate limiting implemented on API routes
- [ ] Error messages don't leak sensitive information
- [ ] Challenges expire in ≤ 5 minutes
- [ ] Counter validation is enabled

### Testing
- [ ] Registration works on all major browsers
- [ ] Authentication works on all major browsers
- [ ] Passkey deletion works
- [ ] Counter updates correctly
- [ ] Challenge cleanup works
- [ ] Error handling is graceful
- [ ] Mobile devices tested (iOS Safari, Android Chrome)
- [ ] Cross-platform authenticators tested (if supported)

### Monitoring
- [ ] Error logging configured
- [ ] Success metrics tracked
- [ ] Failed authentication attempts logged
- [ ] Firestore usage monitored
- [ ] API route performance monitored

### Documentation
- [ ] User-facing help docs created
- [ ] Support team trained on passkey issues
- [ ] Fallback authentication documented
- [ ] Account recovery process documented

---

## Additional Resources

### Official Documentation
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [FIDO Alliance](https://fidoalliance.org/)
- [SimpleWebAuthn Docs](https://simplewebauthn.dev/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

### Tools
- [WebAuthn.io](https://webauthn.io/) - Test passkeys in your browser
- [Passkeys.dev](https://passkeys.dev/) - Developer resources
- [FIDO Conformance Tools](https://fidoalliance.org/certification/conformance/)

### Browser Support
- [Can I Use WebAuthn](https://caniuse.com/webauthn)
- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)

---

## Summary

This implementation provides:

✅ **Secure, passwordless authentication** using WebAuthn
✅ **Platform authenticator support** (Face ID, Touch ID, Windows Hello)
✅ **Discoverable credentials** for username-less sign-in
✅ **Firebase integration** via custom tokens
✅ **Real-time passkey management** with Firestore
✅ **Production-ready security** with proper validation and rules

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or check the [official SimpleWebAuthn documentation](https://simplewebauthn.dev/).
