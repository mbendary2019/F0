# Phase 53 Day 7: Secrets Setup Guide

## Overview
This guide covers secure configuration of embedding providers using Firebase Functions Secrets (best practice for production).

---

## 🔐 Why Use Secrets?

**Firebase Functions Secrets** (recommended):
- ✅ Secure storage in Google Secret Manager
- ✅ Automatic encryption at rest
- ✅ IAM-based access control
- ✅ Versioning and rotation support
- ✅ Works with Firebase Functions v2
- ✅ No accidental exposure in logs

**Functions Config** (legacy):
- ⚠️ Less secure (stored in plain text)
- ⚠️ No built-in rotation
- ⚠️ Works with v1 functions only
- ℹ️ Still useful for non-sensitive config

---

## 📝 Configuration Options

### Option 1: OpenAI (Recommended for Quality)

**Pricing**:
- `text-embedding-3-small`: $0.00002 per 1K tokens (~$0.02 per 1M tokens)
- `text-embedding-3-large`: $0.00013 per 1K tokens (~$0.13 per 1M tokens)

**Dimensions**:
- `text-embedding-3-small`: 1536 dimensions
- `text-embedding-3-large`: 3072 dimensions

**Setup**:
```bash
# 1. Store API key as secret
firebase functions:secrets:set OPENAI_API_KEY
# Paste your key when prompted: sk-proj-xxxxx

# 2. Configure provider and model
firebase functions:config:set \
  embeddings.provider="openai" \
  embeddings.model="text-embedding-3-small"
```

### Option 2: Cloudflare AI Workers (Recommended for Free Tier)

**Pricing**:
- Free tier: 10,000 requests/day
- Paid: $0.011 per 1,000 requests after free tier

**Dimensions**:
- `@cf/baai/bge-base-en-v1.5`: 768 dimensions
- `@cf/baai/bge-large-en-v1.5`: 1024 dimensions

**Setup**:
```bash
# 1. Store Cloudflare credentials as secrets
firebase functions:secrets:set CF_ACCOUNT_ID
# Enter your Cloudflare account ID

firebase functions:secrets:set CF_API_TOKEN
# Enter your Cloudflare API token

# 2. Configure provider and model
firebase functions:config:set \
  embeddings.provider="cloudflare" \
  embeddings.model="@cf/baai/bge-base-en-v1.5"
```

---

## 🔧 Updating Provider Code for Secrets

Our current implementation uses `functions.config()` (v1 pattern). For v2 with secrets, we need to update the provider code.

### Updated Provider (Secrets Support)

**File**: `functions/src/lib/embeddings/provider.ts`

```typescript
import fetch from 'node-fetch';
import * as functions from 'firebase-functions/v1';

export type EmbedResult = {
  vector: number[];
  model: string;
  dim: number;
};

type ProviderType = 'openai' | 'cloudflare';

/**
 * Get API keys from environment (supports both secrets and config)
 */
function getOpenAIKey(): string | undefined {
  // Priority: Secrets (process.env) > Config (functions.config())
  return (
    process.env.OPENAI_API_KEY ||
    functions.config().openai?.key
  );
}

function getCloudflareCredentials(): {
  accountId?: string;
  apiToken?: string;
} {
  return {
    accountId:
      process.env.CF_ACCOUNT_ID ||
      functions.config().cloudflare?.account_id,
    apiToken:
      process.env.CF_API_TOKEN ||
      functions.config().cloudflare?.api_token,
  };
}

/**
 * Determine which provider to use
 */
function pickProvider(): ProviderType {
  const config = functions.config();

  // Check explicit provider setting
  const explicitProvider = config.embeddings?.provider;
  if (explicitProvider === 'openai' || explicitProvider === 'cloudflare') {
    return explicitProvider;
  }

  // Fallback: prefer OpenAI if key exists
  if (getOpenAIKey()) {
    return 'openai';
  }

  // Default to Cloudflare
  return 'cloudflare';
}

// ... rest of the implementation remains the same
```

### Deploying with Secrets

When deploying functions that use secrets, you must grant access:

```bash
# Deploy with secret access
firebase deploy --only functions:generateMemoryEmbedding \
  --set-secret OPENAI_API_KEY

# Or for Cloudflare
firebase deploy --only functions:generateMemoryEmbedding \
  --set-secret CF_ACCOUNT_ID \
  --set-secret CF_API_TOKEN
```

---

## 🚀 Complete Setup Steps

### Prerequisites
1. Firebase project on Blaze plan (required for secrets)
2. Firebase CLI version 11.14.0 or later
3. API keys from provider (OpenAI or Cloudflare)

