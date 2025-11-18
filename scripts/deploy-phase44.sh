#!/usr/bin/env bash
#
# Phase 44 Deployment Script
# Deploys: Quota system, Figma integration, Marketplace
#

set -euo pipefail

echo "========================================"
echo "  Phase 44: Add-Ons Pack Deployment"
echo "========================================"
echo ""

# Check required environment variables
if [[ -z "${FIGMA_TOKEN:-}" ]]; then
  echo "⚠️  Warning: FIGMA_TOKEN not set"
  echo "   Figma integration will be disabled"
  echo "   To enable: export FIGMA_TOKEN=your_token"
  echo ""
fi

# Set Firebase Functions config for runtime
echo "📝 Configuring Firebase Functions runtime config..."
firebase functions:config:set \
  figma.token="${FIGMA_TOKEN:-}" \
  figma.file_ids="${FIGMA_FILE_IDS:-}" \
  || echo "⚠️  Firebase config update failed (continuing anyway)"

echo ""
echo "🔨 Building functions..."
cd functions
export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh"
nvm use 20 2>/dev/null || echo "Using system Node"
npm run build || { echo "❌ Build failed"; exit 1; }
cd ..

echo ""
echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions:resetDailyQuotas,functions:figmaScheduledPull,functions:figmaPullOnDemand,functions:requestInstall || {
  echo "❌ Functions deployment failed"
  exit 1
}

echo ""
echo "🔐 Deploying Firestore rules..."
firebase deploy --only firestore:rules || {
  echo "❌ Firestore rules deployment failed"
  exit 1
}

echo ""
echo "✅ Phase 44 Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Seed marketplace items:"
echo "      firebase firestore:write ops_marketplace_items/sample-branding-pack '{\"title\":\"Branding Quick Start\",\"category\":\"branding\",\"brief\":\"Preset colors, routes, and a mascot\",\"installScript\":\"applyBrandingPreset:v1\",\"verified\":true}'"
echo ""
echo "   2. Set initial branding:"
echo "      firebase firestore:write ops_branding/prod '{\"primaryColor\":\"#7C3AED\",\"accentColor\":\"#22D3EE\",\"logoUrl\":\"/logo.svg\"}'"
echo ""
echo "   3. Test pages:"
echo "      - /ops/branding (admin only)"
echo "      - /ops/marketplace"
echo "      - /ops/assets"
echo ""
echo "   4. Monitor quota resets:"
echo "      firebase functions:log --only resetDailyQuotas"
echo ""
