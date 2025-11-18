#!/bin/bash

###############################################################################
# أوامر مفيدة للتطوير والاختبار - From Zero
# استخدام: source useful-commands.sh لتحميل الـ functions
###############################################################################

# ألوان
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📝 تم تحميل الأوامر المفيدة!${NC}"
echo ""

# 1. اختبار صحة الأوركستريتور
test_orchestrator() {
    echo -e "${YELLOW}🎼 اختبار Orchestrator...${NC}"

    echo "1. Readiness Check:"
    curl -s http://localhost:9090/readyz | jq . || curl -s http://localhost:9090/readyz

    echo ""
    echo "2. Health Check:"
    curl -s http://localhost:9090/api/health | jq . || curl -s http://localhost:9090/api/health
}

# 2. تسجيل حدث خطأ تجريبي
test_error_log() {
    echo -e "${YELLOW}📝 تسجيل حدث خطأ تجريبي...${NC}"

    curl -X POST http://localhost:3000/api/log \
        -H "Content-Type: application/json" \
        -d '{"level":"error","msg":"TEST_500","service":"web","metadata":{"test":true}}' \
        | jq . || echo "تم الإرسال"

    echo -e "${GREEN}✅ تم إرسال حدث الخطأ${NC}"
}

# 3. تسجيل أحداث متنوعة
test_multiple_logs() {
    echo -e "${YELLOW}📝 تسجيل أحداث متنوعة...${NC}"

    # Info
    curl -s -X POST http://localhost:3000/api/log \
        -H "Content-Type: application/json" \
        -d '{"level":"info","msg":"TEST_INFO","service":"web"}' > /dev/null
    echo "✅ Info log"

    # Warning
    curl -s -X POST http://localhost:3000/api/log \
        -H "Content-Type: application/json" \
        -d '{"level":"warn","msg":"TEST_WARNING","service":"web"}' > /dev/null
    echo "✅ Warning log"

    # Error
    curl -s -X POST http://localhost:3000/api/log \
        -H "Content-Type: application/json" \
        -d '{"level":"error","msg":"TEST_ERROR","service":"web"}' > /dev/null
    echo "✅ Error log"

    echo -e "${GREEN}✅ تم إرسال 3 أحداث${NC}"
}

# 4. اختبار Security Headers
test_security_headers() {
    local url="${1:-http://localhost:3000}"

    echo -e "${YELLOW}🔐 اختبار Security Headers...${NC}"
    echo "URL: $url"
    echo ""

    headers=$(curl -s -I "$url")

    echo "📋 Security Headers الموجودة:"
    echo "$headers" | egrep -i 'strict|content-security|x-frame|x-content-type|referrer|permissions' || echo "لم يتم العثور على headers"
}

# 5. اختبار Firestore Emulator
test_firestore() {
    echo -e "${YELLOW}🔥 اختبار Firestore Emulator...${NC}"

    export FIRESTORE_EMULATOR_HOST=localhost:8080

    echo "1. عرض Collections:"
    firebase firestore:list --project demo-project 2>/dev/null | head -20

    echo ""
    echo "2. عرض خطط الفوترة:"
    firebase firestore:list ops_billing_plans --project demo-project 2>/dev/null

    echo ""
    echo "3. قراءة خطة Pro:"
    firebase firestore:get ops_billing_plans/pro --project demo-project 2>/dev/null

    unset FIRESTORE_EMULATOR_HOST
}

# 6. تشغيل نسخ احتياطي يدوي (للإنتاج)
run_backup() {
    echo -e "${YELLOW}💾 تشغيل نسخ احتياطي...${NC}"

    read -p "هل تريد أخذ نسخة احتياطية من Firestore؟ (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BACKUP_DIR="./backups/manual_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"

        firebase firestore:export "$BACKUP_DIR"

        echo -e "${GREEN}✅ تم الحفظ في: $BACKUP_DIR${NC}"
    fi
}

