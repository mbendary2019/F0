#!/bin/bash
# F0 Extensions - Production Smoke Tests

set -e

echo "🔥 F0 Extensions - Production Smoke Tests"
echo "=========================================="
echo ""

# Test 1: Orchestrator Health
echo "🏥 Test 1: Orchestrator Health Check"
if curl -sf http://localhost:8080/readyz > /dev/null; then
    echo "   ✅ Orchestrator is running and healthy"
else
    echo "   ❌ Orchestrator is not running"
    echo "   💡 Start with: cd orchestrator && pnpm dev"
    exit 1
fi
echo ""

# Test 2: Extension Tests
echo "📝 Test 2: Extension Validation & Tests"
pnpm run ext:test > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ All extension tests passed"
else
    echo "   ❌ Extension tests failed"
    exit 1
fi
echo ""

# Test 3: System Health
echo "🩺 Test 3: System Health Check"
pnpm run ext:doctor > /tmp/doctor-output.txt 2>&1
if grep -q "✅ OK:" /tmp/doctor-output.txt; then
    OK_COUNT=$(grep "✅ OK:" /tmp/doctor-output.txt | awk '{print $3}')
    echo "   ✅ System health: $OK_COUNT checks passed"
else
    echo "   ⚠️  System health check completed with warnings"
fi
echo ""

# Test 4: Extension Registry
echo "📋 Test 4: Extension Registry"
if [ -f "f0/extensions/registry.json" ]; then
    EXT_COUNT=$(jq '.extensions | length' f0/extensions/registry.json)
    echo "   ✅ Registry exists with $EXT_COUNT extensions"
else
    echo "   ⚠️  Registry not found (run: pnpm tsx scripts/generate-registry.ts)"
fi
echo ""

# Test 5: Environment Check
echo "🔐 Test 5: Environment Configuration"
ENV_ERRORS=0

if [ ! -f ".env.local" ]; then
    echo "   ⚠️  .env.local not found"
    ENV_ERRORS=$((ENV_ERRORS + 1))
fi

if [ ! -f ".env.production" ]; then
    echo "   ⚠️  .env.production not found"
    ENV_ERRORS=$((ENV_ERRORS + 1))
fi

if [ $ENV_ERRORS -eq 0 ]; then
    echo "   ✅ Environment files configured"
else
    echo "   ⚠️  $ENV_ERRORS environment file(s) missing"
fi
echo ""

# Test 6: Firebase Config
echo "🔥 Test 6: Firebase Configuration"
if [ -f ".firebaserc" ] && [ -f "firebase.json" ]; then
    echo "   ✅ Firebase configuration files present"
else
    echo "   ⚠️  Firebase configuration incomplete"
fi
echo ""

# Test 7: CI/CD Pipeline
echo "⚙️  Test 7: CI/CD Configuration"
if [ -f ".github/workflows/f0-ci.yml" ]; then
    echo "   ✅ GitHub Actions workflow configured"
else
    echo "   ⚠️  CI/CD workflow not found"
fi
echo ""

# Summary
echo "=========================================="
echo "✅ Smoke tests completed!"
echo ""
echo "Next steps:"
echo "  1. Review warnings above (if any)"
echo "  2. Start app: npm run dev"
echo "  3. Visit: http://localhost:3000/admin/diagnostics"
echo "  4. Deploy: firebase deploy"
echo ""
