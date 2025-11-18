#!/bin/bash
# ============================================
# Firebase Functions Config Setup Script
# Sprint 13 - AI Governance Configuration
# ============================================

set -e

echo "🔧 Firebase Functions Config Setup"
echo "===================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating from template..."
    cp .env.local.template .env.local
    echo "✅ Created .env.local - please update with your values"
    echo ""
fi

# Source .env.local to get REPORT_HMAC_SECRET
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Prompt for HMAC secret if not set
if [ -z "$REPORT_HMAC_SECRET" ] || [ "$REPORT_HMAC_SECRET" = "change_me_to_random_32_char_secret" ]; then
    echo "⚠️  REPORT_HMAC_SECRET not configured"
    echo "🔐 Generating random HMAC secret..."
    HMAC_SECRET=$(openssl rand -base64 32)
    echo "   Generated: $HMAC_SECRET"
    echo ""
else
    HMAC_SECRET="$REPORT_HMAC_SECRET"
    echo "✅ Using REPORT_HMAC_SECRET from .env.local"
    echo ""
fi

# Configure Firebase Functions
echo "📝 Setting Firebase Functions config..."
echo ""

firebase functions:config:set \
  reports.hmac_secret="$HMAC_SECRET" \
  --project "$NEXT_PUBLIC_FIREBASE_PROJECT_ID" || {
    echo ""
    echo "⚠️  If project ID is not set, run:"
    echo "   firebase use --add"
    echo "   Then run this script again"
    exit 1
  }

echo ""
echo "✅ Firebase Functions config set successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify config: firebase functions:config:get"
echo "   2. Deploy functions: firebase deploy --only functions"
echo "   3. Update .env.local with:"
echo "      REPORT_HMAC_SECRET=$HMAC_SECRET"
echo ""
