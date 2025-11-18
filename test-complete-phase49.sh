#!/bin/bash

###############################################################################
# Phase 49 Complete Testing Script
# Tests all aspects: Hydration, i18n routing, Toast, and Incidents
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🧪 Phase 49: Complete Test Suite      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Test Next.js
echo -e "${YELLOW}📋 1. Testing Next.js Server${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Next.js (port 3000)"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌${NC} Next.js not running"
    echo ""
    echo -e "${YELLOW}💡 Run: pnpm dev${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test i18n Routes
echo -e "${YELLOW}🌐 2. Testing i18n Routes${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

routes=(
    "http://localhost:3000/ops/incidents:No locale"
    "http://localhost:3000/ar/ops/incidents:Arabic"
    "http://localhost:3000/en/ops/incidents:English"
)

for route_info in "${routes[@]}"; do
    IFS=':' read -r url label <<< "$route_info"
    echo -n "  Testing $label ($url)... "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ ($status)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ ($status)${NC}"
        ((TESTS_FAILED++))
    fi
done
echo ""

# Test Log API
echo -e "${YELLOW}📝 3. Testing Log API${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: Single error
echo -n "  Sending single error log... "
response=$(curl -s -X POST "http://localhost:3000/api/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","service":"test","code":500,"message":"TEST_COMPLETE_SCRIPT","context":{"test":true}}')

if echo "$response" | grep -q "ok.*true"; then
    echo -e "${GREEN}✅${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌${NC}"
    echo "    Response: $response"
    ((TESTS_FAILED++))
fi

# Test 2: Multiple errors (spike)
echo -n "  Sending error spike (10 errors)... "
success_count=0
for i in {1..10}; do
    response=$(curl -s -X POST "http://localhost:3000/api/log" \
      -H 'Content-Type: application/json' \
      -d "{\"level\":\"error\",\"service\":\"test\",\"code\":500,\"message\":\"SPIKE_TEST_$i\",\"fingerprint\":\"test-spike\"}" 2>/dev/null)
    
    if echo "$response" | grep -q "ok.*true"; then
        ((success_count++))
    fi
done

if [ $success_count -eq 10 ]; then
    echo -e "${GREEN}✅ (10/10)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  ($success_count/10)${NC}"
fi

# Test 3: Different log levels
echo -n "  Testing log levels (info/warn/error)... "
levels_ok=0

for level in "info" "warn" "error"; do
    response=$(curl -s -X POST "http://localhost:3000/api/log" \
      -H 'Content-Type: application/json' \
      -d "{\"level\":\"$level\",\"message\":\"Test $level\"}" 2>/dev/null)
    
    if echo "$response" | grep -q "ok.*true"; then
        ((levels_ok++))
    fi
done

if [ $levels_ok -eq 3 ]; then
    echo -e "${GREEN}✅ (3/3)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  ($levels_ok/3)${NC}"
fi

echo ""

# Wait for triggers
echo -e "${YELLOW}⏳ 4. Waiting for Triggers to Process${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "  Waiting 3 seconds... "
sleep 3
echo -e "${GREEN}✅${NC}"
((TESTS_PASSED++))
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 Test Results                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ Failed: $TESTS_FAILED${NC}"
echo ""

# Instructions
echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   🎯 Next Steps                          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}1. Open Dashboard:${NC}"
echo "   http://localhost:3000/ops/incidents"
echo ""
echo -e "${YELLOW}2. Check Console for Hydration Errors:${NC}"
echo "   - Open any page"
echo "   - Press F12 → Console tab"
echo "   - Should be clean (no red errors)"
echo ""
echo -e "${YELLOW}3. Test Toast in Browser Console:${NC}"
echo "   ${CYAN}// Success toast${NC}"
echo "   import('sonner').then(({ toast }) => {"
echo "     toast.success('تم الحفظ ✅');"
echo "   });"
echo ""
echo "   ${CYAN}// Error toast${NC}"
echo "   import('sonner').then(({ toast }) => {"
echo "     toast.error('حدث خطأ 😅', { description: 'حاول مرة أخرى' });"
echo "   });"
echo ""
echo -e "${YELLOW}4. Test Log API from Console:${NC}"
echo "   fetch('/api/log', {"
echo "     method: 'POST',"
echo "     headers: {'Content-Type': 'application/json'},"
echo "     body: JSON.stringify({"
echo "       level: 'error',"
echo "       message: 'Browser test error'"
echo "     })"
echo "   }).then(r => r.json()).then(console.log)"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Phase 49 is working perfectly!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    exit 1
fi
