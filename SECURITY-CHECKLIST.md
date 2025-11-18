# 🛡️ Security Checklist

Comprehensive security checklist for F0 Agent covering authentication, MFA, billing, and data protection.

---

## 📋 Table of Contents

1. [Authentication Security](#authentication-security)
2. [MFA Security](#mfa-security)
3. [Billing & Payment Security](#billing--payment-security)
4. [Data Protection](#data-protection)
5. [Infrastructure Security](#infrastructure-security)
6. [Monitoring & Incident Response](#monitoring--incident-response)

---

## Authentication Security

### Firebase Authentication

- [ ] **Email Verification Required**
  - Enable email verification for new users
  - Block unverified users from sensitive operations
  ```typescript
  if (!user.emailVerified) {
    await user.sendEmailVerification();
  }
  ```

- [ ] **Password Policy**
  - Minimum 12 characters
  - Require uppercase, lowercase, numbers, symbols
  - Use Firebase Authentication password requirements

- [ ] **Session Management**
  - Set appropriate session timeout (default: 1 hour)
  - Implement "Remember Me" carefully
  - Clear sessions on sign-out
  ```typescript
  import { setPersistence, browserLocalPersistence } from "firebase/auth";
  await setPersistence(auth, browserLocalPersistence);
  ```

- [ ] **Apple Sign-In Security**
  - ✅ Nonce generation with crypto.getRandomValues()
  - ✅ SHA-256 hashing for replay protection
  - ✅ Verify Apple JWT tokens
  - ✅ Handle token refresh properly

- [ ] **Rate Limiting**
  - Limit sign-in attempts (5 per 15 minutes)
  - Implement CAPTCHA after failed attempts
  - Block IPs with excessive failures
  ```typescript
  // Using Firebase Security Rules
  match /rateLimit/{ip} {
    allow write: if request.time < resource.data.unlockTime;
  }
  ```

- [ ] **Account Lockout**
  - Lock account after 10 failed attempts
  - Send email notification
  - Require password reset to unlock

### Re-authentication

- [ ] **Sensitive Operations Require Re-auth**
  - Changing password
  - Changing email
  - Enrolling/unenrolling MFA
  - Updating payment methods
  - Deleting account

```typescript
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

async function requireReauth(user: User, password: string) {
  const credential = EmailAuthProvider.credential(user.email!, password);
  await reauthenticateWithCredential(user, credential);
}
```

---

## MFA Security

### TOTP (Authenticator Apps)

- [ ] **Secure Secret Generation**
  - ✅ Use Firebase's built-in secret generation
  - ✅ 160-bit entropy minimum
  - ✅ Display QR code securely (HTTPS only)

- [ ] **Time Synchronization**
  - Document requirement for accurate device time
  - Implement time skew tolerance (±1 period)
  - Warn users about time sync issues

- [ ] **Backup TOTP Enrollment**
  - Allow multiple TOTP factors
  - Name each factor (e.g., "iPhone", "Work Laptop")
  - Display enrollment date

### SMS Authentication

- [ ] **Phone Number Validation**
  - Verify format with country code (+1, +44, etc.)
  - Sanitize input to prevent injection
  ```typescript
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phoneNumber)) {
    throw new Error("Invalid phone number");
  }
  ```

- [ ] **reCAPTCHA Protection**
  - ✅ Automatic with Firebase SDK
  - Configure v2 invisible reCAPTCHA
  - Whitelist production domains

- [ ] **SMS Rate Limiting**
  - Max 3 SMS per hour per number
  - Max 10 SMS per day per number
  - Exponential backoff on resend

- [ ] **SMS Content Security**
  - Don't include sensitive info in SMS
  - Use generic message format
  - Short expiration (5 minutes)

### Backup Codes

- [ ] **Code Generation**
  - ✅ 10 codes minimum
  - ✅ 8+ characters each
  - ✅ Exclude confusing characters (0/O, 1/I/l)
  - ✅ Format for readability (XXXX-XXXX)

- [ ] **Storage Security**
  - ✅ Hash with SHA-256 before storage
  - ✅ Never store plain text
  - ✅ Mark as used after consumption
  - ✅ Timestamp creation and usage

- [ ] **Recovery Process**
  - ✅ Verify email ownership
  - ✅ Rate limit attempts (3 per hour)
  - ✅ Send email notification on use
  - ✅ Disable all MFA after recovery
  - Require MFA re-enrollment

- [ ] **Audit Trail**
  - Log all backup code usage
  - Track IP address and user agent
  - Alert on suspicious patterns
  - Regular review of recovery attempts

---

## Billing & Payment Security

### Stripe Integration

- [ ] **API Key Management**
  - ✅ Never expose secret keys on client
  - ✅ Use environment variables
  - ✅ Rotate keys quarterly
  - ✅ Separate test/live keys

- [ ] **Webhook Security**
  - ✅ Verify webhook signatures
  - ✅ Use HTTPS endpoints only
  - ✅ Check event types
  - ✅ Implement idempotency
  ```typescript
  const event = stripe.webhooks.constructEvent(
    req.rawBody,
    signature,
    webhookSecret
  );
  ```

- [ ] **Payment Data**
  - Never store credit card numbers
  - Use Stripe Elements for PCI compliance
  - Implement 3D Secure (SCA)
  - Validate amounts server-side

- [ ] **Subscription Management**
  - ✅ Verify subscription status before access
  - ✅ Handle grace periods properly
  - ✅ Implement webhook retries
  - ✅ Log all subscription changes

### Customer Data

- [ ] **PII Protection**
  - Encrypt sensitive customer data
  - Minimize data collection
  - Implement data retention policies
  - Allow data export/deletion (GDPR)

- [ ] **Entitlements Security**
  - ✅ Firestore rules prevent client writes
  - ✅ Only Cloud Functions update entitlements
  - ✅ Validate on every request
  - Cache entitlements with short TTL (5 min)

---

## Data Protection

### Firestore Security

- [ ] **Security Rules**
  - ✅ Deny all by default
  - ✅ Explicit allow rules for each collection
  - ✅ Validate data types and structure
  - ✅ Prevent entitlements tampering

```javascript
// Example secure rules
match /users/{uid} {
  allow read: if request.auth.uid == uid;
  allow create: if request.auth.uid == uid &&
    !request.resource.data.keys().hasAny(['entitlements', 'stripeCustomerId']);
  allow update: if request.auth.uid == uid &&
    !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['entitlements', 'stripeCustomerId', 'backupCodes']);
}
```

- [ ] **Data Validation**
  - Validate all input server-side
  - Sanitize user-generated content
  - Implement size limits
  - Check for malicious payloads

### Encryption

- [ ] **Data at Rest**
  - ✅ Firestore encryption enabled (automatic)
  - Encrypt sensitive fields with customer keys (optional)
  - Regular key rotation

- [ ] **Data in Transit**
  - ✅ HTTPS only (enforced)
  - ✅ TLS 1.2+ required
  - HSTS headers enabled
  - Certificate pinning (mobile apps)

### Backup & Recovery

- [ ] **Automated Backups**
  - Daily Firestore exports
  - Test restore procedures
  - Off-site backup storage
  - Encryption of backups

- [ ] **Disaster Recovery Plan**
  - Document recovery procedures
  - Assign responsibilities
  - Test DR plan quarterly
  - RTO/RPO targets defined

---

## Infrastructure Security

### Firebase Project

- [ ] **IAM & Permissions**
  - Principle of least privilege
  - Regular permission audits
  - Remove unused service accounts
  - MFA required for admins

- [ ] **API Quotas**
  - Monitor API usage
  - Set budget alerts
  - Implement rate limiting
  - Block abusive requests

- [ ] **Environment Separation**
  - Separate dev/staging/prod projects
  - Different API keys per environment
  - No production data in dev

### Cloud Functions

- [ ] **Function Security**
  - Verify authentication on all callable functions
  - Validate input parameters
  - Implement timeouts
  - Handle errors gracefully

- [ ] **Environment Variables**
  - Use Firebase Functions config
  - Never commit secrets to git
  - Rotate regularly
  - Audit access logs

- [ ] **Dependencies**
  - Regular security updates
  - Audit with `npm audit`
  - Pin versions in production
  - Monitor for vulnerabilities

### Hosting & CDN

- [ ] **Security Headers**
  ```javascript
  // firebase.json
  "headers": [
    {
      "source": "**",
      "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "DENY"},
        {"key": "X-XSS-Protection", "value": "1; mode=block"},
        {"key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains"},
        {"key": "Content-Security-Policy", "value": "default-src 'self'"}
      ]
    }
  ]
  ```

- [ ] **CORS Configuration**
  - Whitelist specific origins only
  - No wildcard (*) in production
  - Verify Origin header

---

## Monitoring & Incident Response

### Logging

- [ ] **Audit Logging**
  - All authentication events
  - MFA enrollment/unenrollment
  - Subscription changes
  - Failed access attempts
  - Admin actions

```typescript
interface AuditLog {
  timestamp: number;
  uid: string;
  action: string;
  result: "success" | "failure";
  ip: string;
  userAgent: string;
  metadata?: Record<string, any>;
}
```

- [ ] **Log Retention**
  - Keep security logs for 90 days minimum
  - Archive for 1 year
  - Secure log storage
  - Regular log review

### Monitoring

- [ ] **Alerts**
  - Failed authentication spike
  - Multiple MFA failures
  - Unusual API usage
  - Webhook failures
  - Payment processing errors

- [ ] **Metrics**
  - Authentication success/failure rates
  - MFA enrollment rates
  - Subscription churn
  - API latency and errors
  - Function execution times

### Incident Response

- [ ] **Response Plan**
  - Define severity levels
  - Assign incident commanders
  - Communication protocols
  - Escalation procedures

- [ ] **Security Incidents**
  - Detect: Automated alerts + manual monitoring
  - Contain: Isolate affected systems
  - Eradicate: Remove threat
  - Recover: Restore to normal
  - Learn: Post-mortem analysis

- [ ] **Breach Protocol**
  - Notify affected users within 72 hours
  - Report to authorities (GDPR, etc.)
  - Offer credit monitoring if needed
  - Document lessons learned

---

## Compliance

### GDPR (EU)

- [ ] Right to access data
- [ ] Right to deletion
- [ ] Right to data portability
- [ ] Cookie consent
- [ ] Privacy policy
- [ ] Data processing agreements

### PCI DSS (Payment Card Industry)

- [ ] Use Stripe for card processing (PCI compliant)
- [ ] Never store card numbers
- [ ] Use tokenization
- [ ] Secure transmission (HTTPS)

### SOC 2 (Optional)

- [ ] Access controls
- [ ] Encryption
- [ ] Monitoring
- [ ] Incident response
- [ ] Annual audit

---

## Regular Security Tasks

### Daily

- [ ] Monitor error logs
- [ ] Check failed authentication attempts
- [ ] Review webhook failures

### Weekly

- [ ] Review security alerts
- [ ] Check API quotas
- [ ] Audit new user signups

### Monthly

- [ ] `npm audit` and update dependencies
- [ ] Review Firestore security rules
- [ ] Check for abandoned accounts
- [ ] Analyze security metrics

### Quarterly

- [ ] Rotate API keys
- [ ] Review IAM permissions
- [ ] Test disaster recovery
- [ ] Security training for team
- [ ] Penetration testing (optional)

### Annually

- [ ] Comprehensive security audit
- [ ] Update security policies
- [ ] Review compliance requirements
- [ ] Evaluate new security tools

---

## Security Testing

### Manual Testing

- [ ] Test MFA enrollment flows
- [ ] Verify backup code recovery
- [ ] Test rate limiting
- [ ] Check session expiration
- [ ] Verify authorization on all endpoints

### Automated Testing

```typescript
// Example security test
describe("MFA Security", () => {
  it("should block enrollment without authentication", async () => {
    const res = await fetch("/api/mfa/enroll", {
      method: "POST",
      body: JSON.stringify({ code: "123456" }),
    });
    expect(res.status).toBe(401);
  });

  it("should rate limit backup code attempts", async () => {
    for (let i = 0; i < 6; i++) {
      await attemptBackupCode("wrong-code");
    }
    const res = await attemptBackupCode("any-code");
    expect(res.status).toBe(429); // Too Many Requests
  });
});
```

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Firebase Security Best Practices](https://firebase.google.com/docs/rules/best-practices)
- [Stripe Security](https://stripe.com/docs/security)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)

---

**Last Updated:** October 2025
**Version:** 1.0.0
