#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Phase 46 - Smoke Tests"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_status() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
  fi
}

echo "📋 Phase 46 Smoke Test Checklist"
echo "================================="
echo ""

# Test 1: Check if functions are deployed
echo "1️⃣  Checking deployed functions..."
echo "   - recordUsage"
RECORD_USAGE=$(firebase functions:list 2>&1 | grep -c "recordUsage" || true)
if [ "$RECORD_USAGE" -gt 0 ]; then
  echo -e "      ${GREEN}✓${NC} recordUsage is deployed"
else
  echo -e "      ${RED}✗${NC} recordUsage NOT found"
fi

echo "   - lowQuotaAlert"
LOW_QUOTA=$(firebase functions:list 2>&1 | grep -c "lowQuotaAlert" || true)
if [ "$LOW_QUOTA" -gt 0 ]; then
  echo -e "      ${GREEN}✓${NC} lowQuotaAlert is deployed"
else
  echo -e "      ${RED}✗${NC} lowQuotaAlert NOT found"
fi

echo "   - listInvoices"
LIST_INVOICES=$(firebase functions:list 2>&1 | grep -c "listInvoices" || true)
if [ "$LIST_INVOICES" -gt 0 ]; then
  echo -e "      ${GREEN}✓${NC} listInvoices is deployed"
else
  echo -e "      ${RED}✗${NC} listInvoices NOT found"
fi

echo ""

# Test 2: Check Firestore rules
echo "2️⃣  Checking Firestore rules..."
if grep -q "ops_usage_daily" firestore.rules; then
  echo -e "   ${GREEN}✓${NC} ops_usage_daily rules exist"
else
  echo -e "   ${RED}✗${NC} ops_usage_daily rules missing"
fi

if grep -q "ops_usage_monthly" firestore.rules; then
  echo -e "   ${GREEN}✓${NC} ops_usage_monthly rules exist"
else
  echo -e "   ${RED}✗${NC} ops_usage_monthly rules missing"
fi

if grep -q "ops_invoices" firestore.rules; then
  echo -e "   ${GREEN}✓${NC} ops_invoices rules exist"
else
  echo -e "   ${RED}✗${NC} ops_invoices rules missing"
fi

echo ""

# Test 3: Check source files
echo "3️⃣  Checking source files..."
if [ -f "functions/src/usage/record.ts" ]; then
  echo -e "   ${GREEN}✓${NC} record.ts exists"
else
  echo -e "   ${RED}✗${NC} record.ts missing"
fi

if [ -f "functions/src/usage/lowQuotaAlert.ts" ]; then
  echo -e "   ${GREEN}✓${NC} lowQuotaAlert.ts exists"
else
  echo -e "   ${RED}✗${NC} lowQuotaAlert.ts missing"
fi

if [ -f "functions/src/invoices/list.ts" ]; then
  echo -e "   ${GREEN}✓${NC} list.ts exists"
else
  echo -e "   ${RED}✗${NC} list.ts missing"
fi

if [ -f "functions/src/utils/plan.ts" ]; then
  echo -e "   ${GREEN}✓${NC} plan.ts helper exists"
else
  echo -e "   ${RED}✗${NC} plan.ts helper missing"
fi

echo ""

# Test 4: Check exports in index.ts
echo "4️⃣  Checking function exports..."
if grep -q "recordUsage" functions/src/index.ts; then
  echo -e "   ${GREEN}✓${NC} recordUsage exported"
else
  echo -e "   ${RED}✗${NC} recordUsage NOT exported"
fi

if grep -q "lowQuotaAlert" functions/src/index.ts; then
  echo -e "   ${GREEN}✓${NC} lowQuotaAlert exported"
else
  echo -e "   ${RED}✗${NC} lowQuotaAlert NOT exported"
fi

if grep -q "listInvoices" functions/src/index.ts; then
  echo -e "   ${GREEN}✓${NC} listInvoices exported"
else
  echo -e "   ${RED}✗${NC} listInvoices NOT exported"
fi

echo ""

# Test 5: Check scripts
echo "5️⃣  Checking scripts..."
if [ -f "scripts/deploy-phase46.sh" ] && [ -x "scripts/deploy-phase46.sh" ]; then
  echo -e "   ${GREEN}✓${NC} deploy-phase46.sh exists and is executable"
else
  echo -e "   ${YELLOW}⚠${NC} deploy-phase46.sh not executable"
fi

if [ -f "scripts/seed-phase46-demo.js" ] && [ -x "scripts/seed-phase46-demo.js" ]; then
  echo -e "   ${GREEN}✓${NC} seed-phase46-demo.js exists and is executable"
else
  echo -e "   ${YELLOW}⚠${NC} seed-phase46-demo.js not executable"
fi

echo ""

# Test 6: Check Cloud Scheduler
echo "6️⃣  Checking Cloud Scheduler jobs..."
SCHEDULER_JOB=$(gcloud scheduler jobs list --location=us-central1 --project=from-zero-84253 2>&1 | grep -c "lowQuotaAlert" || true)
if [ "$SCHEDULER_JOB" -gt 0 ]; then
  echo -e "   ${GREEN}✓${NC} lowQuotaAlert scheduled job exists"
  gcloud scheduler jobs describe firebase-schedule-lowQuotaAlert-us-central1 \
    --location=us-central1 \
    --project=from-zero-84253 2>&1 | grep -E "(schedule|timeZone)" || true
else
  echo -e "   ${YELLOW}⚠${NC} lowQuotaAlert scheduler job not found"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "📊 Test Summary"
echo "==============="
echo ""

# Count all checks
TOTAL_CHECKS=13
PASSED_CHECKS=$(grep -c "✓" <<< "$(cat "$0")" || true)

if [ "$RECORD_USAGE" -gt 0 ] && [ "$LOW_QUOTA" -gt 0 ] && [ "$LIST_INVOICES" -gt 0 ]; then
  echo -e "${GREEN}✅ All 3 Phase 46 functions are deployed${NC}"
else
  echo -e "${RED}❌ Some functions are missing${NC}"
fi

echo ""
echo "📝 Next Steps:"
echo "   1. Seed demo data: export DEMO_UID='your-uid' && node scripts/seed-phase46-demo.js"
echo "   2. Test recordUsage from frontend/API"
echo "   3. Monitor logs: firebase functions:log --only recordUsage"
echo "   4. Check Firestore collections:"
echo "      - ops_usage_daily/{uid_YYYY-MM-DD}"
echo "      - ops_usage_monthly/{uid_YYYY-MM}"
echo "      - ops_invoices"
echo "   5. Implement frontend UI:"
echo "      - /account/usage"
echo "      - /account/billing/history"
echo ""
echo "🔗 Function URLs:"
echo "   recordUsage:    https://recordusage-vpxyxgcfbq-uc.a.run.app"
echo "   lowQuotaAlert:  https://lowquotaalert-vpxyxgcfbq-uc.a.run.app"
echo "   listInvoices:   https://listinvoices-vpxyxgcfbq-uc.a.run.app"
echo ""
echo "✅ Phase 46 smoke tests complete!"
