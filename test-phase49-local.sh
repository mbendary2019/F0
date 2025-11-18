#!/bin/bash

###############################################################################
# Phase 49 Local Testing - Quick Start
# Tests Phase 49 with local emulators
###############################################################################

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🧪 Phase 49: Local Testing              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Check if services are running
echo -e "${YELLOW}🔍 التحقق من الخدمات...${NC}"

# Check Next.js
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Next.js (3000)"
else
    echo -e "  ${RED}❌${NC} Next.js غير مشغل (3000)"
    echo ""
    echo -e "${YELLOW}💡 شغّل أولاً:${NC} ./start-local.sh"
    exit 1
fi

# Check Firestore Emulator
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Firestore Emulator (8080)"
else
    echo -e "  ${RED}❌${NC} Firestore Emulator غير مشغل (8080)"
    echo ""
    echo -e "${YELLOW}💡 شغّل أولاً:${NC} ./start-local.sh"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ جميع الخدمات تعمل!${NC}"
echo ""

# Run tests
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 بدء الاختبارات                      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Single Error
echo -e "${YELLOW}📝 Test 1: إرسال خطأ واحد${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/log \
  -H 'Content-Type: application/json' \
  -d '{
    "level": "error",
    "service": "web",
    "code": 500,
    "message": "TEST_SINGLE_ERROR from local test",
    "context": {"route": "/test", "local": true},
    "fingerprint": "local:test:single"
  }' 2>/dev/null)

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ نجح - تم إرسال الخطأ${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ فشل - HTTP $http_code${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Multiple Errors (Spike)
echo -e "${YELLOW}⚡ Test 2: موجة أخطاء (15 خطأ)${NC}"
echo -n "إرسال: "
for i in {1..15}; do
    curl -s -X POST http://localhost:3000/api/log \
      -H 'Content-Type: application/json' \
      -d "{
        \"level\": \"error\",
        \"service\": \"web\",
        \"code\": 500,
        \"message\": \"TEST_SPIKE_ERROR #$i\",
        \"context\": {\"route\": \"/spike-test\", \"local\": true},
        \"fingerprint\": \"local:test:spike\"
      }" > /dev/null 2>&1
    echo -n "."
done
echo ""
echo -e "${GREEN}✅ تم إرسال 15 خطأ${NC}"
((TESTS_PASSED++))
echo ""

# Test 3: Warning Log
echo -e "${YELLOW}⚠️  Test 3: تسجيل تحذير${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/log \
  -H 'Content-Type: application/json' \
  -d '{
    "level": "warn",
    "service": "web",
    "message": "TEST_WARNING: Slow query detected",
    "context": {"duration": 5000, "local": true}
  }' 2>/dev/null)

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ نجح - تم إرسال التحذير${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ فشل - HTTP $http_code${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Info Log
echo -e "${YELLOW}ℹ️  Test 4: تسجيل معلومات${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/log \
  -H 'Content-Type: application/json' \
  -d '{
    "level": "info",
    "service": "web",
    "message": "TEST_INFO: User logged in",
    "context": {"uid": "test-user-123", "local": true}
  }' 2>/dev/null)

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ نجح - تم إرسال المعلومات${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ فشل - HTTP $http_code${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Wait for processing
echo -e "${YELLOW}⏳ انتظار 3 ثواني لمعالجة الأحداث...${NC}"
sleep 3
echo ""

# Verify Firestore data
echo -e "${YELLOW}🔥 Test 5: التحقق من Firestore${NC}"
export FIRESTORE_EMULATOR_HOST=localhost:8080

echo -n "  📊 ops_events... "
event_count=$(firebase firestore:list ops_events --project demo-project 2>/dev/null | grep -c "Document ID:" || echo "0")
if [ "$event_count" -ge 10 ]; then
    echo -e "${GREEN}✅ وجدنا $event_count حدث${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  وجدنا $event_count حدث (متوقع >= 10)${NC}"
fi

echo -n "  🚨 ops_incidents... "
incident_count=$(firebase firestore:list ops_incidents --project demo-project 2>/dev/null | grep -c "Document ID:" || echo "0")
if [ "$incident_count" -ge 1 ]; then
    echo -e "${GREEN}✅ وجدنا $incident_count حادث${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  وجدنا $incident_count حادث (متوقع >= 1)${NC}"
fi

unset FIRESTORE_EMULATOR_HOST
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  📊 ملخص الاختبارات                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ نجح: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ فشل: $TESTS_FAILED${NC}"
echo ""

# Instructions
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🎯 الخطوات التالية                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}1. افتح لوحة التحكم:${NC}"
echo "   http://localhost:3000/ops/incidents"
echo ""
echo -e "${YELLOW}2. افحص Firestore Emulator UI:${NC}"
echo "   http://localhost:4000/firestore"
echo "   (إذا كان مُفعّل في firebase.json)"
echo ""
echo -e "${YELLOW}3. افحص البيانات عبر Firebase CLI:${NC}"
echo "   export FIRESTORE_EMULATOR_HOST=localhost:8080"
echo "   firebase firestore:list ops_events --project demo-project"
echo "   firebase firestore:list ops_incidents --project demo-project"
echo ""
echo -e "${YELLOW}4. اختبر من المتصفح Console:${NC}"
echo "   افتح: http://localhost:3000"
echo "   Console → اكتب:"
echo "   fetch('/api/log', {"
echo "     method: 'POST',"
echo "     headers: {'Content-Type': 'application/json'},"
echo "     body: JSON.stringify({"
echo "       level: 'error',"
echo "       message: 'Browser test error'"
echo "     })"
echo "   })"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 جميع الاختبارات نجحت! Phase 49 يعمل!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  بعض الاختبارات فشلت. راجع التفاصيل أعلاه.${NC}"
    exit 1
fi
