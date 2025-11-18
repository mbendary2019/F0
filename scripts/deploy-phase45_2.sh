#!/usr/bin/env bash
#
# Phase 45.2 Deployment Script
# Deploys reconciliation, paid marketplace, and updated Firestore rules
#

set -euo pipefail

echo "🚀 Phase 45.2 Deployment Starting..."
echo ""

# Check we're in the right directory
if [[ ! -f "firebase.json" ]]; then
  echo "❌ Error: firebase.json not found. Run from project root."
  exit 1
fi

# Build functions
echo "📦 Building functions..."
pushd functions >/dev/null
npm run build
popd >/dev/null
echo "✅ Functions built successfully"
echo ""

# Deploy Phase 45.2 functions
echo "🎯 Deploying Phase 45.2 functions..."
firebase deploy --only \
  functions:reconcileSubscriptions,functions:checkMarketplaceAccess,functions:installPaidItem,firestore:rules

echo ""
echo "✅ Phase 45.2 Deployed Successfully!"
echo ""
echo "📋 Deployed Functions:"
echo "  - reconcileSubscriptions (nightly at 03:00 Asia/Kuwait)"
echo "  - checkMarketplaceAccess (callable)"
echo "  - installPaidItem (callable)"
echo ""
echo "📋 Updated:"
echo "  - Firestore security rules (ops_installs, ops_user_plans)"
echo ""
echo "🧪 Next Steps:"
echo "  1. Test marketplace access check:"
echo "     firebase functions:log --only checkMarketplaceAccess"
echo ""
echo "  2. Test paid item installation:"
echo "     firebase functions:log --only installPaidItem"
echo ""
echo "  3. Monitor reconciliation (runs at 03:00):"
echo "     firebase functions:log --only reconcileSubscriptions"
echo ""
echo "✨ Phase 45.2 deployment complete!"
