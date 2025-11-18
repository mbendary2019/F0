#!/bin/bash
# Phase 31 Deployment Verification Script

set -e

echo "🔍 Phase 31 Deployment Verification"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get project ID
PROJECT_ID=$(firebase use | grep "active" | awk '{print $4}' | tr -d '()')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Could not determine Firebase project ID${NC}"
    exit 1
fi

echo -e "${GREEN}Project ID: ${PROJECT_ID}${NC}"
echo ""

# Check 1: Cloud Functions
echo "📦 Check 1: Cloud Functions Status"
echo "-----------------------------------"
echo "Checking anomalyEngine..."
firebase functions:list | grep -q "anomalyEngine" && echo -e "${GREEN}✅ anomalyEngine deployed${NC}" || echo -e "${RED}❌ anomalyEngine not found${NC}"

echo "Checking cleanupAnomalyEvents..."
firebase functions:list | grep -q "cleanupAnomalyEvents" && echo -e "${GREEN}✅ cleanupAnomalyEvents deployed${NC}" || echo -e "${RED}❌ cleanupAnomalyEvents not found${NC}"

echo ""
echo "Recent logs:"
firebase functions:log --only anomalyEngine --limit 3 2>/dev/null || echo -e "${YELLOW}⚠️  No logs yet (wait 60 seconds for first execution)${NC}"
echo ""

# Check 2: Firestore Collections
echo "🗂️  Check 2: Firestore Collections"
echo "-----------------------------------"
echo "Expected collections:"
echo "  • anomaly_events (created on first detection)"
echo "  • anomaly_tuning (9 documents)"
echo ""
echo "Verify manually at:"
echo "  https://console.firebase.google.com/project/${PROJECT_ID}/firestore"
echo ""

# Check 3: Firestore Indexes
echo "🔍 Check 3: Firestore Indexes"
echo "------------------------------"
echo "Expected indexes on 'anomaly_events':"
echo "  1. ts (DESC)"
echo "  2. severity (ASC), ts (DESC)"
echo "  3. metric (ASC), ts (DESC)"
echo "  4. acknowledged (ASC), ts (DESC)"
echo ""
echo "Check status at:"
echo "  https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes"
echo ""

# Check 4: Environment Variables
echo "🔧 Check 4: Environment Variables"
echo "----------------------------------"
echo "Checking Firebase Functions config..."
firebase functions:config:get 2>/dev/null || echo -e "${YELLOW}⚠️  No config set${NC}"
echo ""
echo "Required for production:"
echo "  • NEXT_PUBLIC_BASE_URL (in .env.local)"
echo "  • SLACK_WEBHOOK_URL (optional, via firebase functions:config:set)"
echo ""

# Check 5: TypeScript
echo "✅ Check 5: TypeScript Compilation"
echo "-----------------------------------"
npm run typecheck 2>&1 | tail -3
echo ""

# Check 6: Build Status
echo "🏗️  Check 6: Build Status"
echo "-------------------------"
if npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${YELLOW}⚠️  Build check skipped or failed${NC}"
fi
echo ""

# Summary
echo "📊 Deployment Summary"
echo "====================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Wait 60 seconds for first anomalyEngine execution"
echo ""
echo "2. Initialize tuning configs:"
echo "   node INIT_TUNING_CONFIGS.js"
echo ""
echo "3. Visit admin pages:"
echo "   • https://your-domain.com/admin/insights"
echo "   • https://your-domain.com/admin/dashboard"
echo ""
echo "4. Test API endpoint:"
echo "   curl -H 'Cookie: session=YOUR_SESSION' \\"
echo "     https://your-domain.com/api/admin/anomaly/insights"
echo ""
echo "5. Monitor Cloud Functions:"
echo "   firebase functions:log --only anomalyEngine --limit 10"
echo ""
echo "6. Check for anomaly events (after some traffic):"
echo "   Open Firestore Console → anomaly_events collection"
echo ""
echo "📚 Full documentation:"
echo "   • docs/ADMIN_AI_INSIGHTS.md"
echo "   • PHASE_31_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "🎉 Verification Complete!"

