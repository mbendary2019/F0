#!/bin/bash

###############################################################################
# سكريبت اختبار الخدمات المتقدم - From Zero
# يختبر جميع endpoints والوظائف المهمة
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🧪 اختبار الخدمات المتقدم             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# دالة للاختبار مع محتوى JSON
test_json_endpoint() {
    local name="$1"
    local url="$2"
    local expected_key="$3"

    echo -n "🔍 $name... "

    response=$(curl -s "$url" 2>/dev/null)

    if echo "$response" | grep -q "$expected_key"; then
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

# دالة لاختبار POST request
test_post_endpoint() {
    local name="$1"
    local url="$2"
    local data="$3"
    local expected_status="$4"

    echo -n "🔍 $name... "

    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null)

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ نجح (HTTP $status)${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ فشل (HTTP $status، متوقع $expected_status)${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "${YELLOW}🌐 1. اختبار Next.js App${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_json_endpoint "API Health Check" "http://localhost:3000/api/health" "ok"

# اختبار logging API
echo -n "🔍 اختبار تسجيل الأحداث... "
log_response=$(curl -s -X POST http://localhost:3000/api/log \
    -H "Content-Type: application/json" \
    -d '{"level":"info","msg":"TEST_LOG","service":"test"}' 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ نجح${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ فشل${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo -e "${YELLOW}🔥 2. اختبار Firebase Emulators${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Firestore
echo -n "🔍 Firestore Emulator... "
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ يعمل${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ لا يعمل${NC}"
    ((TESTS_FAILED++))
fi

# Auth
echo -n "🔍 Auth Emulator... "
if curl -s http://localhost:9099 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ يعمل${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ لا يعمل${NC}"
    ((TESTS_FAILED++))
fi

# Functions
echo -n "🔍 Functions Emulator... "
if curl -s http://localhost:5001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ يعمل${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ لا يعمل${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo -e "${YELLOW}🎼 3. اختبار Orchestrator (اختياري)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s http://localhost:9090 > /dev/null 2>&1; then
    test_json_endpoint "Orchestrator Readiness" "http://localhost:9090/readyz" "ready"
    test_json_endpoint "Orchestrator Health" "http://localhost:9090/api/health" "ok"
else
    echo -e "${YELLOW}⚠️  Orchestrator غير مشغل (اختياري)${NC}"
fi

echo ""
echo -e "${YELLOW}📊 4. اختبار البيانات في Firestore${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v firebase &> /dev/null; then
    export FIRESTORE_EMULATOR_HOST=localhost:8080

    # اختبار ops_branding
    echo -n "🔍 ops_branding/prod... "
    if firebase firestore:get ops_branding/prod --project demo-project 2>/dev/null | grep -q "appName"; then
        echo -e "${GREEN}✅ موجود${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  غير موجود${NC}"
        echo "   قم بتشغيل: node scripts/seed-all.js"
    fi

    # اختبار ops_billing_plans
    echo -n "🔍 ops_billing_plans... "
    plan_count=$(firebase firestore:list ops_billing_plans --project demo-project 2>/dev/null | grep -c "Document ID:" || echo "0")
    if [ "$plan_count" -ge 3 ]; then
        echo -e "${GREEN}✅ موجود ($plan_count خطط)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  عدد غير كافٍ ($plan_count خطط)${NC}"
        echo "   قم بتشغيل: node scripts/seed-all.js"
    fi

    # اختبار ops_marketplace_items
    echo -n "🔍 ops_marketplace_items... "
    items_count=$(firebase firestore:list ops_marketplace_items --project demo-project 2>/dev/null | grep -c "Document ID:" || echo "0")
    if [ "$items_count" -ge 3 ]; then
        echo -e "${GREEN}✅ موجود ($items_count عناصر)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  عدد غير كافٍ ($items_count عناصر)${NC}"
        echo "   قم بتشغيل: node scripts/seed-all.js"
    fi

    unset FIRESTORE_EMULATOR_HOST
fi

echo ""
echo -e "${YELLOW}🔐 5. اختبار Security Headers (للإنتاج)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "هل تريد اختبار security headers للإنتاج؟ (أدخل URL أو اضغط Enter للتخطي): " PROD_URL

if [ ! -z "$PROD_URL" ]; then
    echo ""
    echo "📋 فحص Security Headers..."

    headers=$(curl -s -I "$PROD_URL" 2>/dev/null)

    # Strict-Transport-Security
    echo -n "  🔍 HSTS... "
    if echo "$headers" | grep -iq "Strict-Transport-Security"; then
        echo -e "${GREEN}✅${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ مفقود${NC}"
        ((TESTS_FAILED++))
    fi

    # X-Content-Type-Options
    echo -n "  🔍 X-Content-Type-Options... "
    if echo "$headers" | grep -iq "X-Content-Type-Options"; then
        echo -e "${GREEN}✅${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ مفقود${NC}"
        ((TESTS_FAILED++))
    fi

    # X-Frame-Options
    echo -n "  🔍 X-Frame-Options... "
    if echo "$headers" | grep -iq "X-Frame-Options"; then
        echo -e "${GREEN}✅${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ مفقود${NC}"
        ((TESTS_FAILED++))
    fi

    # Referrer-Policy
    echo -n "  🔍 Referrer-Policy... "
    if echo "$headers" | grep -iq "Referrer-Policy"; then
        echo -e "${GREEN}✅${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ مفقود${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⏭️  تم التخطي${NC}"
fi

echo ""
echo -e "${YELLOW}⚡ 6. اختبار Cloud Functions (اختياري)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "هل تريد اختبار Cloud Functions؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # اختبار callable function (مثال)
    echo -n "🔍 اختبار Functions API... "

    # ملاحظة: قد تحتاج لتعديل اسم الـ function والـ region حسب مشروعك
    PROJECT_ID=$(firebase use 2>/dev/null | grep "Now using project" | awk '{print $4}' || echo "demo-project")

    if curl -s "http://localhost:5001/$PROJECT_ID/us-central1/" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Functions API متاح${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  لم يتم العثور على functions${NC}"
    fi
fi

# ملخص النتائج
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 ملخص الاختبارات                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ نجح: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ فشل: $TESTS_FAILED${NC}"
echo ""

# توصيات
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${YELLOW}💡 توصيات:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1. إذا كانت الخدمات لا تعمل، شغّل: ./start-local.sh"
    echo "2. إذا كانت البيانات مفقودة، شغّل: node scripts/seed-all.js"
    echo "3. إذا كانت Functions لا تعمل، أعد بناءها: cd functions && npm run build"
    echo "4. راجع الـ logs: tail -f logs/*.log"
    echo ""
fi

# نصائح إضافية
echo -e "${BLUE}💡 اختبارات إضافية يمكنك تشغيلها:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• تسجيل حدث خطأ تجريبي:"
echo "  curl -X POST http://localhost:3000/api/log \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"level\":\"error\",\"msg\":\"TEST_500\",\"service\":\"web\"}'"
echo ""
echo "• اختبار Stripe Webhook (إذا كان Stripe CLI مثبت):"
echo "  stripe trigger payment_intent.succeeded"
echo ""
echo "• اختبار Firestore Rules:"
echo "  firebase emulators:start --only firestore"
echo "  # ثم استخدم Firebase SDK لاختبار القراءة/الكتابة"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 جميع الاختبارات نجحت! النظام جاهز للاستخدام.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  بعض الاختبارات فشلت. راجع التوصيات أعلاه.${NC}"
    exit 1
fi
