#!/bin/bash
# Phase 32 Deployment Script
# Predictive AI & Self-Healing Ops

set -e

echo "🚀 Phase 32 Deployment Script"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Prerequisites check
echo "📋 Step 1: Checking prerequisites..."
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Firebase CLI found${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found${NC}"
echo ""

# Step 2: TypeScript check
echo "🔍 Step 2: Running TypeScript check..."
npm run typecheck
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript check passed (0 errors)${NC}"
else
    echo -e "${RED}❌ TypeScript errors found. Please fix before deploying.${NC}"
    exit 1
fi
echo ""

# Step 3: Install function dependencies
echo "📦 Step 3: Installing function dependencies..."
cd functions
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
cd ..
echo ""

# Step 4: Deploy Cloud Functions
echo "☁️  Step 4: Deploying Cloud Functions..."
echo -e "${YELLOW}Deploying: forecastEngine, cleanupPredictions, selfHealEngine, revertSelfHeal, rootCause, rootCauseEndpoints${NC}"
firebase deploy --only \
  functions:forecastEngine,\
  functions:cleanupPredictions,\
  functions:selfHealEngine,\
  functions:revertSelfHeal,\
  functions:rootCause,\
  functions:rootCauseEndpoints

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cloud Functions deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Cloud Functions${NC}"
    exit 1
fi
echo ""

# Step 5: Deploy Firestore Indexes
echo "🗂️  Step 5: Deploying Firestore Indexes..."
firebase deploy --only firestore:indexes
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Firestore indexes deployed (will build in 5-10 min)${NC}"
else
    echo -e "${YELLOW}⚠️  Index deployment failed. Create manually in Firebase Console.${NC}"
fi
echo ""

# Step 6: Verification Instructions
echo "✅ Step 6: Verification Checklist"
echo "=================================="
echo ""
echo -e "${GREEN}1. Wait 15 minutes for first forecastEngine execution${NC}"
echo ""
echo -e "${GREEN}2. Check Cloud Functions logs:${NC}"
echo "   firebase functions:log --only forecastEngine --limit 5"
echo ""
echo -e "${GREEN}3. Visit Ops Copilot:${NC}"
echo "   https://your-domain.com/admin/ops-copilot"
echo ""
echo -e "${GREEN}4. Create a remediation rule:${NC}"
echo "   curl -X POST -H 'Content-Type: application/json' \\"
echo "     -H 'Cookie: session=...' \\"
echo "     -d '{\"metric\":\"errors\",\"comparator\":\">=\",\"threshold\":100,\"action\":\"disable_endpoint\",\"target\":\"/test\",\"enabled\":true}' \\"
echo "     https://your-domain.com/api/admin/remediation"
echo ""
echo -e "${GREEN}5. Verify Firestore Collections:${NC}"
echo "   • predictions_daily (should have documents after 15 min)"
echo "   • remediation_rules (check your created rule)"
echo "   • root_cause_graph (check after 60 min)"
echo ""
echo -e "${GREEN}6. Test Self-Healing:${NC}"
echo "   • Create rule with low threshold"
echo "   • Wait 5 minutes"
echo "   • Check admin_audit for self_heal action"
echo ""
echo "🎉 Phase 32 Deployment Complete!"
echo ""
echo "📚 Documentation:"
echo "   • docs/ADMIN_PREDICTIVE_AI.md"
echo "   • PHASE_32_PREDICTIVE_AI_SUMMARY.md"
echo ""

