#!/bin/bash
set -e

echo "=================================================="
echo "F0 Phase 41 - Cognitive Federation"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

echo "📋 Phase 41 will deploy:"
echo "  • Firestore Rules (4 federation collections)"
echo "  • 4 Cloud Functions:"
echo "    - fedInbox (HTTPS)"
echo "    - fedPublish (Schedule: every 30 min)"
echo "    - fedConsume (Schedule: every 15 min)"
echo "    - fedRiskSweep (Schedule: every 60 min)"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

echo ""
echo "📦 Step 1: Installing node-fetch dependency..."
cd functions
npm install node-fetch @types/node-fetch

echo ""
echo "🔐 Step 2: Deploying Firestore Rules..."
cd ..
firebase deploy --only firestore:rules

echo ""
echo "🏗️  Step 3: Building Functions..."
cd functions
npm run build
cd ..

echo ""
echo "☁️  Step 4: Deploying Phase 41 Functions..."
firebase deploy --only functions:fedInbox,functions:fedPublish,functions:fedConsume,functions:fedRiskSweep

echo ""
echo "=================================================="
echo "✅ Phase 41 Deployment Complete!"
echo "=================================================="
echo ""
echo "🌐 Federation System is Now Active!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Configure environment variables:"
echo "   F0_INSTANCE_ID=fz-main"
echo "   FED_PRIVATE_KEY=<your-ed25519-private-key>"
echo ""
echo "2. Register a federation peer:"
echo "   curl -X POST YOUR_DOMAIN/api/fed/peers \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"id\":\"fz-kuwait\",\"url\":\"https://fz-kuwait.example.com\",\"pubKey\":\"<PEER_PUBKEY>\",\"role\":\"both\",\"scopes\":[\"stats\",\"risk\",\"policies\"],\"allow\":true}'"
echo ""
echo "3. Test telemetry publish (via Firebase Shell):"
echo "   firebase functions:shell"
echo "   > fedPublish()"
echo ""
echo "4. View federation dashboard:"
echo "   YOUR_DOMAIN/ops/federation"
echo ""
echo "5. Monitor APIs:"
echo "   GET /api/fed/peers"
echo "   GET /api/fed/risk/global"
echo ""
