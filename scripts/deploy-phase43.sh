#!/bin/bash
set -e

echo "🚀 Deploy Phase 43: Global Cognitive Mesh"
echo ""

# Step 1: Deploy Firestore rules and indexes
echo "📋 Step 1/4: Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules,firestore:indexes

# Step 2: Install dependencies
echo ""
echo "📦 Step 2/4: Installing dependencies..."
cd functions
# Skip wrtc for MVP (not compatible with Cloud Functions environment)
# Production will use Cloud Run workers with wrtc
npm install libsodium-wrappers node-fetch @types/node

# Step 3: Build functions
echo ""
echo "🔨 Step 3/4: Building functions..."
npm run build

# Step 4: Deploy Phase 43 functions
echo ""
echo "🚀 Step 4/4: Deploying Phase 43 functions..."
firebase deploy --only functions:meshBeacon,functions:meshGossip,functions:meshReduce,functions:trustFlow,functions:apiMesh

echo ""
echo "✅ Phase 43 deployment complete!"
echo ""
echo "Deployed functions:"
echo "  - meshBeacon (HTTPS)"
echo "  - meshGossip (HTTPS)"
echo "  - meshReduce (Schedule: every 5 minutes)"
echo "  - trustFlow (Schedule: every 30 minutes)"
echo "  - apiMesh (HTTPS)"
echo ""
echo "🎯 Next steps:"
echo "  1. Register mesh peers via meshBeacon endpoint"
echo "  2. Create mesh links manually in mesh_links collection"
echo "  3. Send gossip messages via meshGossip endpoint"
echo "  4. Monitor /ops/mesh dashboard for peer count, links, and trust scores"
echo "  5. Check mesh_snapshots/latest for reduced state"
