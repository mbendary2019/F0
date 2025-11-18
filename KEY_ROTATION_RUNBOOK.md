// F0 Phase 36 - Key Rotation Runbook
# 🔑 Key Rotation Runbook

**Audience:** DevOps, Security Team  
**Priority:** HIGH - Rotate keys quarterly or on compromise  
**Last Updated:** October 11, 2025

---

## 📋 Overview

This runbook covers rotating **all** sensitive keys used in the F0 platform:
- Firebase Service Account
- Stripe API Keys
- OpenAI API Key
- Sentry DSN
- F0 API Keys
- App Check Tokens
- Database Passwords (if applicable)

**Rotation Frequency:**
- **Quarterly:** Routine rotation
- **Immediately:** On suspected compromise
- **After departure:** Team member with access leaves

---

## 1️⃣ Firebase Service Account

### Current Location
- `~/.secrets/firebase.json`
- CI/CD: `FIREBASE_SERVICE_ACCOUNT` (GitHub Secrets)
- Functions: Auto-loaded via `GOOGLE_APPLICATION_CREDENTIALS`

### Rotation Steps

```bash
# 1. Create new service account
# Go to: Firebase Console → Project Settings → Service Accounts
# Click "Generate New Private Key" → Download JSON

# 2. Test new key locally
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/new-key.json
firebase functions:log --project from-zero-84253

# 3. Update CI/CD secrets
# GitHub → Settings → Secrets → Update FIREBASE_SERVICE_ACCOUNT
# Paste the entire JSON content (base64 encoded if needed)

# 4. Update local dev
mv ~/.secrets/firebase.json ~/.secrets/firebase.json.old
cp /path/to/new-key.json ~/.secrets/firebase.json
chmod 600 ~/.secrets/firebase.json

# 5. Update ~/.zshrc
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/firebase.json"
source ~/.zshrc

# 6. Verify all services work
firebase deploy --only functions --project from-zero-84253

# 7. Delete old key from Firebase Console
# Wait 24-48 hours, monitor for errors
# If no errors, delete old service account

# 8. Secure disposal
shred -u ~/.secrets/firebase.json.old
```

**Rollback:** If issues occur, restore old key from `~/.secrets/firebase.json.old`

---

## 2️⃣ Stripe API Keys

### Current Location
- `.env.local`: `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`
- Functions: Auto-loaded from environment
- CI/CD: `STRIPE_SECRET_KEY` (GitHub Secrets)

### Rotation Steps

```bash
# 1. Generate new keys from Stripe Dashboard
# https://dashboard.stripe.com/test/apikeys
# Click "Create restricted key" (recommended) or "Reveal test key"

# 2. Test new keys locally
# Update .env.local with new keys
STRIPE_PUBLIC_KEY=pk_test_NEW_KEY_HERE
STRIPE_SECRET_KEY=sk_test_NEW_KEY_HERE

# Restart Next.js dev server
npm run dev

# Test checkout flow
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"plan":"monthly"}'

# 3. Update CI/CD
# GitHub → Settings → Secrets → Update STRIPE_SECRET_KEY

# 4. Deploy with new keys
firebase deploy --only functions

# 5. Monitor for 24 hours
# Check Stripe Dashboard for successful events

# 6. Roll old keys (don't delete immediately)
# Stripe Dashboard → API Keys → Roll key
# Keep old key active for 48 hours

# 7. After 48 hours, delete old keys
```

**Rollback:** Revert to old keys in `.env.local` and redeploy

---

## 3️⃣ OpenAI API Key

### Current Location
- `.env.local`: `OPENAI_API_KEY`
- `~/.zshrc`: `export OPENAI_API_KEY=...`
- Functions: Environment variable

### Rotation Steps

