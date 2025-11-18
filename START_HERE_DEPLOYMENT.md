# 🚀 START HERE - Phase 58 Deployment

> Quick start guide for deploying Phase 58 + Critical Fixes

---

## ⚡ One-Line Deployment

### Option 1: Using Script (Recommended)

```bash
./deploy-phase58.sh
```

### Option 2: Direct Command

```bash
pnpm run build && \
cd functions && pnpm run build && cd .. && \
firebase deploy --only firestore:indexes,firestore:rules,functions:aggregateDailyMetrics,functions:exportDeployLogs,functions:exportDeployLogsCallable,functions:pollDeployStatus,functions:getDeployHistory,functions:weeklyCompactSnippets,hosting
```

---

## ⚠️ After Deployment

### Enable TTL Policy (Required)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Firestore → Indexes → TTL Policies
3. Click **Create TTL Policy**
4. Set:
   - **Collection:** `ops_rag_cache`
   - **Field:** `expire_at`
5. Wait for status: "Building" → "Serving"

---

## 🧪 Test Your Deployment

### 1. Test RAG API

```bash
curl -X POST https://your-domain.com/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "q": "how to deploy",
    "workspaceId": "test",
    "topK": 8
  }'
```

### 2. Test Functions

```bash
# Test manual trigger
firebase functions:call aggregateDailyMetrics_manual --data='{"date":"2025-11-05"}'

# Test deploy status
firebase functions:call pollDeployStatus --data='{"jobId":"test_job"}'
```

### 3. Run Benchmark

```bash
TEST_WORKSPACE_ID=your_workspace pnpm tsx scripts/benchmark-rag.ts
```

### 4. Monitor Logs

```bash
firebase functions:log --follow
```

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| **[DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md)** | Quick deployment summary |
| **[النشر_النهائي_جاهز.md](./النشر_النهائي_جاهز.md)** | Arabic deployment guide |
| **[PHASE_58_COMPLETE.md](./PHASE_58_COMPLETE.md)** | Complete implementation guide |
| **[PHASE_58_DEPLOYMENT_GUIDE.md](./PHASE_58_DEPLOYMENT_GUIDE.md)** | Detailed deployment steps |
| **[PHASE_58_QUICK_REFERENCE.md](./PHASE_58_QUICK_REFERENCE.md)** | Developer cheat sheet |

---

## ✅ What's Included

### Phase 58: RAG System
- ✅ Adaptive RAG with 3 strategies (dense/sparse/hybrid)
- ✅ Intelligent semantic routing
- ✅ Query caching with TTL
- ✅ MMR re-ranking
- ✅ Performance metrics tracking

### Critical Fixes
- ✅ Firebase Admin exports fixed
- ✅ 6 Cloud Functions converted to v2
- ✅ Next.js dynamic routes fixed
- ✅ All builds passing

---

## 🎯 Success Metrics

Track these after deployment:

- **RAG P95 Latency:** Target ≤ 400ms
- **Cache Hit Rate:** Target > 30%
- **Error Rate:** Target < 1%
- **Uptime:** Target > 99.9%

---

## 🐛 Troubleshooting

### Build Fails

```bash
# Check for errors
pnpm run build
cd functions && pnpm run build

# If still failing, check:
# - Node version (should be 18+)
# - Firebase CLI updated
# - Dependencies installed
```

### Deployment Fails

```bash
# Check Firebase login
firebase login

# Check project
firebase use --add

# Try deploying incrementally
firebase deploy --only firestore:indexes
firebase deploy --only functions:aggregateDailyMetrics
firebase deploy --only hosting
```

### TTL Policy Not Working

- Wait 5-10 minutes after creation
- Check status in Firebase Console
- Verify field name is exactly `expire_at`

---

## 💡 Quick Tips

1. **Test locally first:** Run builds before deploying
2. **Deploy incrementally:** Deploy functions one by one if needed
3. **Monitor logs:** Keep logs open for first 15 minutes
4. **Check metrics:** Run benchmark after 1 hour

---

## 📞 Need Help?

- Check [DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md) for troubleshooting
- See [PHASE_58_COMPLETE.md](./PHASE_58_COMPLETE.md) for detailed docs
- Arabic guide: [النشر_النهائي_جاهز.md](./النشر_النهائي_جاهز.md)

---

## 🎉 Ready to Deploy!

Just run:
```bash
./deploy-phase58.sh
```

**Good luck!** 🚀
