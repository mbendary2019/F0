# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Known Vulnerabilities

### Current Status (as of latest build)

**10 moderate severity vulnerabilities** - All from `undici` package in Firebase client SDK dependencies.

#### Impact:
- **Severity**: Moderate (not critical)
- **Affected**: Firebase client SDK (`@firebase/auth`, `@firebase/firestore`, `@firebase/functions`)
- **Type**: Insufficiently Random Values & DoS via bad certificate data
- **Production Impact**: Low - These vulnerabilities are in dev/build dependencies and client-side Firebase SDK

#### Resolution Options:

**Option 1: Breaking Update (Recommended for new projects)**
```bash
npm audit fix --force
# This will upgrade firebase to v12.4.0 (may cause breaking changes)
```

**Option 2: npm overrides (Safe, Non-breaking)**
```json
// package.json
{
  "overrides": {
    "undici": "^7.0.0"
  }
}
```
Then run:
```bash
rm -rf node_modules package-lock.json
npm install
```

**Option 3: Accept Risk (Current approach)**
- Vulnerabilities are in client SDK dependencies
- Not exposed in server-side code
- Monitor for security updates from Firebase team
- Update when Firebase releases compatible fix

## Security Best Practices

### Environment Variables
- ✅ Never commit `.env.local` to git
- ✅ Use `.env.local.example` as template
- ✅ Rotate secrets regularly (especially `FB_PRIVATE_KEY`, `STRIPE_SECRET_KEY`)
- ✅ Use different keys for dev/staging/production

### Firebase Security Rules
```javascript
// Firestore example
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Deny all by default
    match /{document=**} {
      allow read, write: if false;
    }

    // User-specific data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### API Security
- ✅ All admin routes use `assertAuth()` with admin claim check
- ✅ Rate limiting implemented via `rateLimitGuard()`
- ✅ CORS configured in middleware
- ✅ Webhook signature verification for Stripe

### Stripe Security
- ✅ Webhook signature verification required
- ✅ Never expose `STRIPE_SECRET_KEY` to client
- ✅ Use Stripe Checkout/Billing Portal (PCI compliant)

## Reporting a Vulnerability

If you discover a security vulnerability, please email:
**security@f0agent.com**

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and aim to patch critical vulnerabilities within 7 days.

## Security Checklist for Deployment

### Before deploying to production:

- [ ] All environment variables configured correctly
- [ ] Firebase Security Rules deployed and tested
- [ ] Stripe webhook signature verification enabled
- [ ] CORS origins restricted to production domains
- [ ] Firebase Admin SDK credentials secured (not in git)
- [ ] SSL/TLS enabled (handled by Vercel/hosting platform)
- [ ] Rate limiting configured and tested
- [ ] Sentry/monitoring enabled (optional but recommended)
- [ ] Latest security patches applied: `npm audit`
- [ ] Test authentication flows (email, passkey, MFA)
- [ ] Verify DSAR/GDPR compliance endpoints work

### Regular Maintenance:

- Weekly: Check `npm audit` for new vulnerabilities
- Monthly: Review Firebase Security Rules
- Quarterly: Rotate sensitive credentials
- Annually: Security audit of entire codebase

## Additional Resources

- [Firebase Security Rules Guide](https://firebase.google.com/docs/rules)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/authentication)
