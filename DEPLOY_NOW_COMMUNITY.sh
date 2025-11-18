#!/bin/bash

# Quick Deploy Script for Community Features
# استخدام: ./DEPLOY_NOW_COMMUNITY.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🚀 Community Features - Quick Deploy${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 1: Pre-flight checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[1/6]${NC} Pre-flight checks..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
  echo -e "${YELLOW}⚠${NC} .env.production not found. Creating from example..."
  cp .env.local.community-example .env.production
  echo -e "${RED}⚠ IMPORTANT: Edit .env.production with your production values!${NC}"
  echo ""
  read -p "Press Enter to continue after editing .env.production..."
fi

echo -e "${GREEN}✓${NC} .env.production exists"

# Check if firebase is installed
if ! command -v firebase &> /dev/null; then
  echo -e "${RED}✗${NC} Firebase CLI not found. Installing..."
  npm install -g firebase-tools
fi

echo -e "${GREEN}✓${NC} Firebase CLI installed"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 2: Run local smoke tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[2/6]${NC} Running smoke tests..."

if [ ! -f "./scripts/smoke-test-community.sh" ]; then
  echo -e "${RED}✗${NC} Smoke test script not found"
  exit 1
fi

# Make sure server is running
if ! curl -s http://localhost:3030 > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠${NC} Dev server not running on port 3030"
  echo -e "  ${BLUE}→${NC} Start with: PORT=3030 pnpm dev"
  exit 1
fi

./scripts/smoke-test-community.sh || {
  echo -e "${RED}✗ Smoke tests failed. Fix issues before deploying.${NC}"
  exit 1
}

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 3: Deploy Firestore Rules
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[3/6]${NC} Deploying Firestore rules..."

firebase deploy --only firestore:rules || {
  echo -e "${RED}✗ Firestore rules deployment failed${NC}"
  exit 1
}

echo -e "${GREEN}✓${NC} Firestore rules deployed"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 4: Build the project
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[4/6]${NC} Building project..."

pnpm build || {
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
}

echo -e "${GREEN}✓${NC} Build successful"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 5: Deploy to production
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[5/6]${NC} Deploying to production..."

# Ask for deployment target
echo ""
echo "Select deployment target:"
echo "  1) Vercel"
echo "  2) Firebase Hosting"
echo "  3) Skip deployment (manual)"
echo ""
read -p "Enter choice [1-3]: " DEPLOY_CHOICE

case $DEPLOY_CHOICE in
  1)
    echo -e "${BLUE}→${NC} Deploying to Vercel..."

    # Check if vercel is installed
    if ! command -v vercel &> /dev/null; then
      npm install -g vercel
    fi

    vercel --prod || {
      echo -e "${RED}✗ Vercel deployment failed${NC}"
      exit 1
    }

    echo -e "${GREEN}✓${NC} Deployed to Vercel"
    ;;

  2)
    echo -e "${BLUE}→${NC} Deploying to Firebase Hosting..."

    firebase deploy --only hosting || {
      echo -e "${RED}✗ Firebase Hosting deployment failed${NC}"
      exit 1
    }

    echo -e "${GREEN}✓${NC} Deployed to Firebase Hosting"
    ;;

  3)
    echo -e "${YELLOW}⚠${NC} Skipping deployment. Deploy manually."
    ;;

  *)
    echo -e "${RED}✗ Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 6: Post-deployment verification
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[6/6]${NC} Post-deployment verification..."

if [ "$DEPLOY_CHOICE" != "3" ]; then
  echo ""
  read -p "Enter your production URL (e.g., https://yourdomain.com): " PROD_URL

  if [ -n "$PROD_URL" ]; then
    echo -e "${BLUE}→${NC} Testing production deployment..."

    # Test AR page
    AR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/ar/community")
    if [ "$AR_STATUS" -eq 200 ]; then
      echo -e "${GREEN}✓${NC} AR page (HTTP $AR_STATUS)"
    else
      echo -e "${RED}✗${NC} AR page (HTTP $AR_STATUS)"
    fi

    # Test EN page
    EN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/en/community")
    if [ "$EN_STATUS" -eq 200 ]; then
      echo -e "${GREEN}✓${NC} EN page (HTTP $EN_STATUS)"
    else
      echo -e "${RED}✗${NC} EN page (HTTP $EN_STATUS)"
    fi

    # Test tracking API
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$PROD_URL/api/ops/analytics/track" \
      -H "Content-Type: application/json" \
      -d '{"name":"deploy_verification","data":{}}')

    if [ "$API_STATUS" -eq 200 ]; then
      echo -e "${GREEN}✓${NC} Tracking API (HTTP $API_STATUS)"
    else
      echo -e "${RED}✗${NC} Tracking API (HTTP $API_STATUS)"
    fi

    echo ""
    echo -e "${BLUE}→${NC} Run full smoke tests on production:"
    echo -e "  ${YELLOW}BASE_URL=\"$PROD_URL\" ./scripts/smoke-test-community.sh${NC}"
  fi
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Success
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Monitor logs for 30 minutes"
echo "  2. Check Firestore for PII leaks"
echo "  3. Verify rate limiting works"
echo "  4. Test banner visibility"
echo ""
echo "Documentation:"
echo "  - COMMUNITY_PRODUCTION_READY.md"
echo "  - COMMUNITY_DEPLOYMENT_GUIDE.md"
echo "  - RATE_LIMITING_GUIDE.md"
echo ""
echo -e "${GREEN}🚀 Happy deploying!${NC}"
echo ""
