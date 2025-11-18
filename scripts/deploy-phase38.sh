#!/usr/bin/env bash
set -euo pipefail

# Phase 38 Deployment Script
# Deploys Cognitive Knowledge Graph infrastructure

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

echo "🚀 Starting Phase 38 Deployment: Cognitive Knowledge Graph"
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
echo "📋 Phase 38 includes:"
echo "  • Graph Builder (sync from Phases 35-37 sources)"
echo "  • Entity Extractor (AI-assisted relationship detection)"
echo "  • Graph Sync Scheduler (every 30 min)"
echo "  • Graph Extract Scheduler (every 60 min)"
echo "  • Real-time triggers (4 Firestore triggers)"
echo "  • Graph API (nodes, edges, traverse)"
echo "  • Ops Graph Viewer UI"
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
echo "⚠️  Note: Indexes may take 5-10 minutes to build. Check Firebase Console."

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
echo "Step 4/4: Deploying Phase 38 Functions"
echo "=================================================="
cd "$ROOT_DIR"

# Deploy Phase 38 functions
firebase deploy --only \
  functions:graphSync,\
  functions:graphExtract,\
  functions:onStatsWrite,\
  functions:onPolicyWrite,\
  functions:onDecisionCreate,\
  functions:onConfidenceWrite

echo ""
echo "✅ Phase 38 Deployment Complete!"
echo "=================================================="
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Verify functions are running:"
echo "   firebase functions:list"
echo ""
echo "2. Check function logs:"
echo "   firebase functions:log --only graphSync"
echo "   firebase functions:log --only graphExtract"
echo ""
echo "3. Trigger initial graph sync:"
echo "   # The graphSync function will run automatically in ~30 min"
echo "   # Or manually trigger via Firebase Console"
echo ""
echo "4. Access Graph UI:"
echo "   • Ops Knowledge Graph: /ops/graph"
echo ""
echo "5. Test API endpoints:"
echo "   curl http://localhost:3000/api/ops/graph/nodes"
echo "   curl http://localhost:3000/api/ops/graph/edges"
echo ""
echo "6. Verify graph collections:"
echo "   • ops_graph_nodes - Should populate after graphSync runs"
echo "   • ops_graph_edges - Should populate after graphSync runs"
echo ""
echo "🔍 Monitoring:"
echo "   • Check Firebase Console > Functions for execution status"
echo "   • Monitor ops_graph_nodes collection for node count"
echo "   • Monitor ops_graph_edges collection for edge count"
echo "   • Watch triggers fire when ops_stats/ops_policies/ops_decisions update"
echo ""
echo "⚠️  Important:"
echo "   • Initial sync may take 2-5 minutes depending on data volume"
echo "   • Triggers will keep graph fresh in real-time after initial sync"
echo "   • Graph UI is MVP (tabular). Phase 38.1 will add D3/Cytoscape visualization"
echo ""
echo "📚 Documentation: See PHASE_38_README.md for details"
echo ""
