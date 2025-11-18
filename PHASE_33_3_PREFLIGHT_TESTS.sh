#!/bin/bash
# 🧪 Phase 33.3 Pre-flight Tests
# Quick sanity checks before deployment (takes ~5 minutes)

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 PHASE 33.3 - PRE-FLIGHT TESTS"
echo "   Quick validation before deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 1: Files Presence Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Test 1/5: Files Presence Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cloud Functions
if [ -f "functions/src/auto/tuner.ts" ]; then
    pass "autoPolicyTuner function exists"
else
    fail "autoPolicyTuner function missing"
fi

if [ -f "functions/src/auto/guardrailAdapt.ts" ]; then
    pass "guardrailAdapt function exists"
else
    fail "guardrailAdapt function missing"
fi

if [ -f "functions/src/auto/metaLearner.ts" ]; then
    pass "metaLearner function exists"
else
    fail "metaLearner function missing"
fi

if [ -f "functions/src/auto/autoDoc.ts" ]; then
    pass "autoDoc function exists"
else
    fail "autoDoc function missing"
fi

# API Routes
if [ -f "src/app/api/admin/policies/history/route.ts" ]; then
    pass "Policy history API route exists"
else
    fail "Policy history API route missing"
fi

if [ -f "src/app/api/admin/policies/tune/route.ts" ]; then
    pass "Policy tune API route exists"
else
    fail "Policy tune API route missing"
fi

# UI Dashboard
if [ -f "src/app/admin/policies/page.tsx" ]; then
    pass "Policies dashboard UI exists"
else
    fail "Policies dashboard UI missing"
fi

# Documentation (4 required files)
DOCS_COUNT=0
if [ -f "docs/PHASE_33_3_SELF_EVOLVING_OPS.md" ]; then
    pass "Technical documentation exists"
    ((DOCS_COUNT++))
else
    fail "Technical documentation missing"
fi

if [ -f "PHASE_33_3_COMPLETE_SUMMARY.md" ]; then
    pass "Complete summary exists"
    ((DOCS_COUNT++))
else
    fail "Complete summary missing"
fi

if [ -f "AUTONOMOUS_OPS_COMPLETE_GUIDE.md" ]; then
    pass "Integration guide exists"
    ((DOCS_COUNT++))
else
    fail "Integration guide missing"
fi

if [ -f "PHASE_33_3_READY.txt" ]; then
    pass "Quick reference exists"
    ((DOCS_COUNT++))
else
    fail "Quick reference missing"
fi

if [ $DOCS_COUNT -eq 4 ]; then
    pass "All 4 documentation files present"
else
    fail "Only $DOCS_COUNT/4 documentation files found"
fi

# Deployment script
if [ -f "PHASE_33_3_DEPLOYMENT.sh" ] && [ -x "PHASE_33_3_DEPLOYMENT.sh" ]; then
    pass "Deployment script exists and is executable"
else
    if [ -f "PHASE_33_3_DEPLOYMENT.sh" ]; then
        warn "Deployment script exists but not executable (run: chmod +x PHASE_33_3_DEPLOYMENT.sh)"
    else
        fail "Deployment script missing"
    fi
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 2: TypeScript Compilation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Test 2/5: TypeScript Compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Running typecheck..."
if npm run typecheck > /tmp/typecheck.log 2>&1; then
    ERROR_COUNT=$(grep -c "error TS" /tmp/typecheck.log || echo "0")
    if [ "$ERROR_COUNT" -eq "0" ]; then
        pass "TypeScript compilation: 0 errors"
    else
        fail "TypeScript compilation: $ERROR_COUNT errors found"
        echo "   (Check /tmp/typecheck.log for details)"
    fi
else
    fail "TypeScript typecheck failed"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 3: Function Exports Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 Test 3/5: Function Exports Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if functions are exported in index.ts
if grep -q "autoPolicyTuner" functions/src/index.ts; then
    pass "autoPolicyTuner exported in index.ts"
else
    fail "autoPolicyTuner NOT exported in index.ts"
fi

if grep -q "guardrailAdapt" functions/src/index.ts; then
    pass "guardrailAdapt exported in index.ts"
else
    fail "guardrailAdapt NOT exported in index.ts"
fi

if grep -q "metaLearner" functions/src/index.ts; then
    pass "metaLearner exported in index.ts"
else
    fail "metaLearner NOT exported in index.ts"
fi

if grep -q "autoDoc" functions/src/index.ts; then
    pass "autoDoc exported in index.ts"
else
    fail "autoDoc NOT exported in index.ts"
fi

