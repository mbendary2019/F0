#!/bin/bash
# Test Stripe Webhook Locally

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Stripe Webhook Test Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not installed"
    echo ""
    echo "Install with:"
    echo "  brew install stripe/stripe-cli/stripe"
    echo ""
    exit 1
fi

echo "✅ Stripe CLI found"
echo ""

# Check if Next.js is running
if ! lsof -ti:3000 > /dev/null; then
    echo "⚠️  Next.js not running on port 3000"
    echo "   Start with: pnpm dev"
    echo ""
    exit 1
fi

echo "✅ Next.js running on port 3000"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Starting Stripe webhook listener..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  1. Forward Stripe events to localhost:3000/api/webhooks/stripe"
echo "  2. Show webhook secret (copy to .env.local)"
echo "  3. Log all events in real-time"
echo ""
echo "Press Ctrl+C to stop"
echo ""

stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

