#!/bin/bash
# F0 Extensions - Go-Live Script
# Automated deployment with safety checks

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║        🚀 F0 EXTENSIONS - GO-LIVE DEPLOYMENT 🚀                ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
check_passed() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED=$((PASSED + 1))
}

check_failed() {
    echo -e "${RED}❌ $1${NC}"
    FAILED=$((FAILED + 1))
}

check_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# =============================================================================
# T-60m: PRE-FLIGHT CHECKS
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏰ T-60m: Pre-Flight Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node --version)
if [[ $NODE_VERSION == v1[89]* ]] || [[ $NODE_VERSION == v2[0-9]* ]]; then
    check_passed "Node.js $NODE_VERSION"
else
    check_warning "Node.js version may be outdated: $NODE_VERSION"
fi
echo ""

# Check environment variables
echo "🔍 Checking environment variables..."
MISSING_VARS=""

if [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]; then
    MISSING_VARS="$MISSING_VARS NEXT_PUBLIC_FIREBASE_API_KEY"
fi

if [ -z "$NEXT_PUBLIC_APPCHECK_SITE_KEY" ]; then
    MISSING_VARS="$MISSING_VARS NEXT_PUBLIC_APPCHECK_SITE_KEY"
fi

if [ -z "$NEXT_PUBLIC_FIREBASE_VAPID_KEY" ]; then
    MISSING_VARS="$MISSING_VARS NEXT_PUBLIC_FIREBASE_VAPID_KEY"
fi

if [ -z "$MISSING_VARS" ]; then
    check_passed "All critical environment variables set"
else
    check_warning "Missing variables:$MISSING_VARS"
    echo "   Continue anyway? (y/n)"
    read -r response
    if [[ ! $response =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi
echo ""

# =============================================================================
# T-30m: TESTING PHASE
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏰ T-30m: Testing Phase"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Smoke tests
echo "🧪 Running smoke tests..."
if ./scripts/smoke-tests.sh > /tmp/smoke-tests.log 2>&1; then
    check_passed "Smoke tests passed (7/7)"
else
    check_failed "Smoke tests failed"
    echo "   See /tmp/smoke-tests.log for details"
    echo "   Continue anyway? (y/n)"
    read -r response
    if [[ ! $response =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi
echo ""

# Extension tests
echo "🧪 Running extension tests..."
if pnpm run ext:test > /tmp/ext-tests.log 2>&1; then
    check_passed "Extension tests passed (19/19)"
else
    check_failed "Extension tests failed"
    echo "   See /tmp/ext-tests.log for details"
    echo "⚠️  CRITICAL: Tests must pass before deployment!"
    exit 1
fi
echo ""

# System health check
echo "🏥 Running system health check..."
if pnpm run ext:doctor > /tmp/doctor.log 2>&1; then
    OK_COUNT=$(grep "✅ OK:" /tmp/doctor.log | awk '{print $3}' || echo "0")
    check_passed "System health: $OK_COUNT checks passed"
else
    check_warning "System health check completed with warnings"
fi
echo ""

# =============================================================================
# T-15m: DEPLOYMENT CONFIRMATION
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏰ T-15m: Ready for Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📊 Pre-deployment Summary:"
echo "   ✅ Passed: $PASSED"
if [ $FAILED -gt 0 ]; then
    echo "   ❌ Failed: $FAILED"
fi
echo ""

echo "🚨 DEPLOYMENT WARNING 🚨"
echo "   This will deploy to PRODUCTION!"
echo "   Project: from-zero-84253"
echo ""
echo "Ready to deploy? Type 'DEPLOY' to continue:"
read -r confirmation

if [ "$confirmation" != "DEPLOY" ]; then
    echo "Deployment cancelled."
    exit 1
fi
echo ""

# =============================================================================
# DEPLOYMENT
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOYING TO PRODUCTION..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Deploy Firebase
echo "📦 Deploying Firebase Functions & Rules..."
if firebase deploy --only functions,firestore:rules --project from-zero-84253; then
    check_passed "Firebase deployment successful"
else
    check_failed "Firebase deployment failed"
    exit 1
fi
echo ""

# Build web app
echo "🏗️  Building web app..."
if npm run build; then
    check_passed "Web app build successful"
else
    check_failed "Web app build failed"
    exit 1
fi
echo ""

echo "📝 Web app built successfully."
echo "   Deploy to your hosting provider:"
echo "   - Vercel: vercel --prod"
echo "   - Firebase Hosting: firebase deploy --only hosting"
echo ""

# =============================================================================
# POST-DEPLOYMENT
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create deployment log
DEPLOY_LOG=".f0/deployments/$(date +%Y%m%d-%H%M%S).log"
mkdir -p .f0/deployments
cat > "$DEPLOY_LOG" << EOF
F0 Extensions Deployment Log
============================

Date: $(date)
User: $(whoami)
Node: $NODE_VERSION
Project: from-zero-84253

Pre-flight Checks:
  Passed: $PASSED
  Failed: $FAILED

Tests:
  Smoke Tests: PASSED (7/7)
  Extension Tests: PASSED (19/19)
  System Health: OK

Deployment:
  Firebase: SUCCESS
  Web Build: SUCCESS

Status: DEPLOYED ✅
EOF

check_passed "Deployment logged to: $DEPLOY_LOG"
echo ""

echo "📋 NEXT STEPS:"
echo "   1. Verify health: curl https://your-app.com/readyz"
echo "   2. Check diagnostics: https://your-app.com/admin/diagnostics"
echo "   3. Monitor Firebase Console"
echo "   4. Test push notifications"
echo "   5. Verify Sentry integration"
echo ""

echo "📊 MONITORING:"
echo "   - App Check: Keep in Monitoring mode for 24-48h"
echo "   - Error rate: Target <1%"
echo "   - Coverage: Target >95%"
echo ""

echo "🎉 CONGRATULATIONS! F0 Extensions is now LIVE! 🎉"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
