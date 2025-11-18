#!/bin/bash

###############################################################################
# Quick Data Seeding for Phase 49 Incidents Dashboard
###############################################################################

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 توليد بيانات Incidents             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Test if services are running
echo -e "${YELLOW}🔍 فحص الخدمات...${NC}"
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "❌ Next.js غير مشغل. شغّل: pnpm dev"
    exit 1
fi
echo -e "${GREEN}✅ Next.js مشغل${NC}"
echo ""

# Seed different severity levels
echo -e "${YELLOW}📝 توليد الأخطاء...${NC}"
echo ""

# Low severity (5 errors)
echo -e "${BLUE}1. توليد Low Severity (5 أخطاء)${NC}"
for i in {1..5}; do
    curl -s -X POST "http://localhost:3000/api/log" \
      -H 'Content-Type: application/json' \
      -d "{
        \"level\": \"error\",
        \"service\": \"web\",
        \"code\": 500,
        \"message\": \"Database connection timeout\",
        \"fingerprint\": \"db-timeout-low\",
        \"context\": {\"db\": \"postgres\", \"attempt\": $i}
      }" > /dev/null
    echo -n "."
done
echo -e " ${GREEN}✅${NC}"
echo ""

# Medium severity (12 errors)
echo -e "${BLUE}2. توليد Medium Severity (12 خطأ)${NC}"
for i in {1..12}; do
    curl -s -X POST "http://localhost:3000/api/log" \
      -H 'Content-Type: application/json' \
      -d "{
        \"level\": \"error\",
        \"service\": \"api\",
        \"code\": 500,
        \"message\": \"API rate limit exceeded\",
        \"fingerprint\": \"api-rate-limit-medium\",
        \"context\": {\"endpoint\": \"/api/users\", \"attempt\": $i}
      }" > /dev/null
    echo -n "."
done
echo -e " ${GREEN}✅${NC}"
echo ""

# High severity (35 errors)
echo -e "${BLUE}3. توليد High Severity (35 خطأ)${NC}"
for i in {1..35}; do
    curl -s -X POST "http://localhost:3000/api/log" \
      -H 'Content-Type: application/json' \
      -d "{
        \"level\": \"error\",
        \"service\": \"payment\",
        \"code\": 503,
        \"message\": \"Payment gateway unavailable\",
        \"fingerprint\": \"payment-gateway-high\",
        \"context\": {\"gateway\": \"stripe\", \"attempt\": $i}
      }" > /dev/null
    echo -n "."
done
echo -e " ${GREEN}✅${NC}"
echo ""

# Different services
echo -e "${BLUE}4. توليد أخطاء من خدمات مختلفة${NC}"

services=("auth:Authentication failed" "storage:File upload failed" "email:Email delivery failed")
for service_msg in "${services[@]}"; do
    IFS=':' read -r service message <<< "$service_msg"
    for i in {1..8}; do
        curl -s -X POST "http://localhost:3000/api/log" \
          -H 'Content-Type: application/json' \
          -d "{
            \"level\": \"error\",
            \"service\": \"$service\",
            \"code\": 500,
            \"message\": \"$message\",
            \"fingerprint\": \"${service}-error\",
            \"context\": {\"service\": \"$service\"}
          }" > /dev/null
    done
    echo "  ✅ $service (8 أخطاء)"
done
echo ""

# Wait for triggers
echo -e "${YELLOW}⏳ انتظار معالجة Triggers (3 ثواني)...${NC}"
sleep 3
echo -e "${GREEN}✅ تم${NC}"
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 ملخص البيانات المُولَّدة           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🔵 Low (5 errors)     - db-timeout-low"
echo -e "  🟡 Medium (12 errors) - api-rate-limit-medium"
echo -e "  🟠 High (35 errors)   - payment-gateway-high"
echo -e "  📦 auth (8 errors)    - auth-error"
echo -e "  📦 storage (8 errors) - storage-error"
echo -e "  📦 email (8 errors)   - email-error"
echo ""
echo -e "${GREEN}✅ تم توليد 76 خطأ في 6 incidents${NC}"
echo ""

# Instructions
echo -e "${YELLOW}🎯 الخطوات التالية:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. افتح Dashboard:"
echo -e "   ${BLUE}http://localhost:3000/ar/ops/incidents${NC}"
echo ""
echo "2. يجب أن ترى 6 incidents:"
echo "   - 1x Low severity (أزرق)"
echo "   - 4x Medium severity (أصفر)"
echo "   - 1x High severity (برتقالي)"
echo ""
echo "3. إذا كان الجدول فارغاً:"
echo "   a) افتح Emulator UI: http://localhost:4000/auth"
echo "   b) عدّل المستخدم → Custom Claims → {\"admin\": true}"
echo "   c) سجّل خروج/دخول وحدّث الصفحة"
echo ""
echo "4. تحقق من Firestore:"
echo -e "   ${BLUE}http://localhost:4000/firestore${NC}"
echo "   - ops_events (يجب أن يحتوي ~76 مستند)"
echo "   - ops_incidents (يجب أن يحتوي 6 مستندات)"
echo ""
