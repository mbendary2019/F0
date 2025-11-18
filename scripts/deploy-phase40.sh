#!/bin/bash
set -e

echo "=================================================="
echo "F0 Phase 40 - Autonomous Ecosystem (Full Loop)"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

echo "📋 Phase 40 will deploy:"
echo "  • Firestore Rules (4 new collections)"
echo "  • Firestore Indexes (ops_deploy_plans, ops_bus_messages)"
echo "  • 4 Cloud Functions:"
echo "    - autoDeploy (Schedule: every 30 min)"
echo "    - autoVerify (Schedule: every 15 min)"
echo "    - economicOptimizer (Schedule: every 30 min)"
echo "    - onBusMessage (Firestore Trigger)"
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
echo "☁️  Step 4: Deploying Phase 40 Functions..."
firebase deploy --only functions:autoDeploy,functions:autoVerify,functions:economicOptimizer,functions:onBusMessage

echo ""
echo "=================================================="
echo "✅ Phase 40 Deployment Complete!"
echo "=================================================="
echo ""
echo "📋 The Autonomous Loop is Now Active:"
echo ""
echo "🤖 Auto-Deploy Agent:"
echo "   • Scans draft policies every 30 minutes"
echo "   • Evaluates via Policy Guard"
echo "   • Auto-activates safe changes"
echo ""
echo "🔍 Auto-Verify & Recovery:"
echo "   • Monitors metrics every 15 minutes"
echo "   • Auto-rollback on regressions"
echo "   • MTTR < 5 minutes"
echo ""
echo "💰 Economic Optimizer:"
echo "   • Computes multi-objective score"
echo "   • Balances: reward, cost, latency, risk"
echo "   • Runs every 30 minutes"
echo ""
echo "🔗 AI-to-AI Bus:"
echo "   • Agents coordinate via messages"
echo "   • Real-time collaboration"
echo ""
echo "📊 Monitor at:"
echo "   • Deploy Plans: /api/ops/deploy/plans"
echo "   • Bus Messages: /api/ops/bus/messages"
echo "   • Economics: /api/ops/economics/router"
echo ""
echo "⚠️  Safety Controls:"
echo "   • Policy Guard mandatory for all changes"
echo "   • Governance rules enforced"
echo "   • All actions logged to ops_audit"
echo ""
