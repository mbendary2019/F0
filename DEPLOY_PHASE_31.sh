#!/bin/bash
# Phase 31 Deployment Script
# Run this script to deploy AI Insights & Anomaly Detection

set -e

echo "🚀 Phase 31 Deployment Script"
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
    echo -e "${RED}❌ Firebase CLI not found. Install with: npm i -g firebase-tools${NC}"
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
echo -e "${YELLOW}Deploying: anomalyEngine, cleanupAnomalyEvents${NC}"
firebase deploy --only functions:anomalyEngine,functions:cleanupAnomalyEvents
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cloud Functions deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Cloud Functions${NC}"
    exit 1
fi
echo ""

# Step 5: Deploy Firestore Indexes
echo "🗂️  Step 5: Deploying Firestore Indexes..."
if [ -f "firestore-indexes-phase31.json" ]; then
    echo -e "${YELLOW}Using firestore-indexes-phase31.json${NC}"
    firebase deploy --only firestore:indexes
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Firestore indexes deployed (will build in 5-10 min)${NC}"
    else
        echo -e "${YELLOW}⚠️  Index deployment failed. Create manually in Firebase Console.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  firestore-indexes-phase31.json not found. Create indexes manually.${NC}"
fi
echo ""

# Step 6: Environment Variables Check
echo "🔧 Step 6: Checking Environment Variables..."
echo ""
echo -e "${YELLOW}Required ENV variables:${NC}"
echo "  1. NEXT_PUBLIC_BASE_URL=https://your-domain.com"
echo "  2. SLACK_WEBHOOK_URL=https://hooks.slack.com/... (optional)"
echo ""
echo -e "${YELLOW}To set Slack webhook:${NC}"
echo "  firebase functions:config:set slack.webhook_url='YOUR_URL'"
echo "  firebase deploy --only functions:anomalyEngine"
echo ""

# Step 7: Initialize Tuning Configs
echo "⚙️  Step 7: Initialize Tuning Configs..."
echo ""
echo -e "${YELLOW}Run this script in Firebase Console or via custom function:${NC}"
echo ""
cat << 'EOF'
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const metrics = ['errors', 'calls', 'latency_p95'];
const windows = ['1m', '5m', '15m'];

async function initTuning() {
  for (const metric of metrics) {
    for (const window of windows) {
      const docId = `${metric}_${window}`;
      await db.collection('anomaly_tuning').doc(docId).set({
        metric,
        window,
        sensitivity: 3,
        fusionWeights: [0.5, 0.5],
        minSupport: 8,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      console.log(`Created: ${docId}`);
    }
  }
  console.log('✅ All tuning configs initialized');
}

initTuning();
EOF
echo ""

# Step 8: Deploy Next.js (optional)
echo "🌐 Step 8: Deploy Next.js Frontend..."
echo ""
read -p "Deploy Next.js now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run build
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build successful${NC}"
        echo -e "${YELLOW}Deploy with: npm run deploy OR vercel deploy --prod${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipped Next.js deployment${NC}"
fi
echo ""

# Step 9: Verification Instructions
echo "✅ Step 9: Verification Checklist"
echo "=================================="
echo ""
echo -e "${GREEN}1. Wait 60 seconds for first anomalyEngine execution${NC}"
echo ""
echo -e "${GREEN}2. Check Cloud Functions logs:${NC}"
echo "   firebase functions:log --only anomalyEngine --limit 5"
echo ""
echo -e "${GREEN}3. Visit Admin Pages:${NC}"
echo "   • /admin/dashboard → Check for insights banner"
echo "   • /admin/insights → View anomaly events"
echo ""
echo -e "${GREEN}4. Test API Endpoints:${NC}"
echo "   curl -H 'Cookie: session=...' https://your-domain.com/api/admin/anomaly/insights"
echo ""
echo -e "${GREEN}5. Verify Firestore:${NC}"
echo "   • Check 'anomaly_events' collection for documents"
echo "   • Check 'anomaly_tuning' collection (9 documents)"
echo ""
echo -e "${GREEN}6. Test Slack Notifications (if configured):${NC}"
echo "   • Trigger high-severity anomaly"
echo "   • Check Slack channel for notification"
echo ""
echo -e "${GREEN}7. Monitor for 24 hours:${NC}"
echo "   • Function executions: ~1440/day"
echo "   • Error rate: <1%"
echo "   • Detection latency: <60s"
echo ""
echo "🎉 Phase 31 Deployment Complete!"
echo ""
echo "📚 Documentation:"
echo "   • docs/ADMIN_AI_INSIGHTS.md"
echo "   • PHASE_31_AI_INSIGHTS_SUMMARY.md"
echo "   • PHASE_31_DEPLOYMENT_CHECKLIST.md"
echo ""

