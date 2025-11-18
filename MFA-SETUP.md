# 🔐 MFA Setup Guide

Complete guide to implementing Multi-Factor Authentication (MFA) with TOTP, SMS, and Backup Codes for F0 Agent.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Firebase Console Setup](#firebase-console-setup)
4. [Implementation Guide](#implementation-guide)
5. [User Flows](#user-flows)
6. [Testing](#testing)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

F0 Agent supports three types of two-factor authentication:

- **🔢 TOTP (Time-based One-Time Password)**: Authenticator apps like Google Authenticator, 1Password, Authy
- **📱 SMS**: Text message verification
- **🔑 Backup Codes**: Emergency recovery codes (10 single-use codes)

### Architecture

```
┌──────────────┐
│   Frontend   │
│  (React/Next)│
└──────┬───────┘
       │
       ├─► TOTP Enrollment (QR Code)
       ├─► SMS Enrollment (reCAPTCHA)
       ├─► Backup Codes Generation
       │
       ▼
┌──────────────┐
│   Firebase   │
│     Auth     │
└──────┬───────┘
       │
       ├─► MFA Resolver (Sign-in)
       │
       ▼
┌──────────────┐
│  Firestore   │
│ (Backup Codes)│
└──────────────┘
```

---

## Prerequisites

- ✅ Firebase project with Authentication enabled
- ✅ Firebase billing enabled (required for SMS)
- ✅ Package installed: `qrcode` for QR code generation
- ✅ reCAPTCHA configured (automatic with Firebase SDK)

---

## Firebase Console Setup

### Step 1: Enable Multi-Factor Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Scroll to **Multi-factor authentication**
5. Click **Enable**

### Step 2: Configure TOTP

1. In Multi-factor authentication section:
   - ✅ Enable "Time-based one-time password (TOTP)"
   - Set **Display name**: "F0 Agent"
   - Click **Save**

### Step 3: Configure SMS

1. In Multi-factor authentication section:
   - ✅ Enable "SMS"
   - Configure **SMS quota** (default: 10,000/day for Blaze plan)
   - Click **Save**

2. **Important:** SMS requires Firebase Blaze (pay-as-you-go) plan

### Step 4: Configure reCAPTCHA

Firebase SDK automatically handles reCAPTCHA for web, but you may want to customize:

1. Go to **Authentication** → **Settings**
2. Scroll to **reCAPTCHA Providers**
3. Configure reCAPTCHA v2 or v3 (v2 recommended for better UX)

---

## Implementation Guide

### Installation

```bash
npm install qrcode @types/qrcode
```

### File Structure

```
src/
├── app/
│   ├── account/security/
│   │   └── page.tsx              # Security settings page
│   └── api/backup-codes/
│       └── generate/
│           └── route.ts          # Backup codes API
├── components/mfa/
│   ├── TotpEnroll.tsx            # TOTP enrollment
│   ├── PhoneEnroll.tsx           # SMS enrollment
│   ├── BackupCodes.tsx           # Backup codes generation
│   ├── EnrolledFactors.tsx       # Display active methods
│   └── MfaResolver.tsx           # Sign-in 2FA challenge
functions/
└── src/
    └── index.ts                  # Backup codes Functions
```

### Component Integration

#### 1. Security Page

```tsx
// src/app/account/security/page.tsx
import TotpEnroll from "@/components/mfa/TotpEnroll";
import PhoneEnroll from "@/components/mfa/PhoneEnroll";
import BackupCodes from "@/components/mfa/BackupCodes";
import EnrolledFactors from "@/components/mfa/EnrolledFactors";

export default function SecurityPage() {
  return (
    <div>
      <EnrolledFactors />
      <TotpEnroll />
      <PhoneEnroll />
      <BackupCodes />
    </div>
  );
}
```

#### 2. Sign-In with MFA Resolution

```tsx
// src/app/auth/page.tsx
import { signInWithAppleAuto } from "@/lib/appleProvider";
import MfaResolver from "@/components/mfa/MfaResolver";

export default function AuthPage() {
  const [mfaError, setMfaError] = useState(null);

  async function handleSignIn() {
    try {
      await signInWithAppleAuto(auth);
    } catch (error: any) {
      if (error.code === "auth/multi-factor-auth-required") {
        setMfaError(error);
      }
    }
  }

  if (mfaError) {
    return (
      <MfaResolver
        error={mfaError}
        onResolved={() => {
          setMfaError(null);
          // User is now signed in
        }}
      />
    );
  }

  return <button onClick={handleSignIn}>Sign In</button>;
}
```

---

## User Flows

### Flow 1: Enroll TOTP

```
1. User clicks "Enable Authenticator App"
   ↓
2. System generates TOTP secret
   ↓
3. QR code displayed to user
   ↓
4. User scans QR with authenticator app
   ↓
5. User enters 6-digit code
   ↓
6. System verifies code
   ↓
7. TOTP enrolled ✅
```

### Flow 2: Enroll SMS

```
1. User enters phone number
   ↓
2. System sends verification code via SMS
   (reCAPTCHA verification happens automatically)
   ↓
3. User enters 6-digit code
   ↓
4. System verifies code
   ↓
5. SMS enrolled ✅
```

### Flow 3: Generate Backup Codes

```
1. User clicks "Generate Backup Codes"
   ↓
2. Warning displayed (codes shown only once)
   ↓
3. User confirms
   ↓
4. System generates 10 random codes
   ↓
5. Codes hashed and stored in Firestore
   ↓
6. Plain codes displayed to user
   ↓
7. User copies/downloads/prints codes
   ↓
8. Done ✅
```

### Flow 4: Sign-In with MFA

```
1. User signs in with Apple
   ↓
2. Firebase detects MFA required
   ↓
3. MfaResolver component displayed
   ↓
4. User selects method (TOTP or SMS)
   ↓
5. User enters verification code
   ↓
6. System resolves MFA challenge
   ↓
7. Sign-in complete ✅
```

### Flow 5: Account Recovery (Backup Code)

```
1. User loses access to MFA device
   ↓
2. User tries to sign in
   ↓
3. MFA required but user can't complete
   ↓
4. User goes to recovery page
   ↓
5. User enters email + backup code
   ↓
6. System verifies code
   ↓
7. All MFA factors disabled
   ↓
8. User can sign in normally
   ↓
9. User re-enrolls MFA ✅
```

---

## Testing

### Test TOTP Enrollment

1. Navigate to `/account/security`
2. Click "Enable Authenticator App"
3. Scan QR code with:
   - Google Authenticator
   - 1Password
   - Authy
   - Microsoft Authenticator
4. Enter 6-digit code
5. Verify enrollment success

### Test SMS Enrollment

1. Navigate to `/account/security`
2. Click "Enable SMS Authentication"
3. Enter phone number with country code (e.g., +1 555 123 4567)
4. Click "Send Code"
5. Check SMS for 6-digit code
6. Enter code
7. Verify enrollment success

**Note:** For development, use Firebase test phone numbers:

```
Phone: +1 650-555-3434
Code: 123456
```

Configure in Firebase Console → Authentication → Settings → Phone numbers for testing

### Test Backup Codes

1. Navigate to `/account/security`
2. Click "Generate Backup Codes"
3. Confirm warning
4. Verify 10 codes displayed
5. Copy/download/print codes
6. Verify codes saved in Firestore:
   ```
   users/{uid}/backupCodes
   ```

### Test MFA Sign-In

1. Sign out
2. Click "Sign In with Apple"
3. Complete Apple authentication
4. Verify MFA challenge appears
5. Select TOTP or SMS
6. Enter verification code
7. Verify sign-in completes

### Test Backup Code Recovery

1. Use recovery endpoint:
   ```bash
   curl -X POST https://YOUR_REGION-PROJECT.cloudfunctions.net/verifyBackupCode \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","code":"ABCD-1234"}'
   ```
2. Verify response
3. Verify MFA factors removed in Firebase Console
4. Sign in normally

---

## Security Considerations

### TOTP Security

✅ **Strengths:**
- Works offline
- No dependency on phone number
- Industry standard (RFC 6238)
- More secure than SMS

⚠️ **Considerations:**
- Secret key must be protected
- Time synchronization required
- User can lose device

### SMS Security

✅ **Strengths:**
- User-friendly
- No app required
- Wide accessibility

⚠️ **Risks:**
- SIM swapping attacks
- SMS interception
- Carrier reliability
- Additional costs

**Recommendations:**
- Prefer TOTP over SMS
- Warn users about SMS risks
- Implement rate limiting
- Monitor unusual activity

### Backup Codes Security

✅ **Implementation:**
- Codes hashed with SHA-256
- One-time use only
- Stored separately from auth credentials
- Timestamped for audit

⚠️ **Best Practices:**
- Generate 10 codes minimum
- 8+ characters with clear font
- No confusing characters (0/O, 1/I/l)
- Warn users to store securely
- Track usage (date, IP)
- Send email notification on use
- Expire after time period (optional)

### Additional Security Measures

1. **Rate Limiting**
   ```typescript
   // Limit verification attempts
   const MAX_ATTEMPTS = 5;
   const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
   ```

2. **Session Management**
   ```typescript
   // Require re-authentication for sensitive actions
   await user.reauthenticateWithCredential(credential);
   ```

3. **Audit Logging**
   ```typescript
   // Log all MFA events
   await logSecurityEvent({
     uid,
     action: "mfa_enrolled",
     method: "totp",
     timestamp: Date.now(),
     ip: req.ip,
   });
   ```

4. **Email Notifications**
   - MFA enrolled/unenrolled
   - Backup code used
   - Failed verification attempts
   - Unusual sign-in activity

---

## Troubleshooting

### Issue: QR Code Not Scanning

**Solutions:**
1. Increase QR code size
2. Check display brightness
3. Try manual entry with secret key
4. Verify QR code data is valid `otpauth://` URI

### Issue: TOTP Code Always Invalid

**Solutions:**
1. Check device time synchronization
2. Verify time zone is correct
3. Try next code (30-second window)
4. Re-enroll TOTP factor

### Issue: SMS Not Received

**Solutions:**
1. Verify phone number format (include +country code)
2. Check Firebase quota limits
3. Verify billing is enabled
4. Try test phone numbers
5. Check spam/blocked messages

### Issue: reCAPTCHA Blocking

**Solutions:**
1. Verify domain is whitelisted
2. Check reCAPTCHA keys
3. Test in incognito mode
4. Clear browser cache
5. Try different browser

### Issue: Backup Code Not Working

**Solutions:**
1. Verify code hasn't been used
2. Check for typos (case-sensitive)
3. Ensure codes were generated
4. Check Firestore data:
   ```javascript
   firebase.firestore().doc('users/{uid}').get()
   ```

### Issue: Firebase Function Error

**Solutions:**
1. Check function logs:
   ```bash
   firebase functions:log
   ```
2. Verify environment variables
3. Check CORS settings
4. Verify authentication token
5. Test with curl:
   ```bash
   curl -X POST https://FUNCTION_URL \
     -H "Authorization: Bearer TOKEN" \
     -d '{"codes":["TEST-1234"]}'
   ```

---

## Advanced Topics

### Custom MFA UI

Customize the MFA resolver UI:

```tsx
<MfaResolver
  error={mfaError}
  onResolved={() => {}}
  customStyles={{
    container: "custom-class",
    button: "custom-button",
  }}
/>
```

### Programmatic Enrollment

```typescript
import { multiFactor, TotpMultiFactorGenerator } from "firebase/auth";

async function enrollTOTP(user: User) {
  const mfaUser = multiFactor(user);
  const session = await mfaUser.getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);

  // Display QR code, get user input
  const code = await getUserInput();

  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  await mfaUser.enroll(assertion, "My Authenticator");
}
```

### Force MFA for All Users

```typescript
// Firebase Functions trigger
export const enforceM FA = functions.auth.user().onCreate(async (user) => {
  // Send email requiring MFA enrollment within 7 days
  // Disable account after grace period if not enrolled
});
```

---

## Resources

- [Firebase MFA Documentation](https://firebase.google.com/docs/auth/web/multi-factor)
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)
- [1Password](https://1password.com/)
- [Authy](https://authy.com/)

---

**Last Updated:** October 2025
**Version:** 1.0.0
