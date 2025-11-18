#!/bin/bash

# Phase 45 - Monetization & Premium Upgrades Deployment Script

set -e

echo "🚀 Deploying Phase 45: Monetization & Premium Upgrades"
echo "========================================================"

# Check environment variables
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "⚠️  Warning: STRIPE_SECRET_KEY not set"
  echo "   Set it with: export STRIPE_SECRET_KEY='sk_test_...'"
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "⚠️  Warning: STRIPE_WEBHOOK_SECRET not set"
  echo "   Set it with: export STRIPE_WEBHOOK_SECRET='whsec_...'"
fi

# Step 1: Configure Firebase Functions with Stripe keys
echo ""
echo "📝 Step 1: Configuring Firebase Functions..."
firebase functions:config:set \
  stripe.secret="$STRIPE_SECRET_KEY" \
  stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET" \
  app.url="${NEXT_PUBLIC_APP_URL:-https://your-app.com}"

echo "✅ Firebase Functions config updated"

# Step 2: Build Cloud Functions
echo ""
echo "🔨 Step 2: Building Cloud Functions..."
cd functions
npm install
npm run build
cd ..

echo "✅ Cloud Functions built successfully"

# Step 3: Deploy Firestore rules
echo ""
echo "📜 Step 3: Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo "✅ Firestore rules deployed"

# Step 4: Deploy Cloud Functions
echo ""
echo "☁️  Step 4: Deploying Cloud Functions..."
firebase deploy --only functions:createCheckoutSession,functions:createPortalSession,functions:stripeWebhookV2,functions:reconcileSubscriptions,functions:installPaidItem,functions:checkMarketplaceAccess

echo "✅ Cloud Functions deployed"

# Step 5: Deploy Firestore indexes
echo ""
echo "🔍 Step 5: Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo "✅ Firestore indexes deployed"

# Done
echo ""
echo "✅ Phase 45 deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run seed script: ./scripts/seed-phase45-data.sh"
echo "2. Configure Stripe webhook endpoint in Stripe Dashboard:"
echo "   URL: https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhookV2"
echo "   Events: checkout.session.completed, customer.subscription.*, invoice.*"
echo "3. Test checkout flow at /pricing"
echo ""
