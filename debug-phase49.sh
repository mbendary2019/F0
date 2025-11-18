#!/bin/bash

echo "🔧 Phase 49 Debugging Script"
echo "============================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Firebase Emulators
echo "1️⃣ Checking Firebase Emulators..."
if lsof -ti:8080 >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Firestore Emulator: Running on port 8080${NC}"
else
  echo -e "${RED}❌ Firestore Emulator: NOT RUNNING${NC}"
  echo "   Start with: firebase emulators:start"
fi

if lsof -ti:5001 >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Functions Emulator: Running on port 5001${NC}"
else
  echo -e "${RED}❌ Functions Emulator: NOT RUNNING${NC}"
  echo "   Start with: firebase emulators:start"
fi

if lsof -ti:9099 >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Auth Emulator: Running on port 9099${NC}"
else
  echo -e "${RED}❌ Auth Emulator: NOT RUNNING${NC}"
fi

echo ""

# Check 2: Next.js
echo "2️⃣ Checking Next.js..."
if lsof -ti:3000 >/dev/null 2>&1; then
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "307" ]; then
    echo -e "${GREEN}✅ Next.js: Running on port 3000${NC}"
  else
    echo -e "${YELLOW}⚠️  Next.js: Running but returned $RESPONSE${NC}"
  fi
else
  echo -e "${RED}❌ Next.js: NOT RUNNING${NC}"
  echo "   Start with: npm run dev"
fi

echo ""

# Check 3: Functions Build
echo "3️⃣ Checking Functions Build..."
if [ -f "functions/lib/index.js" ]; then
  echo -e "${GREEN}✅ functions/lib/index.js exists${NC}"

  if grep -q "exports.log" functions/lib/index.js; then
    echo -e "${GREEN}✅ log function exported${NC}"
  else
    echo -e "${RED}❌ log function NOT exported${NC}"
    echo "   Run: cd functions && npm run build"
  fi

  if grep -q "exports.onEventWrite" functions/lib/index.js; then
    echo -e "${GREEN}✅ onEventWrite trigger exported${NC}"
  else
    echo -e "${RED}❌ onEventWrite trigger NOT exported${NC}"
    echo "   Run: cd functions && npm run build"
  fi
else
  echo -e "${RED}❌ Functions not built${NC}"
  echo "   Run: cd functions && npm run build"
fi

echo ""

# Check 4: Test Log Endpoint
echo "4️⃣ Testing Log Endpoint..."
LOG_RESPONSE=$(curl -s -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"info","service":"debug-script","message":"Test from debug script","fingerprint":"debug-test"}' 2>/dev/null)

if echo "$LOG_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✅ Log endpoint: Working${NC}"
  echo "   Response: $LOG_RESPONSE"
else
  echo -e "${RED}❌ Log endpoint: Failed${NC}"
  echo "   Response: $LOG_RESPONSE"
fi

echo ""

# Check 5: Environment Variables
echo "5️⃣ Checking Environment Variables..."
if [ -f ".env.local" ]; then
  if grep -q "NEXT_PUBLIC_CF_LOG_URL" .env.local; then
    LOG_URL=$(grep "NEXT_PUBLIC_CF_LOG_URL" .env.local | cut -d'=' -f2)
    echo -e "${GREEN}✅ NEXT_PUBLIC_CF_LOG_URL set${NC}"
    echo "   Value: $LOG_URL"
  else
    echo -e "${RED}❌ NEXT_PUBLIC_CF_LOG_URL not found${NC}"
    echo "   Add: NEXT_PUBLIC_CF_LOG_URL=http://127.0.0.1:5001/from-zero-84253/us-central1/log"
  fi
else
  echo -e "${RED}❌ .env.local not found${NC}"
fi

echo ""

# Check 6: Test Next.js Proxy
echo "6️⃣ Testing Next.js Proxy..."
PROXY_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"info","service":"debug-script","message":"Proxy test","fingerprint":"proxy-debug-test"}' 2>/dev/null)

if echo "$PROXY_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✅ Next.js proxy: Working${NC}"
  echo "   Response: $PROXY_RESPONSE"
else
  echo -e "${RED}❌ Next.js proxy: Failed${NC}"
  echo "   Response: $PROXY_RESPONSE"
fi

echo ""
echo "========================================"
echo "📊 Summary"
echo "========================================"
echo ""
echo "🔗 Useful Links:"
echo "   • Dashboard: http://localhost:3000/ar/ops/incidents"
echo "   • Firestore UI: http://localhost:4000/firestore"
echo "   • Auth Emulator: http://localhost:4000/auth"
echo "   • Test Page: http://localhost:3000/test-toast"
echo ""
echo "🎯 To send spike test:"
echo "   bash seed-incidents.sh"
echo ""
echo "📝 To set admin claims:"
echo "   1. Open http://localhost:4000/auth"
echo "   2. Edit user → Custom Claims"
echo "   3. Add: {\"admin\": true, \"role\": \"admin\", \"pro\": true}"
echo ""
echo "📚 Full Guide:"
echo "   PHASE_49_ADMIN_SETUP_QUICK.md"
echo ""