```bash
# 1. Generate new key
# https://platform.openai.com/api-keys
# Click "Create new secret key"

# 2. Update local environment
# Edit .env.local
OPENAI_API_KEY=sk-NEW_KEY_HERE

# Edit ~/.zshrc
export OPENAI_API_KEY=sk-NEW_KEY_HERE
source ~/.zshrc

# 3. Update Orchestrator
# Edit orchestrator/.env (if exists)

# 4. Test AI features
curl http://localhost:8787/api/run \
  -H "x-f0-key: $F0_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# 5. Update CI/CD
# GitHub → Settings → Secrets → Update OPENAI_API_KEY

# 6. Monitor usage
# https://platform.openai.com/usage
# Verify requests are using new key

# 7. Delete old key after 48 hours
```

---

## 4️⃣ F0 API Keys

### Current Location
- `.env.local`: `F0_API_KEY`
- `~/.zshrc`: `export F0_API_KEY=...`
- Orchestrator: `ORCHESTRATOR_DISABLE_AUTH=1` (dev only)

### Rotation Steps

```bash
# 1. Generate new key (32-byte random hex)
openssl rand -hex 32

# 2. Update environment
# Edit .env.local
F0_API_KEY=NEW_HEX_KEY_HERE

# Edit ~/.zshrc
export F0_API_KEY=NEW_HEX_KEY_HERE
source ~/.zshrc

# 3. Restart Orchestrator
# Kill existing process
pkill -f orchestrator

# Start with new key
cd orchestrator
npm run dev

# 4. Test API
curl http://localhost:8787/api/status \
  -H "x-f0-key: $F0_API_KEY"

# 5. Update all clients
# Web: src/app/api/tasks/run/route.ts
# Desktop: apps/desktop/.env
# Mobile: apps/mobile/.env

# 6. Deploy updates
firebase deploy --only hosting
```

---

## 5️⃣ Sentry DSN

### Current Location
- `.env.local`: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- Functions: `SENTRY_DSN`
- Web/Desktop/Mobile: Client DSN

### Rotation Steps

```bash
# 1. Regenerate DSN
# https://sentry.io/settings/YOUR_ORG/projects/YOUR_PROJECT/keys/
# Click "Regenerate" on existing key or "Create new key"

# 2. Update environment files
# Edit .env.local
SENTRY_DSN=https://NEW_KEY@sentry.io/PROJECT_ID
NEXT_PUBLIC_SENTRY_DSN=https://NEW_KEY@sentry.io/PROJECT_ID

# 3. Update CI/CD
# GitHub → Settings → Secrets → Update SENTRY_DSN

# 4. Deploy
npm run build
firebase deploy

# 5. Test error reporting
# Trigger intentional error
# Verify appears in Sentry dashboard

# 6. Disable old DSN after 48 hours
```

---

## 6️⃣ App Check Tokens

### Current Location
- Firebase Console → App Check
- Web: Debug tokens (dev), reCAPTCHA Enterprise (prod)
- Mobile: DeviceCheck (iOS), Play Integrity (Android)

### Rotation Steps

```bash
# Web (Debug Tokens - Dev only)
# 1. Firebase Console → App Check → Web App
# 2. Click "Manage debug tokens"
# 3. Generate new token
# 4. Update .env.local
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=NEW_TOKEN

# Production (reCAPTCHA Enterprise)
# 1. Cloud Console → reCAPTCHA Enterprise
# 2. Create new site key
# 3. Update Firebase App Check settings
# 4. Update frontend code with new site key
# 5. Deploy

# Mobile (iOS - DeviceCheck)
# No manual rotation needed (handled by Apple)

# Mobile (Android - Play Integrity)
# 1. Play Console → Release → App Integrity
# 2. Generate new token
# 3. Update Firebase App Check settings
# 4. Deploy new app version
```

---

## 7️⃣ Database Passwords (if applicable)

### Current Location
- Cloud SQL / PostgreSQL / MySQL
- Connection strings in environment

### Rotation Steps

