#!/bin/bash

# Phase 58 + Critical Fixes - Deployment Script
# Run this script to deploy everything at once

set -e  # Exit on error

echo "🚀 Starting Phase 58 + Fixes Deployment..."
echo ""

# Step 1: Build Next.js
echo "📦 Step 1/4: Building Next.js..."
pnpm run build
echo "✅ Next.js build complete"
echo ""

# Step 2: Build Functions
echo "📦 Step 2/4: Building Cloud Functions..."
cd functions
pnpm run build
cd ..
echo "✅ Functions build complete"
echo ""

# Step 3: Deploy to Firebase
echo "🔥 Step 3/4: Deploying to Firebase..."
firebase deploy --only firestore:indexes,firestore:rules,functions:aggregateDailyMetrics,functions:exportDeployLogs,functions:exportDeployLogsCallable,functions:pollDeployStatus,functions:getDeployHistory,functions:weeklyCompactSnippets,hosting
echo "✅ Firebase deployment complete"
echo ""

# Step 4: Reminder
echo "⚠️  Step 4/4: Manual Action Required"
echo ""
echo "Please complete these manual steps:"
echo "1. Go to Firebase Console → Firestore → Indexes → TTL Policies"
echo "2. Create TTL Policy:"
echo "   - Collection: ops_rag_cache"
echo "   - Field: expire_at"
echo "3. Wait for status to change to 'Serving'"
echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📊 Next Steps:"
echo "1. Test RAG API: curl -X POST https://your-domain.com/api/rag/query \\"
echo "   -H 'Content-Type: application/json' \\"
echo "   -d '{\"q\":\"test\",\"workspaceId\":\"test\",\"topK\":8}'"
echo ""
echo "2. Test function: firebase functions:call aggregateDailyMetrics_manual --data='{\"date\":\"2025-11-05\"}'"
echo ""
echo "3. Run benchmark: TEST_WORKSPACE_ID=test pnpm tsx scripts/benchmark-rag.ts"
echo ""
echo "4. Monitor logs: firebase functions:log --follow"
echo ""
echo "✅ All done! Happy deploying! 🚀"
