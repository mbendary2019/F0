#!/bin/bash

# Phase 63 Day 1: Deploy Daily Metrics Aggregation
# This script deploys all Phase 63 Day 1 components

set -e  # Exit on error

echo "🚀 Phase 63 Day 1 Deployment Script"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify build
echo -e "${BLUE}Step 1: Building functions...${NC}"
cd functions
pnpm build
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Build successful${NC}"
else
  echo -e "${YELLOW}❌ Build failed - please fix errors before deploying${NC}"
  exit 1
fi
cd ..
echo ""

# Step 2: Deploy Firestore configuration
echo -e "${BLUE}Step 2: Deploying Firestore configuration...${NC}"
echo "  → Deploying security rules..."
firebase deploy --only firestore:rules --project from-zero-84253
echo "  → Deploying indexes..."
firebase deploy --only firestore:indexes --project from-zero-84253
echo -e "${GREEN}✅ Firestore configuration deployed${NC}"
echo ""

# Step 3: Deploy functions
echo -e "${BLUE}Step 3: Deploying functions...${NC}"
echo "  → Deploying aggregateDailyMetrics (scheduled)..."
echo "  → Deploying aggregateDailyMetricsBackfill (callable)..."
echo "  → Deploying seedOpsEvents (callable)..."
firebase deploy --only functions:aggregateDailyMetrics,functions:aggregateDailyMetricsBackfill,functions:seedOpsEvents --project from-zero-84253
echo -e "${GREEN}✅ Functions deployed${NC}"
echo ""

# Step 4: Verify deployment
echo -e "${BLUE}Step 4: Verification...${NC}"
echo "  → Checking deployed functions..."
firebase functions:list --project from-zero-84253 | grep -E "(aggregateDailyMetrics|seedOpsEvents)"
echo ""

# Summary
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Phase 63 Day 1 Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "📋 Deployed Components:"
echo "  ✅ aggregateDailyMetrics (scheduled: 02:10 Asia/Kuwait)"
echo "  ✅ aggregateDailyMetricsBackfill (callable: admin-only)"
echo "  ✅ seedOpsEvents (callable: admin-only)"
echo "  ✅ Firestore rules for ops_metrics_daily"
echo "  ✅ Firestore indexes for date field"
echo ""
echo "🧪 Next Steps:"
echo "  1. Test seedOpsEvents to generate test data"
echo "  2. Run aggregateDailyMetricsBackfill to aggregate historical data"
echo "  3. Monitor scheduled function at 02:10 Asia/Kuwait time"
echo "  4. Check Firebase Console → Functions → Logs"
echo ""
echo "📚 Documentation:"
echo "  → English: PHASE_63_DAY1_COMPLETE.md"
echo "  → Arabic:  PHASE_63_DAY1_COMPLETE_AR.md"
echo ""
