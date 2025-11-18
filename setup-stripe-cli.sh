#!/bin/bash
# Stripe CLI Setup Script
# Run this AFTER Xcode Command Line Tools installation completes

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Checking Xcode Command Line Tools..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! xcode-select -p &> /dev/null; then
    echo "❌ Xcode Command Line Tools not installed yet."
    echo "   Wait for installation to complete, then run this script again."
    exit 1
fi

echo "✅ Command Line Tools installed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Installing Stripe CLI..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

brew install stripe/stripe-cli/stripe

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Login to Stripe (browser will open)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: Select TEST MODE in the browser!"
echo ""

stripe login

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💰 Creating Price ($29/month)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PRICE_OUTPUT=$(stripe prices create \
  --unit-amount 2900 \
  --currency usd \
  --recurring interval=month \
  --product prod_TDTNgO97R3MMU9)

echo "$PRICE_OUTPUT"
echo ""

# Extract Price ID
PRICE_ID=$(echo "$PRICE_OUTPUT" | grep -o 'price_[a-zA-Z0-9_]*' | head -n1)

if [ -z "$PRICE_ID" ]; then
    echo "❌ Could not extract Price ID. Please copy it manually from above."
    exit 1
fi

echo "✅ Price created: $PRICE_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Retrieving API Keys..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

STRIPE_PK=$(stripe config --list | grep publishable_key | awk '{print $2}')
STRIPE_SK=$(stripe config --list | grep secret_key | awk '{print $2}')

if [ -z "$STRIPE_PK" ] || [ -z "$STRIPE_SK" ]; then
    echo "❌ Could not retrieve API keys automatically."
    echo "   Get them from: https://dashboard.stripe.com/test/apikeys"
    exit 1
fi

echo "✅ Found keys"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Updating .env.local..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$(dirname "$0")"

# Update keys
sed -i.bak "s|STRIPE_PUBLIC_KEY=pk_test_.*|STRIPE_PUBLIC_KEY=$STRIPE_PK|g" .env.local
sed -i.bak "s|STRIPE_SECRET_KEY=sk_test_.*|STRIPE_SECRET_KEY=$STRIPE_SK|g" .env.local
sed -i.bak "s|STRIPE_PRICE_MONTHLY=price_.*|STRIPE_PRICE_MONTHLY=$PRICE_ID|g" .env.local

rm -f .env.local.bak

echo "✅ Updated STRIPE_PUBLIC_KEY"
echo "✅ Updated STRIPE_SECRET_KEY"
echo "✅ Updated STRIPE_PRICE_MONTHLY"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Stripe Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo "   Price ID: $PRICE_ID"
echo "   Publishable Key: ${STRIPE_PK:0:25}..."
echo "   Secret Key: ${STRIPE_SK:0:20}..."
echo ""
echo "📝 Next: Add Firebase Web config to .env.local"
echo "   See: SETUP_CHECKLIST.md"
echo ""
echo "🚀 Then start dev: pnpm dev"
echo ""

