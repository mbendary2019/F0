#!/bin/bash
# Quick validation check for Phase 33.3

echo "🧪 Phase 33.3 - Quick Validation Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASS=0
FAIL=0

# Test 1: Files
echo "📁 Test 1: Files Presence"
echo "─────────────────────────"
[ -f "functions/src/auto/tuner.ts" ] && echo "✅ tuner.ts" && ((PASS++)) || echo "❌ tuner.ts missing" && ((FAIL++))
[ -f "functions/src/auto/guardrailAdapt.ts" ] && echo "✅ guardrailAdapt.ts" && ((PASS++)) || echo "❌ guardrailAdapt.ts missing" && ((FAIL++))
[ -f "functions/src/auto/metaLearner.ts" ] && echo "✅ metaLearner.ts" && ((PASS++)) || echo "❌ metaLearner.ts missing" && ((FAIL++))
[ -f "functions/src/auto/autoDoc.ts" ] && echo "✅ autoDoc.ts" && ((PASS++)) || echo "❌ autoDoc.ts missing" && ((FAIL++))
[ -f "src/app/api/admin/policies/history/route.ts" ] && echo "✅ history API" && ((PASS++)) || echo "❌ history API missing" && ((FAIL++))
[ -f "src/app/api/admin/policies/tune/route.ts" ] && echo "✅ tune API" && ((PASS++)) || echo "❌ tune API missing" && ((FAIL++))
[ -f "src/app/admin/policies/page.tsx" ] && echo "✅ UI Dashboard" && ((PASS++)) || echo "❌ UI Dashboard missing" && ((FAIL++))
echo ""

# Test 2: Documentation
echo "📚 Test 2: Documentation Files"
echo "──────────────────────────────"
[ -f "docs/PHASE_33_3_SELF_EVOLVING_OPS.md" ] && echo "✅ Technical docs" && ((PASS++)) || echo "❌ Technical docs missing" && ((FAIL++))
[ -f "PHASE_33_3_COMPLETE_SUMMARY.md" ] && echo "✅ Complete summary" && ((PASS++)) || echo "❌ Complete summary missing" && ((FAIL++))
[ -f "AUTONOMOUS_OPS_COMPLETE_GUIDE.md" ] && echo "✅ Integration guide" && ((PASS++)) || echo "❌ Integration guide missing" && ((FAIL++))
[ -f "PHASE_33_3_READY.txt" ] && echo "✅ Quick reference" && ((PASS++)) || echo "❌ Quick reference missing" && ((FAIL++))
echo ""

# Test 3: Exports
echo "📤 Test 3: Function Exports"
echo "───────────────────────────"
grep -q "autoPolicyTuner" functions/src/index.ts && echo "✅ autoPolicyTuner exported" && ((PASS++)) || echo "❌ autoPolicyTuner NOT exported" && ((FAIL++))
grep -q "guardrailAdapt" functions/src/index.ts && echo "✅ guardrailAdapt exported" && ((PASS++)) || echo "❌ guardrailAdapt NOT exported" && ((FAIL++))
grep -q "metaLearner" functions/src/index.ts && echo "✅ metaLearner exported" && ((PASS++)) || echo "❌ metaLearner NOT exported" && ((FAIL++))
grep -q "autoDoc" functions/src/index.ts && echo "✅ autoDoc exported" && ((PASS++)) || echo "❌ autoDoc NOT exported" && ((FAIL++))
echo ""

# Test 4: Schedules
echo "⏰ Test 4: Cron Schedules"
echo "─────────────────────────"
grep -q "schedule('every 24 hours')" functions/src/auto/tuner.ts && echo "✅ tuner: 24h schedule" && ((PASS++)) || echo "❌ tuner schedule missing" && ((FAIL++))
grep -q "schedule('every 12 hours')" functions/src/auto/guardrailAdapt.ts && echo "✅ guardrail: 12h schedule" && ((PASS++)) || echo "❌ guardrail schedule missing" && ((FAIL++))
grep -q "schedule('every 72 hours')" functions/src/auto/metaLearner.ts && echo "✅ meta-learner: 72h schedule" && ((PASS++)) || echo "❌ meta-learner schedule missing" && ((FAIL++))
grep -q "schedule('every 24 hours')" functions/src/auto/autoDoc.ts && echo "✅ autoDoc: 24h schedule" && ((PASS++)) || echo "❌ autoDoc schedule missing" && ((FAIL++))
echo ""

# Test 5: Security
echo "🔒 Test 5: Security (RBAC)"
echo "──────────────────────────"
grep -q "assertAdminReq" src/app/api/admin/policies/history/route.ts && echo "✅ history API has RBAC" && ((PASS++)) || echo "❌ history API missing RBAC" && ((FAIL++))
grep -q "assertAdminReq" src/app/api/admin/policies/tune/route.ts && echo "✅ tune API has RBAC" && ((PASS++)) || echo "❌ tune API missing RBAC" && ((FAIL++))
grep -q "admin_audit" functions/src/auto/tuner.ts && echo "✅ tuner has audit logging" && ((PASS++)) || echo "❌ tuner missing audit" && ((FAIL++))
echo ""

# Test 6: TypeScript
echo "🔧 Test 6: TypeScript"
echo "─────────────────────"
if npm run typecheck > /tmp/ts-check.log 2>&1; then
    echo "✅ TypeScript: 0 errors"
    ((PASS++))
else
    ERRORS=$(grep -c "error TS" /tmp/ts-check.log 2>/dev/null || echo "0")
    if [ "$ERRORS" -eq "0" ]; then
        echo "✅ TypeScript: 0 errors"
        ((PASS++))
    else
        echo "❌ TypeScript: $ERRORS errors"
        ((FAIL++))
    fi
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Passed:  $PASS"
echo "❌ Failed:  $FAIL"
TOTAL=$((PASS + FAIL))
echo "Total:    $TOTAL tests"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎊 ALL TESTS PASSED! Ready to deploy! 🚀"
    echo ""
    echo "Next: ./PHASE_33_3_DEPLOYMENT.sh"
    exit 0
else
    echo "⚠️  Some tests failed. Fix and re-run."
    exit 1
fi
