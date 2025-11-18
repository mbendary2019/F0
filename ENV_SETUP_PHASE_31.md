# Phase 31 Environment Variables Setup

## 🔧 Required Environment Variables

### 1. Next.js Environment (`.env.local` or `.env.production`)

```bash
# Required: Your production domain
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com

# Firebase Config (from Firebase Console → Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Optional: WebSocket URL (from Phase 30)
NEXT_PUBLIC_WS_URL=https://us-central1-your-project.cloudfunctions.net
```

### 2. Cloud Functions Environment (Firebase Functions Config)

```bash
# Optional: Slack webhook for high-severity alerts
firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

---

## 📝 Setup Instructions

### For Local Development

1. Create `.env.local`:
   ```bash
   cp .env.example .env.local
   # Or create manually
   ```

2. Add your values:
   ```bash
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   # ... other variables
   ```

3. Restart dev server:
   ```bash
   npm run dev
   ```

---

### For Production (Vercel)

1. Set via CLI:
   ```bash
   vercel env add NEXT_PUBLIC_BASE_URL production
   # Enter: https://your-domain.com
   
   vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
   # Enter: your-project-id
   
   # ... repeat for all variables
   ```

2. Or via Vercel Dashboard:
   - Go to: Project → Settings → Environment Variables
   - Add each variable
   - Set scope: Production

3. Deploy:
   ```bash
   vercel deploy --prod
   ```

---

### For Production (Other Platforms)

#### Netlify
```bash
netlify env:set NEXT_PUBLIC_BASE_URL "https://your-domain.com"
# ... repeat for all variables
```

#### Railway
```bash
railway variables set NEXT_PUBLIC_BASE_URL=https://your-domain.com
# ... repeat for all variables
```

#### Custom Server
Add to your `.env.production` or server environment:
```bash
export NEXT_PUBLIC_BASE_URL=https://your-domain.com
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
# ... etc
```

---

### Cloud Functions (Firebase)

1. **Set Slack Webhook** (optional):
   ```bash
   firebase functions:config:set slack.webhook_url="YOUR_URL"
   ```

2. **Verify config**:
   ```bash
   firebase functions:config:get
   ```
   
   Output should show:
   ```json
   {
     "slack": {
       "webhook_url": "https://hooks.slack.com/services/..."
     }
   }
   ```

3. **Deploy functions again** to pick up config:
   ```bash
   firebase deploy --only functions:anomalyEngine
   ```

---

## 🔒 Security Best Practices

### ✅ DO:
- Use environment variables for all sensitive data
- Use different values for dev/staging/production
- Rotate Slack webhook URLs regularly
- Enable Firebase App Check in production
- Use Vercel/Netlify environment variable encryption

### ❌ DON'T:
- Commit `.env.local` or `.env.production` to git
- Share Slack webhook URLs publicly
- Use production Firebase credentials in development
- Hardcode any credentials in source code

---

## 🧪 Verification

### Test Environment Variables Loaded

1. **Next.js**:
   ```bash
   npm run build
   # Check build output for "NEXT_PUBLIC_*" variables
   ```

2. **Cloud Functions**:
   ```bash
   firebase functions:config:get
   ```

3. **Runtime test**:
   ```typescript
   // In any Next.js page/component:
   console.log('Base URL:', process.env.NEXT_PUBLIC_BASE_URL);
   ```

---

## 🆘 Troubleshooting

### Problem: Variables not loading

**Solution**:
1. Restart dev server (for local)
2. Redeploy (for production)
3. Check variable names match exactly (case-sensitive)
4. For `NEXT_PUBLIC_*` vars, they must start with that prefix

### Problem: Slack notifications not working

**Solution**:
1. Check webhook URL is correct
2. Verify it's set in Firebase config: `firebase functions:config:get`
3. Redeploy function: `firebase deploy --only functions:anomalyEngine`
4. Check function logs: `firebase functions:log --only anomalyEngine`
5. Test webhook directly: `curl -X POST -H 'Content-Type: application/json' -d '{"text":"Test"}' YOUR_WEBHOOK_URL`

### Problem: API calls failing with wrong URL

**Solution**:
1. Check `NEXT_PUBLIC_BASE_URL` is set correctly
2. Must include protocol (`https://`)
3. No trailing slash
4. For server-side calls, use absolute URL

---

## 📚 Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Firebase Functions Config](https://firebase.google.com/docs/functions/config-env)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

## 🎯 Quick Reference

| Variable | Required | Location | Purpose |
|----------|----------|----------|---------|
| `NEXT_PUBLIC_BASE_URL` | ✅ | Next.js | API calls |
| `NEXT_PUBLIC_FIREBASE_*` | ✅ | Next.js | Firebase SDK |
| `SLACK_WEBHOOK_URL` | ⚠️  Optional | Functions | Alerts |
| `NEXT_PUBLIC_WS_URL` | ⚠️  Optional | Next.js | Real-time |

---

**Last Updated**: 2025-10-10  
**Phase**: 31 - AI Insights & Anomaly Detection

