#!/bin/bash
# Production Validation Checklist
# Checks all services after deployment

set -e

echo "🔍 F0 Production Health Check"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# 1. Check Firebase Hosting
echo "1️⃣  Firebase Hosting"
echo "-------------------"
if [ -n "$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" ]; then
  HOSTING_URL="https://${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}"
  echo "URL: $HOSTING_URL"

  if curl -s -o /dev/null -w "%{http_code}" "$HOSTING_URL" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Hosting is live${NC}"
  else
    echo -e "${RED}❌ Hosting is not responding${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Auth domain not configured${NC}"
fi
echo ""

# 2. Check Cloud Functions
echo "2️⃣  Cloud Functions"
echo "-------------------"
READYZ_URL="https://readyz-vpxyxgcfbq-uc.a.run.app"
echo "Readiness endpoint: $READYZ_URL"

RESPONSE=$(curl -s "$READYZ_URL")
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✅ Functions are healthy${NC}"
  echo "Response: $RESPONSE"
else
  echo -e "${RED}❌ Functions health check failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# 3. Check Firestore Rules
echo "3️⃣  Firestore Security Rules"
echo "----------------------------"
if [ -f "firestore.rules" ]; then
  RULE_COUNT=$(wc -l < firestore.rules)
  echo "Rules file: firestore.rules ($RULE_COUNT lines)"

  if grep -q "allow read: if request.auth != null" firestore.rules; then
    echo -e "${GREEN}✅ Auth-protected read rules found${NC}"
  else
    echo -e "${YELLOW}⚠️  Check auth protection in rules${NC}"
  fi

  if grep -q "allow write: if request.auth != null" firestore.rules; then
    echo -e "${GREEN}✅ Auth-protected write rules found${NC}"
  else
    echo -e "${YELLOW}⚠️  Check auth protection in rules${NC}"
  fi
else
  echo -e "${RED}❌ No firestore.rules file found${NC}"
fi
echo ""

# 4. Check Environment Variables
echo "4️⃣  Environment Configuration"
echo "----------------------------"
REQUIRED_VARS=(
  "NEXT_PUBLIC_FIREBASE_API_KEY"
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  "FIREBASE_PROJECT_ID"
  "FIREBASE_CLIENT_EMAIL"
)

ALL_SET=true
for var in "${REQUIRED_VARS[@]}"; do
  if [ -n "${!var}" ]; then
    echo -e "${GREEN}✅ $var${NC}"
  else
    echo -e "${RED}❌ $var (not set)${NC}"
    ALL_SET=false
  fi
done
echo ""

# 5. Check Build Output
echo "5️⃣  Build Status"
echo "----------------"
if [ -d ".next" ]; then
  echo -e "${GREEN}✅ Next.js build exists${NC}"

  if [ -f ".next/BUILD_ID" ]; then
    BUILD_ID=$(cat .next/BUILD_ID)
    echo "Build ID: $BUILD_ID"
  fi
else
  echo -e "${RED}❌ No .next directory found${NC}"
  echo "Run: npm run build"
fi
echo ""

# 6. Check Firebase Project
echo "6️⃣  Firebase Project"
echo "--------------------"
if command -v firebase &> /dev/null; then
  CURRENT_PROJECT=$(firebase use 2>/dev/null || echo "not set")
  echo "Current project: $CURRENT_PROJECT"

  if [ "$CURRENT_PROJECT" != "not set" ]; then
    echo -e "${GREEN}✅ Firebase CLI configured${NC}"
  else
    echo -e "${YELLOW}⚠️  Run: firebase use <project-id>${NC}"
  fi
else
  echo -e "${RED}❌ Firebase CLI not installed${NC}"
  echo "Install: npm install -g firebase-tools"
fi
echo ""

# 7. Check for Critical Errors in Logs (if firebase CLI available)
echo "7️⃣  Recent Function Logs"
echo "-----------------------"
if command -v firebase &> /dev/null && [ "$CURRENT_PROJECT" != "not set" ]; then
  echo "Fetching last 10 log entries..."
  firebase functions:log --limit 10 2>/dev/null || echo "Unable to fetch logs (may need authentication)"
else
  echo -e "${YELLOW}⚠️  Skipped (Firebase CLI not configured)${NC}"
fi
echo ""

# Final Summary
echo "================================"
echo "📊 Health Check Summary"
echo "================================"

if [ "$ALL_SET" = true ]; then
  echo -e "${GREEN}✅ All environment variables configured${NC}"
else
  echo -e "${RED}❌ Some environment variables missing${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Check Firebase Console → Functions → Logs for errors"
echo "2. Monitor: firebase functions:log --follow"
echo "3. Test live deployment at your hosting URL"
echo "4. Review Firestore security rules"
echo ""
echo "🎉 Health check complete!"