### Step-by-Step Setup

#### For OpenAI

```bash
# 1. Create secret for API key
firebase functions:secrets:set OPENAI_API_KEY
# Paste: sk-proj-xxxxxxxxxxxxx

# 2. Configure provider preferences
firebase functions:config:set \
  embeddings.provider="openai" \
  embeddings.model="text-embedding-3-small"

# 3. Build functions
cd functions
pnpm build

# 4. Deploy with secret access
firebase deploy \
  --only functions:generateMemoryEmbedding,functions:regenerateEmbedding,functions:backfillEmbeddings \
  --set-secret OPENAI_API_KEY

# 5. Verify deployment
firebase functions:list | grep -E "Memory|embedding"
```

#### For Cloudflare

```bash
# 1. Create secrets for credentials
firebase functions:secrets:set CF_ACCOUNT_ID
# Enter: your-account-id

firebase functions:secrets:set CF_API_TOKEN
# Enter: your-api-token

# 2. Configure provider preferences
firebase functions:config:set \
  embeddings.provider="cloudflare" \
  embeddings.model="@cf/baai/bge-base-en-v1.5"

# 3. Build functions
cd functions
pnpm build

# 4. Deploy with secret access
firebase deploy \
  --only functions:generateMemoryEmbedding,functions:regenerateEmbedding,functions:backfillEmbeddings \
  --set-secret CF_ACCOUNT_ID \
  --set-secret CF_API_TOKEN

# 5. Verify deployment
firebase functions:list | grep -E "Memory|embedding"
```

---

## 🔍 Verifying Configuration

### Check Secrets
```bash
# List all secrets
firebase functions:secrets:list

# Expected output:
# ┌─────────────────┬─────────┬────────────────────┐
# │ Secret          │ State   │ Updated            │
# ├─────────────────┼─────────┼────────────────────┤
# │ OPENAI_API_KEY  │ ACTIVE  │ 2025-11-06 14:30   │
# └─────────────────┴─────────┴────────────────────┘
```

### Check Config
```bash
# View runtime config
firebase functions:config:get

# Expected output:
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small"
  }
}
```

### Test Function
```bash
# View function logs
firebase functions:log --only generateMemoryEmbedding

# Look for:
# [embeddings] Generating embedding { provider: 'openai', textLength: 245 }
# [embeddings:openai] Success { model: 'text-embedding-3-small', dim: 1536 }
```

---

## 🔄 Managing Secrets

### Update Secret Value
```bash
# Update existing secret
firebase functions:secrets:set OPENAI_API_KEY
# Enter new value

# Redeploy functions to use new value
firebase deploy --only functions:generateMemoryEmbedding
```

### Access Secret from Multiple Functions
```bash
# Grant access to multiple functions at once
firebase deploy \
  --only functions:generateMemoryEmbedding,functions:regenerateEmbedding,functions:backfillEmbeddings \
  --set-secret OPENAI_API_KEY
```

### Destroy Secret (Careful!)
```bash
# Remove secret (DANGEROUS - functions will fail)
firebase functions:secrets:destroy OPENAI_API_KEY
```

### View Secret Metadata
```bash
# Get secret details
firebase functions:secrets:get OPENAI_API_KEY

# Output shows:
# - Version
# - State (ACTIVE/DISABLED)
# - Last updated
# - Functions using it
```

---

## 🧪 Local Development

For local testing with emulators, use `.env` file:

**Create** `functions/.env`:
```bash
# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# OR Cloudflare
CF_ACCOUNT_ID=your-account-id
CF_API_TOKEN=your-api-token

# Provider config
EMBEDDINGS_PROVIDER=openai
EMBEDDINGS_MODEL=text-embedding-3-small
```

**Start emulators**:
```bash
firebase emulators:start
```

The emulator will automatically load `.env` variables.

---

## 💰 Cost Estimation

### OpenAI Costs

**Assumptions**:
- Average memory item: 200 tokens (~800 chars)
- 100 memory items per day
- Using `text-embedding-3-small`

**Calculation**:
```
Cost per item = 200 tokens × $0.00002 / 1000 = $0.000004
Daily cost = 100 items × $0.000004 = $0.0004
Monthly cost = 30 days × $0.0004 = $0.012 (~$0.01)
```

**For 10,000 memory items**:
```
Total cost = 10,000 × $0.000004 = $0.04
```

Extremely affordable! 💸

### Cloudflare Costs

**Free tier**: 10,000 requests/day
- For most applications, free tier is sufficient
- Even at 100 items/day, you're well within limits

