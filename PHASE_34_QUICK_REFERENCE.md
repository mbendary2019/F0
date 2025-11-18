# Phase 34 - Quick Reference Card 🚀

## Essential Commands

### Health Checks
```bash
# Full system health check
./scripts/check-status.sh

# Check Cloud Functions
curl https://readyz-vpxyxgcfbq-uc.a.run.app

# Verify security rules
./scripts/verify-security.sh
```

### Deployment
```bash
# Full deployment
npm run build && firebase deploy

# Hosting only
firebase deploy --only hosting

# Functions only
firebase deploy --only functions

# Rules only
firebase deploy --only firestore:rules
```

### Monitoring
```bash
# View recent logs (last 10)
firebase functions:log

# Follow logs in real-time
firebase functions:log --follow

# Filter by function
firebase functions:log --only functionName

# Limit number of entries
firebase functions:log --limit 50
```

### Local Testing
```bash
# Start Firebase emulators
firebase emulators:start

# Start specific emulator
firebase emulators:start --only firestore

# Test with UI
firebase emulators:start --import=./data
```

## Critical URLs

### Production Endpoints
- **Hosting:** https://from-zero-84253.firebaseapp.com
- **Health Check:** https://readyz-vpxyxgcfbq-uc.a.run.app
- **Firebase Console:** https://console.firebase.google.com/project/from-zero-84253

### Development
- **Local Dev:** http://localhost:3000
- **Emulator UI:** http://localhost:4000 (when running)

## Environment Variables

### Required for Production
```bash
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# App Check
NEXT_PUBLIC_APPCHECK_SITE_KEY=
NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=true  # Dev only

# Optional: Sentry
NEXT_PUBLIC_SENTRY_DSN=
```

### GitHub Secrets (for CI/CD)
```
FIREBASE_SERVICE_ACCOUNT
FIREBASE_PROJECT_ID
FIREBASE_TOKEN
(All NEXT_PUBLIC_* variables from above)
```

## Security Rules Pattern

### Helper Functions
```javascript
function isSignedIn() {
  return request.auth != null;
}

function isOwner(uid) {
  return isSignedIn() && request.auth.uid == uid;
}

function isAdmin() {
  return isSignedIn() && request.auth.token.admin == true;
}

function hasRole(role) {
  return isSignedIn() && request.auth.token.role == role;
}
```

### Common Patterns
```javascript
// Public read, auth write
allow read: if true;
allow write: if isSignedIn();

// Owner only
allow read, write: if isOwner(uid);

// Admin only
allow read, write: if isAdmin();

// Cloud Functions only
allow write: if false;
```

## Cache Headers (firebase.json)

```json
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|png|webp|svg|ico)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "**/*.@(js|css)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "**/*.@(woff|woff2|ttf|otf|eot)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

## Troubleshooting

### Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Deployment Issues
```bash
# Check Firebase CLI version
firebase --version

# Re-authenticate
firebase logout
firebase login

# Check current project
firebase use

# Switch project
firebase use <project-id>
```

### Function Errors
```bash
# Check function logs
firebase functions:log --only functionName

# Test function locally
firebase emulators:start --only functions

# Deploy single function
firebase deploy --only functions:functionName
```

### Permission Denied
```bash
# Check Firestore rules
firebase deploy --only firestore:rules --dry-run

# Test rules locally
firebase emulators:start --only firestore

# View rules in console
# Firebase Console → Firestore → Rules
```

## Performance Optimization Checklist

- [ ] Use `next/image` for all images
- [ ] Enable SWC minification (already configured)
- [ ] Configure CDN caching headers (already configured)
- [ ] Lazy load heavy components
- [ ] Use dynamic imports for code splitting
- [ ] Optimize bundle size with webpack-bundle-analyzer
- [ ] Enable Brotli compression on hosting
- [ ] Preload critical resources
- [ ] Use font-display: swap for web fonts

## Monitoring Checklist

- [ ] Firebase Console → Functions → Logs (daily check)
- [ ] Google Cloud Monitoring (set up alerts)
- [ ] Sentry error tracking (configure if needed)
- [ ] Health check endpoint (monitor uptime)
- [ ] Analytics dashboard (user behavior)
- [ ] Performance metrics (Core Web Vitals)
- [ ] Security audit (monthly review)

## Quick Fixes

### "Permission denied" in Firestore
1. Check user is authenticated: `request.auth != null`
2. Verify custom claims: `request.auth.token.admin`
3. Update rules: `firebase deploy --only firestore:rules`

### "Function not responding"
1. Check logs: `firebase functions:log`
2. Verify environment variables
3. Increase timeout in function config
4. Check function memory allocation

### "Build failing"
1. Check TypeScript errors: `npm run type-check`
2. Check ESLint: `npm run lint`
3. Clear cache: `rm -rf .next`
4. Rebuild: `npm run build`

### "Deployment failed"
1. Check Firebase project: `firebase use`
2. Verify authentication: `firebase login`
3. Check quota limits in console
4. Review deployment logs

## Emergency Rollback

```bash
# List recent deployments
firebase hosting:channel:list

# Rollback hosting
firebase hosting:clone SOURCE:CHANNEL DEST:live

# Rollback functions
firebase deploy --only functions --except functionToSkip

# Restore from backup
firebase firestore:restore --collection=collectionName
```

## Support & Documentation

- **Firebase Docs:** https://firebase.google.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Sentry Docs:** https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Project Docs:** See PHASE_34_COMPLETE.md

## Status Dashboard

Check system status:
```bash
./scripts/check-status.sh
```

Expected output:
- ✅ Firebase Hosting: Live
- ✅ Cloud Functions: Healthy
- ✅ Firestore Rules: Valid
- ✅ Environment: Configured
- ✅ Build: Complete
- ✅ Firebase CLI: Connected
