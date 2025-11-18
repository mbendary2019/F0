#!/bin/bash

###############################################################################
# سكريبت اختبارات الدخان السريعة - From Zero
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🧪 اختبارات الدخان السريعة            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# دالة للاختبار
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"

    echo -n "🔍 $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$response" = "$expected" ] || [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ نجح${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ فشل (HTTP $response)${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# دالة للاختبار مع محتوى
test_content() {
    local name="$1"
    local url="$2"
    local expected_content="$3"

    echo -n "🔍 $name... "

    response=$(curl -s "$url" 2>/dev/null)

    if echo "$response" | grep -q "$expected_content"; then
        echo -e "${GREEN}✅ نجح${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ فشل${NC}"
        echo "   الاستجابة: $response"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "${YELLOW}🌐 اختبار Next.js App${NC}"
test_endpoint "الصفحة الرئيسية" "http://localhost:3000" "200"
test_content "API Health Check" "http://localhost:3000/api/health" "ok"

echo ""
echo -e "${YELLOW}🔥 اختبار Firebase Emulators${NC}"
test_endpoint "Firestore Emulator" "http://localhost:8080" "200"
test_endpoint "Auth Emulator" "http://localhost:9099" "200"

echo ""
echo -e "${YELLOW}⚡ اختبار Cloud Functions${NC}"
# ملاحظة: قد تحتاج لتعديل أسماء Functions حسب مشروعك
curl -s http://localhost:5001 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "🔍 Functions Emulator... ${GREEN}✅ يعمل${NC}"
    ((TESTS_PASSED++))
else
    echo -e "🔍 Functions Emulator... ${RED}❌ لا يعمل${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo -e "${YELLOW}🎼 اختبار Orchestrator (اختياري)${NC}"
if curl -s http://localhost:9090/readyz > /dev/null 2>&1; then
    test_content "Orchestrator Readiness" "http://localhost:9090/readyz" "ready"
else
    echo -e "🔍 Orchestrator... ${YELLOW}⚠️  غير مشغل (اختياري)${NC}"
fi

# اختبار Firestore Data
echo ""
echo -e "${YELLOW}📊 اختبار البيانات${NC}"

# التحقق من وجود billing plans
if command -v firebase &> /dev/null; then
    echo -n "🔍 خطط الفوترة... "

    # للمحاكي المحلي
    export FIRESTORE_EMULATOR_HOST=localhost:8080

    # محاولة قراءة البيانات
    if firebase firestore:get ops_billing_plans/pro --project demo-project 2>/dev/null | grep -q "pro"; then
        echo -e "${GREEN}✅ موجودة${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  غير موجودة - قم بتشغيل: node scripts/seed-all.js${NC}"
    fi

    unset FIRESTORE_EMULATOR_HOST
fi

# ملخص
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 ملخص الاختبارات                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ نجح: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ فشل: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 جميع الاختبارات نجحت!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  بعض الاختبارات فشلت. راجع الأخطاء أعلاه.${NC}"
    exit 1
fi
