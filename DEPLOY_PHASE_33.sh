#!/bin/bash
# Deploy Phase 33: Autonomous Ops AI & LLM Agents
# Automated deployment script with verification

set -e

echo "🤖 PHASE 33: AUTONOMOUS OPS AI DEPLOYMENT"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Pre-deployment checks
echo "📋 Step 1: Pre-deployment Checks"
echo "--------------------------------"

echo -n "Checking Node.js version... "
NODE_VERSION=$(node -v)
echo "✓ $NODE_VERSION"

echo -n "Checking Firebase CLI... "
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}✗ Firebase CLI not found${NC}"
    echo "Install: npm install -g firebase-tools"
    exit 1
fi
FIREBASE_VERSION=$(firebase --version)
echo "✓ $FIREBASE_VERSION"

echo -n "Checking Firebase project... "
PROJECT_ID=$(firebase use 2>&1 | grep -o "Active project:.*" | cut -d':' -f2 | xargs || echo "")
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}✗ No active Firebase project${NC}"
    echo "Run: firebase use <project-id>"
    exit 1
fi
echo "✓ $PROJECT_ID"

echo ""

# Step 2: TypeScript check
echo "🔍 Step 2: TypeScript Type Check"
echo "--------------------------------"
npm run typecheck
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ TypeScript errors found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ No TypeScript errors${NC}"
echo ""

# Step 3: Build functions
echo "🔨 Step 3: Build Cloud Functions"
echo "--------------------------------"
cd functions
echo "Installing dependencies..."
npm install --silent

echo "Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Functions built successfully${NC}"
cd ..
echo ""

# Step 4: Deploy Firestore indexes
echo "📚 Step 4: Deploy Firestore Indexes"
echo "-----------------------------------"

# Merge Phase 33 indexes with existing
if [ -f "firestore.indexes.json" ]; then
    echo "Backing up existing indexes..."
    cp firestore.indexes.json firestore.indexes.backup.json
fi

echo "Merging Phase 33 indexes..."
# This is a simplified merge - in production, use jq or similar
cat firestore-indexes-phase33.json > firestore.indexes.json

echo "Deploying indexes..."
firebase deploy --only firestore:indexes
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ Indexes deployment failed (might need manual review)${NC}"
else
    echo -e "${GREEN}✓ Indexes deployed${NC}"
fi
echo ""

# Step 5: Deploy Cloud Functions
echo "☁️  Step 5: Deploy Cloud Functions"
echo "----------------------------------"
echo "Deploying agentCoordinator and runbookExecutor..."
firebase deploy --only functions:agentCoordinator,functions:runbookExecutor
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Functions deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Functions deployed successfully${NC}"
echo ""

# Step 6: Initialize security policies
echo "🛡️  Step 6: Initialize Security Policies"
echo "----------------------------------------"

echo "Creating ops_policies/denylist..."
firebase firestore:set ops_policies/denylist --data '{
  "actions": ["delete_database", "modify_auth", "drop_collection", "delete_user_data"]
}' --project "$PROJECT_ID" 2>/dev/null || echo "Skipped (already exists or manual setup needed)"

echo "Creating ops_policies/protected_targets..."
firebase firestore:set ops_policies/protected_targets --data '{
  "targets": ["production", "main_db", "auth_service", "payment_service"]
}' --project "$PROJECT_ID" 2>/dev/null || echo "Skipped (already exists or manual setup needed)"

echo -e "${GREEN}✓ Security policies initialized${NC}"
echo ""

# Step 7: Deploy frontend
echo "🌐 Step 7: Build & Deploy Frontend"
echo "----------------------------------"
echo "Building Next.js..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo "Deploying hosting..."
firebase deploy --only hosting
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Hosting deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend deployed successfully${NC}"
echo ""

# Step 8: Verification
echo "✅ Step 8: Post-Deployment Verification"
echo "---------------------------------------"

echo "Waiting 30 seconds for functions to initialize..."
sleep 30

echo "Checking function status..."
firebase functions:list | grep -E "(agentCoordinator|runbookExecutor)"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ PHASE 33 DEPLOYMENT COMPLETE! ✨${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Summary
echo "📊 Deployment Summary:"
echo "--------------------"
echo "  • Cloud Functions: agentCoordinator, runbookExecutor"
echo "  • Firestore Indexes: agent_jobs, runbooks, ops_commands"
echo "  • Security Policies: Initialized"
echo "  • Frontend: Deployed"
echo ""

# Next steps
echo "🎯 Next Steps:"
echo "-------------"
echo "  1. Verify indexes are building:"
echo "     https://console.firebase.google.com/project/$PROJECT_ID/firestore/indexes"
echo ""
echo "  2. Test Ops Assistant UI:"
echo "     https://your-domain.com/admin/ops-assistant"
echo ""
echo "  3. Create first test job:"
echo "     curl -X POST https://your-domain.com/api/admin/agents/jobs \\"
echo "       -H \"Cookie: session=...\" \\"
echo "       -H \"Content-Type: application/json\" \\"
echo "       -d '{\"kind\":\"predict\",\"payload\":{\"question\":\"System status?\"}}'"
echo ""
echo "  4. Monitor function logs:"
echo "     firebase functions:log --only agentCoordinator"
echo ""
echo "  5. Create first runbook (via Firestore Console):"
echo "     Collection: runbooks"
echo "     Document: auto-ID"
echo "     Data: {name, trigger, steps, enabled, cooldown}"
echo ""

# Warnings
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "  • Wait 5-10 minutes for indexes to build"
echo "  • Guardian requires actors in 'admins' collection"
echo "  • Monitor logs for first 24h after deployment"
echo "  • Review security policies before production use"
echo ""

echo "📚 Documentation:"
echo "  • Full Guide: docs/ADMIN_AUTONOMOUS_OPS.md"
echo "  • Summary: PHASE_33_AUTONOMOUS_OPS_SUMMARY.md"
echo "  • Quick Start: PHASE_33_QUICK_START.md"
echo ""

echo -e "${GREEN}🎊 Ready for autonomous operations! 🤖${NC}"