```bash
# 1. Create new user with same permissions
CREATE USER 'f0_app_new'@'%' IDENTIFIED BY 'NEW_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON f0_db.* TO 'f0_app_new'@'%';
FLUSH PRIVILEGES;

# 2. Test new credentials
mysql -h HOST -u f0_app_new -p f0_db

# 3. Update connection strings
# Edit .env.local
DATABASE_URL=mysql://f0_app_new:NEW_PASSWORD@HOST/f0_db

# 4. Deploy
firebase deploy

# 5. Monitor for connection errors

# 6. Drop old user after 48 hours
DROP USER 'f0_app_old'@'%';
```

---

## 🚨 Emergency Rotation (Compromise Detected)

### Immediate Actions (< 1 hour)

```bash
# 1. ROTATE ALL KEYS IMMEDIATELY
# Follow steps 1-7 above in parallel

# 2. Revoke compromised keys
# Don't wait for testing - revoke now

# 3. Enable IP restrictions
# Stripe: Dashboard → Developers → API keys → IP whitelist
# Firebase: IAM → Service Account → Add condition

# 4. Force user re-authentication
# Firebase Console → Authentication → Users → Sign out all

# 5. Enable audit logging (if not already)
# All actions logged to /audits/{day}/events

# 6. Notify security team
# Email: security@example.com
# Slack: #security-alerts

# 7. Generate incident report
# Use /admin/audits dashboard
# Export CSV for forensics
```

### Post-Incident (< 24 hours)

```bash
# 1. Review audit logs
# Identify all actions by compromised key
# Check for unauthorized access

# 2. Assess damage
# Data exfiltration?
# Unauthorized deployments?
# Resource abuse?

# 3. Implement additional safeguards
# Enable 2FA for all admins
# Add IP whitelist
# Enable App Check
# Add rate limiting

# 4. Document incident
# Root cause analysis
# Timeline of events
# Prevention measures

# 5. Update runbook
# Add lessons learned
# Improve detection
```

---

## 📊 Key Rotation Checklist

Use this checklist for quarterly rotations:

- [ ] **Firebase Service Account** - Rotated, tested, old key deleted
- [ ] **Stripe API Keys** - Rotated, tested, old keys rolled
- [ ] **OpenAI API Key** - Rotated, tested, old key deleted
- [ ] **F0 API Keys** - Rotated, all clients updated
- [ ] **Sentry DSN** - Rotated, error reporting verified
- [ ] **App Check Tokens** - Web debug tokens rotated
- [ ] **CI/CD Secrets** - All GitHub Secrets updated
- [ ] **Local Environment** - `.env.local` and `~/.zshrc` updated
- [ ] **Documentation** - Runbook updated with any changes
- [ ] **Team Notification** - All team members informed

---

## 🔐 Best Practices

1. **Never commit keys to Git**
   - Use `.env.local` (in `.gitignore`)
   - Use GitHub Secrets for CI/CD
   - Use environment variables in production

2. **Use restricted keys when possible**
   - Stripe: Create restricted keys with minimal permissions
   - Firebase: Use service accounts with least privilege
   - OpenAI: Set usage limits on API keys

3. **Monitor key usage**
   - Stripe: Dashboard → Developers → Events
   - Firebase: IAM → Service Account activity
   - OpenAI: Usage dashboard

4. **Rotate on schedule**
   - Set calendar reminders for quarterly rotation
   - Document rotation in audit logs
   - Keep previous keys for 48-hour rollback window

5. **Test before disabling old keys**
   - Deploy with new keys
   - Monitor for 24-48 hours
   - Verify all services work
   - Then disable old keys

---

## 📞 Support

**Security Issues:**
- Email: security@example.com
- Slack: #security-alerts
- On-call: PagerDuty

**Key Management:**
- Docs: `/docs/KEY_ROTATION_RUNBOOK.md`
- Audit Dashboard: `/admin/audits`
- CI/CD: GitHub Actions logs

---

**Version:** 1.0.0  
**Last Reviewed:** October 11, 2025  
**Next Review:** January 11, 2026