# 7. اختبار Stripe Webhook (محليًا)
test_stripe_webhook() {
    echo -e "${YELLOW}💳 اختبار Stripe Webhooks...${NC}"

    if ! command -v stripe &> /dev/null; then
        echo -e "${YELLOW}⚠️  Stripe CLI غير مثبت${NC}"
        echo "قم بتثبيته: brew install stripe/stripe-cli/stripe"
        return 1
    fi

    echo "1. الاستماع للـ webhooks:"
    echo "   stripe listen --forward-to localhost:9090/webhook/stripe"
    echo ""
    echo "2. محاكاة أحداث (في terminal آخر):"
    echo "   stripe trigger payment_intent.succeeded"
    echo "   stripe trigger customer.subscription.created"
    echo "   stripe trigger invoice.payment_succeeded"
}

# 8. مراقبة الـ Logs مباشرة
watch_logs() {
    local service="${1:-all}"

    echo -e "${YELLOW}📊 مراقبة الـ Logs...${NC}"

    case $service in
        "nextjs"|"next")
            tail -f logs/nextjs.log
            ;;
        "emulators"|"firebase")
            tail -f logs/emulators.log
            ;;
        "orchestrator"|"orch")
            tail -f logs/orchestrator.log
            ;;
        "all"|*)
            tail -f logs/*.log
            ;;
    esac
}

# 9. فحص صحة جميع الخدمات
health_check_all() {
    echo -e "${BLUE}🏥 فحص صحة جميع الخدمات...${NC}"
    echo ""

    # Next.js
    echo -n "1. Next.js (3000)... "
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  غير متاح${NC}"
    fi

    # Firestore
    echo -n "2. Firestore (8080)... "
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  غير متاح${NC}"
    fi

    # Auth
    echo -n "3. Auth (9099)... "
    if curl -s http://localhost:9099 > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  غير متاح${NC}"
    fi

    # Functions
    echo -n "4. Functions (5001)... "
    if curl -s http://localhost:5001 > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  غير متاح${NC}"
    fi

    # Orchestrator
    echo -n "5. Orchestrator (9090)... "
    if curl -s http://localhost:9090/readyz > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  غير متاح (اختياري)${NC}"
    fi
}

# 10. قياس أداء API
benchmark_api() {
    local endpoint="${1:-http://localhost:3000/api/health}"
    local requests="${2:-100}"

    echo -e "${YELLOW}⚡ قياس أداء API...${NC}"
    echo "Endpoint: $endpoint"
    echo "Requests: $requests"
    echo ""

    if command -v ab &> /dev/null; then
        ab -n $requests -c 10 "$endpoint"
    else
        echo "Apache Bench غير مثبت"
        echo "للتثبيت: brew install httpd"
        echo ""
        echo "بديل بسيط:"

        start=$(date +%s.%N)
        for i in $(seq 1 $requests); do
            curl -s "$endpoint" > /dev/null
        done
        end=$(date +%s.%N)

        runtime=$(echo "$end - $start" | bc)
        rps=$(echo "scale=2; $requests / $runtime" | bc)

        echo "الوقت الكلي: ${runtime}s"
        echo "Requests/sec: $rps"
    fi
}

# عرض قائمة الأوامر المتاحة
show_commands() {
    echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   📝 الأوامر المتاحة                     ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo "  test_orchestrator         - اختبار الأوركستريتور"
    echo "  test_error_log            - تسجيل حدث خطأ تجريبي"
    echo "  test_multiple_logs        - تسجيل أحداث متنوعة"
    echo "  test_security_headers     - فحص Security Headers"
    echo "  test_firestore            - اختبار Firestore Emulator"
    echo "  run_backup                - تشغيل نسخ احتياطي"
    echo "  test_stripe_webhook       - دليل اختبار Stripe"
    echo "  watch_logs [service]      - مراقبة Logs (nextjs|firebase|orchestrator|all)"
    echo "  health_check_all          - فحص جميع الخدمات"
    echo "  benchmark_api [url] [n]   - قياس أداء API"
    echo "  show_commands             - عرض هذه القائمة"
    echo ""
    echo -e "${YELLOW}💡 استخدام:${NC}"
    echo "  source useful-commands.sh  # تحميل الأوامر"
    echo "  test_orchestrator          # تشغيل أمر"
    echo ""
}

# عرض القائمة عند التحميل
show_commands
