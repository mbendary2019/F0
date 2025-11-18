#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploy Phase 43.1: WebRTC Workers + Weighted Gossip"
echo ""

# Get project root
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

# Check required env vars
if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
  echo "❌ Error: GOOGLE_CLOUD_PROJECT not set"
  echo "   Set it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
  exit 1
fi

if [ -z "${CLOUD_RUN_REGION:-}" ]; then
  echo "⚠️  Warning: CLOUD_RUN_REGION not set, using us-central1"
  CLOUD_RUN_REGION="us-central1"
fi

if [ -z "${F0_INSTANCE_ID:-}" ]; then
  echo "⚠️  Warning: F0_INSTANCE_ID not set, using fz-local"
  F0_INSTANCE_ID="fz-local"
fi

echo "📋 Configuration:"
echo "   Project: $GOOGLE_CLOUD_PROJECT"
echo "   Region: $CLOUD_RUN_REGION"
echo "   Instance: $F0_INSTANCE_ID"
echo ""

# Step 1: Build & deploy Cloud Run WebRTC worker
echo "📦 Step 1/3: Building Cloud Run WebRTC worker..."
pushd cloudrun/webrtc-worker > /dev/null

# Install dependencies and build
echo "   Installing dependencies..."
npm install --silent

echo "   Building TypeScript..."
npm run build

# Build container
BUILD_TAG="gcr.io/$GOOGLE_CLOUD_PROJECT/webrtc-worker:$(date +%s)"
echo "   Building container: $BUILD_TAG"

gcloud builds submit --tag "$BUILD_TAG" --quiet

# Deploy to Cloud Run
echo "   Deploying to Cloud Run..."
gcloud run deploy webrtc-worker \
  --image "$BUILD_TAG" \
  --platform managed \
  --region "$CLOUD_RUN_REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "F0_INSTANCE_ID=$F0_INSTANCE_ID,ICE_SERVERS=[{\"urls\":[\"stun:stun.l.google.com:19302\"]}]" \
  --quiet

WORKER_URL=$(gcloud run services describe webrtc-worker --region "$CLOUD_RUN_REGION" --format 'value(status.url)')
echo "   ✅ Worker deployed: $WORKER_URL"

popd > /dev/null
echo ""

# Step 2: Update Firestore with worker endpoint
echo "📝 Step 2/3: Updating peer endpoint in Firestore..."
echo "   Run this command to update your peer:"
echo ""
echo "   firebase firestore:update mesh_peers/$F0_INSTANCE_ID --data '{\"endpoints\":{\"webrtc\":\"$WORKER_URL\"}}'"
echo ""
echo "   Or via curl:"
echo "   curl -X POST https://meshbeacon-vpxyxgcfbq-uc.a.run.app \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"id\":\"$F0_INSTANCE_ID\",\"pubKey\":\"ed25519_key\",\"region\":\"US\",\"endpoints\":{\"webrtc\":\"$WORKER_URL\"}}'"
echo ""

# Step 3: Deploy Cloud Functions (gossipPush, apiMeshRtc)
echo "🔨 Step 3/3: Deploying Cloud Functions..."
pushd functions > /dev/null

echo "   Installing dependencies..."
npm install --silent

echo "   Building functions..."
npm run build

echo "   Deploying functions..."
firebase deploy --only functions:gossipPush,functions:apiMeshRtc --force

popd > /dev/null
echo ""

echo "✅ Phase 43.1 deployment complete!"
echo ""
echo "📋 Deployed components:"
echo "   • WebRTC Worker: $WORKER_URL"
echo "   • gossipPush (Schedule: every 2 min)"
echo "   • apiMeshRtc (HTTPS)"
echo ""
echo "🧪 Next steps:"
echo "   1. Update peer endpoint (see command above)"
echo "   2. Open /ops/mesh dashboard"
echo "   3. Select a peer and click 'Connect'"
echo "   4. Check 'Active Links' table for QoS metrics"
echo ""
echo "📖 Documentation: PHASE_43_1_DEPLOYMENT_COMPLETE.md"
