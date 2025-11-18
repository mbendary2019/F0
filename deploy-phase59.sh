#!/bin/bash

# Phase 59 — Cognitive Memory Mesh - Deployment Script
# Run this script to deploy everything at once

set -e  # Exit on error

echo "🚀 Starting Phase 59 - Cognitive Memory Mesh Deployment..."
echo ""

# Step 1: Build Next.js
echo "📦 Step 1/5: Building Next.js..."
pnpm run build
echo "✅ Next.js build complete"
echo ""

# Step 2: Build Functions
echo "📦 Step 2/5: Building Cloud Functions..."
cd functions
pnpm run build
cd ..
echo "✅ Functions build complete"
echo ""

# Step 3: Deploy Firestore Config
echo "🔥 Step 3/5: Deploying Firestore indexes and rules..."
firebase deploy --only firestore:indexes,firestore:rules
echo "✅ Firestore config deployed"
echo ""

# Step 4: Deploy Functions
echo "🔥 Step 4/5: Deploying Cloud Functions..."
firebase deploy --only functions:weeklyRebuildMemoryGraphs,functions:rebuildMemoryGraph,functions:getMemoryGraphStats,functions:deleteMemoryGraph
echo "✅ Functions deployed"
echo ""

# Step 5: Deploy Hosting
echo "🔥 Step 5/5: Deploying Next.js hosting..."
firebase deploy --only hosting
echo "✅ Hosting deployed"
echo ""

# Manual action reminder
echo "⚠️  CRITICAL: Manual Action Required"
echo ""
echo "You MUST complete this step in Firebase Console:"
echo ""
echo "1. Go to: https://console.firebase.google.com/project/from-zero-84253/firestore/indexes"
echo "2. Click: TTL Policies tab"
echo "3. Click: Create TTL Policy"
echo "4. Configure:"
echo "   - Collection group: ops_memory_edges"
echo "   - TTL field: expire_at"
echo "5. Click: Create"
echo "6. Wait for status to show: Serving (5-10 minutes)"
echo ""
echo "Without TTL policy, old edges will not be automatically deleted!"
echo ""

# Success message
echo "🎉 Phase 59 Deployment Complete!"
echo ""
echo "📊 Next Steps:"
echo ""
echo "1. Enable TTL policy (see above)"
echo ""
echo "2. Test API endpoint:"
echo "   curl -X POST https://from-zero-84253.web.app/api/memory/query \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"workspaceId\":\"test\",\"queryText\":\"deploy\",\"topK\":10}'"
echo ""
echo "3. Test Cloud Function:"
echo "   firebase functions:call rebuildMemoryGraph --data='{\"workspaceId\":\"test\"}'"
echo ""
echo "4. Run benchmark:"
echo "   export TEST_WORKSPACE_ID=test"
echo "   pnpm tsx scripts/benchmark-memory-graph.ts"
echo ""
echo "5. Monitor logs:"
echo "   firebase functions:log --follow"
echo ""
echo "✅ All done! Happy deploying! 🚀"
echo ""