# Check auto module index exports
if [ -f "functions/src/auto/index.ts" ]; then
    if grep -q "export.*autoPolicyTuner" functions/src/auto/index.ts; then
        pass "Auto module exports all functions"
    else
        fail "Auto module missing exports"
    fi
else
    fail "Auto module index.ts missing"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 4: Code Quality Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Test 4/5: Code Quality Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for required function schedules
if grep -q "schedule('every 24 hours')" functions/src/auto/tuner.ts; then
    pass "autoPolicyTuner has correct schedule (24h)"
else
    fail "autoPolicyTuner schedule incorrect or missing"
fi

if grep -q "schedule('every 12 hours')" functions/src/auto/guardrailAdapt.ts; then
    pass "guardrailAdapt has correct schedule (12h)"
else
    fail "guardrailAdapt schedule incorrect or missing"
fi

if grep -q "schedule('every 72 hours')" functions/src/auto/metaLearner.ts; then
    pass "metaLearner has correct schedule (72h)"
else
    fail "metaLearner schedule incorrect or missing"
fi

if grep -q "schedule('every 24 hours')" functions/src/auto/autoDoc.ts; then
    pass "autoDoc has correct schedule (24h)"
else
    fail "autoDoc schedule incorrect or missing"
fi

# Check for audit logging in tuner
if grep -q "admin_audit" functions/src/auto/tuner.ts; then
    pass "autoPolicyTuner includes audit logging"
else
    fail "autoPolicyTuner missing audit logging"
fi

# Check for bounded parameters
if grep -q "Math.max.*Math.min" functions/src/auto/tuner.ts; then
    pass "autoPolicyTuner has bounded hyperparameters"
else
    warn "autoPolicyTuner might be missing parameter bounds"
fi

# Check for RBAC in API routes
if grep -q "assertAdminReq" src/app/api/admin/policies/history/route.ts; then
    pass "Policy history API has RBAC protection"
else
    fail "Policy history API missing RBAC"
fi

if grep -q "assertAdminReq" src/app/api/admin/policies/tune/route.ts; then
    pass "Policy tune API has RBAC protection"
else
    fail "Policy tune API missing RBAC"
fi

# Check for Zod validation in tune route
if grep -q "z.object" src/app/api/admin/policies/tune/route.ts; then
    pass "Policy tune API has input validation"
else
    fail "Policy tune API missing input validation"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 5: Integration Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Test 5/5: Integration Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for Phase 33.2 integration
if grep -q "rl_policy" functions/src/auto/tuner.ts; then
    pass "Auto-tuner integrates with rl_policy"
else
    fail "Auto-tuner missing rl_policy integration"
fi

if grep -q "rl_decisions" functions/src/auto/guardrailAdapt.ts; then
    pass "Guardrail adapter integrates with rl_decisions"
else
    fail "Guardrail adapter missing rl_decisions integration"
fi

if grep -q "rl_policy_versions" functions/src/auto/metaLearner.ts; then
    pass "Meta-learner integrates with rl_policy_versions"
else
    fail "Meta-learner missing rl_policy_versions integration"
fi

# Check for new Firestore collections
if grep -q "auto_docs" functions/src/auto/autoDoc.ts; then
    pass "Auto-doc uses auto_docs collection"
else
    fail "Auto-doc missing auto_docs collection"
fi

if grep -q "ops_policies" functions/src/auto/guardrailAdapt.ts; then
    pass "Guardrail adapter uses ops_policies collection"
else
    fail "Guardrail adapter missing ops_policies collection"
fi

# Check UI integration
if grep -q "/api/admin/policies/history" src/app/admin/policies/page.tsx; then
    pass "UI dashboard connects to history API"
else
    fail "UI dashboard missing history API integration"
fi

if grep -q "/api/admin/policies/tune" src/app/admin/policies/page.tsx; then
    pass "UI dashboard connects to tune API"
else
    fail "UI dashboard missing tune API integration"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Passed:${NC}   $PASSED"
echo -e "${RED}❌ Failed:${NC}   $FAILED"
echo -e "${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
echo ""
TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$(awk "BEGIN {printf \"%.0f\", ($PASSED/$TOTAL)*100}")
echo "Success Rate: $SUCCESS_RATE% ($PASSED/$TOTAL)"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎊 ALL TESTS PASSED! Ready for deployment! 🚀${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run deployment: ./PHASE_33_3_DEPLOYMENT.sh"
    echo "  2. Monitor first cycle: firebase functions:log --follow"
    echo "  3. Check dashboard: /admin/policies"
    echo ""
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  SOME TESTS FAILED! Fix issues before deployment.${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Please fix the failed tests and run again."
    echo ""
    exit 1
fi


