#!/bin/bash
set -e

echo "=================================================="
echo "F0 Phase 39 - Self-Governance & Ethical AI"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

echo "📋 Phase 39 will deploy:"
echo "  • Firestore Rules (ops_governance_policies, ops_risk_scores, ops_governance_reports)"
echo "  • Firestore Index (ops_risk_scores)"
echo "  • 3 Cloud Functions:"
echo "    - policyGuard (HTTPS)"
echo "    - governanceSweep (Schedule: every 15 min)"
echo "    - ethicalAuditor (Schedule: daily 3 AM UTC)"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

echo ""
echo "🔐 Step 1: Deploying Firestore Rules..."
firebase deploy --only firestore:rules

echo ""
echo "📊 Step 2: Deploying Firestore Indexes..."
firebase deploy --only firestore:indexes

echo ""
echo "🏗️  Step 3: Building Functions..."
cd functions
npm run build
cd ..

echo ""
echo "☁️  Step 4: Deploying Phase 39 Functions..."
firebase deploy --only functions:policyGuard,functions:governanceSweep,functions:ethicalAuditor

echo ""
echo "=================================================="
echo "✅ Phase 39 Deployment Complete!"
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo "1. Load governance policy:"
echo "   cd governance && cat router_safety_guard.yaml"
echo ""
echo "2. Test policy guard:"
echo "   curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/policyGuard \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"policyId\":\"router-core\",\"version\":\"1.0.1\"}'"
echo ""
echo "3. View risk scores:"
echo "   curl https://YOUR_DOMAIN/api/ops/risk/scores"
echo ""
echo "4. Monitor ethical auditor (runs daily at 3 AM UTC)"
echo ""
