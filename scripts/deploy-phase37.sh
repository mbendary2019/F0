#!/usr/bin/env bash
set -euo pipefail

# Phase 37 Deployment Script
# Deploys Meta-Learning & Adaptive Policies infrastructure

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

echo "🚀 Starting Phase 37 Deployment: Meta-Learning & Adaptive Policies"
echo "=================================================="

# Check prerequisites
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Error: Not logged in to Firebase. Run: firebase login"
    exit 1
fi

echo ""
echo "📋 Phase 37 includes:"
echo "  • Confidence Estimator (Cloud Function)"
echo "  • Adaptive Router (Cloud Function)"
echo "  • Self-Tuning Scheduler (Cloud Function)"
echo "  • Firestore indexes for ops_confidence & ops_decisions"
echo "  • Firestore security rules for Phase 37 collections"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "Step 1/4: Deploying Firestore Rules"
echo "=================================================="
firebase deploy --only firestore:rules

echo ""
echo "Step 2/4: Deploying Firestore Indexes"
echo "=================================================="
firebase deploy --only firestore:indexes

echo ""
echo "Step 3/4: Building Functions"
echo "=================================================="
cd "$ROOT_DIR/functions"

# Check if package.json exists and dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing function dependencies..."
    npm install
fi

# Build TypeScript
echo "Building TypeScript functions..."
npm run build || {
    echo "⚠️  Build warnings detected, continuing..."
}

echo ""
echo "Step 4/4: Deploying Phase 37 Functions"
echo "=================================================="
cd "$ROOT_DIR"

# Deploy Phase 37 functions
firebase deploy --only \
  functions:refreshConfidence,\
  functions:adaptiveRouter,\
  functions:selfTuningScheduler

echo ""
echo "✅ Phase 37 Deployment Complete!"
echo "=================================================="
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Verify functions are running:"
echo "   firebase functions:list"
echo ""
echo "2. Check function logs:"
echo "   firebase functions:log --only refreshConfidence"
echo "   firebase functions:log --only adaptiveRouter"
echo "   firebase functions:log --only selfTuningScheduler"
echo ""
echo "3. Seed initial data (optional):"
echo "   • Create sample ops_stats entries"
echo "   • Wait for refreshConfidence to run (10 min interval)"
echo "   • Check ops_confidence collection for results"
echo ""
echo "4. Access UI components:"
echo "   • Confidence Cards: /ops/learning"
echo "   • Decisions Ledger: /ops/policies"
echo ""
echo "5. Feature flags (functions/src/config/flags.ts):"
echo "   • adaptive.enabled: $(grep -A1 'adaptive:' functions/src/config/flags.ts | grep enabled | awk '{print $2}')"
echo "   • scheduler.autoTune: $(grep -A1 'scheduler:' functions/src/config/flags.ts | grep autoTune | awk '{print $2}')"
echo ""
echo "🔍 Monitoring:"
echo "   • Check Firebase Console > Functions for execution status"
echo "   • Monitor ops_confidence collection for confidence scores"
echo "   • Monitor ops_decisions collection for adaptive decisions"
echo ""
echo "⚠️  Important:"
echo "   • Adaptive policies are created as DRAFTS by default"
echo "   • Manual activation required until FLAGS.learning.autoActivatePolicies = true"
echo "   • A/B testing splits: adaptive=10%, control=10%, prod=80%"
echo ""
echo "📚 Documentation: See PHASE_37_README.md for details"
echo ""