**After free tier**: $0.011 per 1,000 requests
- 10,000 items = $0.11

Also very affordable! 💸

---

## 🛡️ Security Best Practices

### DO ✅
- ✅ Use secrets for all API keys
- ✅ Rotate secrets periodically
- ✅ Use `.env` for local development only
- ✅ Add `.env` to `.gitignore`
- ✅ Use separate keys for dev/prod
- ✅ Monitor secret access in Cloud Console

### DON'T ❌
- ❌ Commit API keys to Git
- ❌ Share API keys in chat/email
- ❌ Use same key across projects
- ❌ Log API keys (even in debug mode)
- ❌ Store keys in client-side code
- ❌ Use production keys in development

---

## 📊 Monitoring

### Cloud Console
```
1. Open Google Cloud Console
2. Navigate to Secret Manager
3. View secret access logs
4. Monitor secret versions
5. Check IAM permissions
```

### Function Logs
```bash
# View embedding generation logs
firebase functions:log --only generateMemoryEmbedding | grep -i embedding

# Check for errors
firebase functions:log --only generateMemoryEmbedding | grep -i error

# Monitor success rate
firebase functions:log --only generateMemoryEmbedding | grep -i success
```

### Firestore Monitoring
```javascript
// Query failed embeddings
db.collection('ops_collab_embeddings')
  .where('status', '==', 'error')
  .get()
  .then(snap => {
    console.log(`Failed embeddings: ${snap.size}`);
    snap.forEach(doc => {
      console.log(`${doc.id}: ${doc.data().error}`);
    });
  });
```

---

## 🔧 Troubleshooting

### Issue: "Secret not found"
**Solution**:
```bash
# Verify secret exists
firebase functions:secrets:list

# If missing, create it
firebase functions:secrets:set OPENAI_API_KEY

# Redeploy with secret access
firebase deploy --only functions:generateMemoryEmbedding --set-secret OPENAI_API_KEY
```

### Issue: "Permission denied" on secret access
**Solution**:
```bash
# Grant your service account access
# In Google Cloud Console:
# 1. Go to IAM & Admin > Service Accounts
# 2. Find your Firebase service account
# 3. Add role: "Secret Manager Secret Accessor"
```

### Issue: Embeddings still using old config
**Solution**:
```bash
# Functions cache config, restart them
firebase functions:delete generateMemoryEmbedding
firebase deploy --only functions:generateMemoryEmbedding --set-secret OPENAI_API_KEY
```

### Issue: High costs
**Solution**:
```bash
# Switch to Cloudflare
firebase functions:config:set embeddings.provider="cloudflare"

# OR use smaller OpenAI model
firebase functions:config:set embeddings.model="text-embedding-3-small"

# Redeploy
firebase deploy --only functions
```

---

## 📝 Quick Reference

### OpenAI Setup (One Command)
```bash
firebase functions:secrets:set OPENAI_API_KEY && \
firebase functions:config:set embeddings.provider="openai" embeddings.model="text-embedding-3-small" && \
cd functions && pnpm build && cd .. && \
firebase deploy --only functions:generateMemoryEmbedding,functions:regenerateEmbedding,functions:backfillEmbeddings --set-secret OPENAI_API_KEY
```

### Cloudflare Setup (One Command)
```bash
firebase functions:secrets:set CF_ACCOUNT_ID && \
firebase functions:secrets:set CF_API_TOKEN && \
firebase functions:config:set embeddings.provider="cloudflare" embeddings.model="@cf/baai/bge-base-en-v1.5" && \
cd functions && pnpm build && cd .. && \
firebase deploy --only functions:generateMemoryEmbedding,functions:regenerateEmbedding,functions:backfillEmbeddings --set-secret CF_ACCOUNT_ID --set-secret CF_API_TOKEN
```

---

## ✅ Checklist

### Before Deployment
- [ ] Firebase project on Blaze plan
- [ ] Firebase CLI updated (≥11.14.0)
- [ ] API keys obtained from provider
- [ ] Secrets created (`firebase functions:secrets:set`)
- [ ] Config set (`firebase functions:config:set`)
- [ ] Functions built (`pnpm build`)

### After Deployment
- [ ] Functions deployed successfully
- [ ] Secrets listed (`firebase functions:secrets:list`)
- [ ] Config verified (`firebase functions:config:get`)
- [ ] Test memory creation triggers embedding
- [ ] Check logs for errors
- [ ] Monitor costs in billing dashboard

---

**Generated**: November 6, 2025
**Phase**: 53 Day 7
**Topic**: Secrets Setup
**Status**: Ready for Deployment ✅
