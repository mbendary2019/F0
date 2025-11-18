#!/bin/bash
# E2E Smoke Tests for Phase 28R
# Tests Web + Desktop + Mobile

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Phase 28R - E2E Smoke Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASSED=0
FAILED=0

pass() {
    echo "✅ PASS: $1"
    ((PASSED++))
}

fail() {
    echo "❌ FAIL: $1"
    ((FAILED++))
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 1: Web (Next.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Test 1: Web (Next.js)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start Next.js dev server in background
echo "Starting Next.js dev server..."
pnpm dev:web > /tmp/nextjs.log 2>&1 &
NEXT_PID=$!

# Wait for server to be ready
sleep 10

# Test homepage
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    pass "Web: Homepage accessible"
else
    fail "Web: Homepage not accessible"
fi

# Test /desktop page
if curl -f http://localhost:3000/desktop > /dev/null 2>&1; then
    pass "Web: /desktop page accessible"
else
    fail "Web: /desktop page not accessible"
fi

# Test /admin/policies page
if curl -f http://localhost:3000/admin/policies > /dev/null 2>&1; then
    pass "Web: /admin/policies page accessible"
else
    fail "Web: /admin/policies page not accessible"
fi

# Kill Next.js
kill $NEXT_PID 2>/dev/null || true

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 2: Desktop (Electron)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  Test 2: Desktop (Electron)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build desktop app
echo "Building desktop app..."
if pnpm build:desktop > /tmp/electron-build.log 2>&1; then
    pass "Desktop: Build successful"
else
    fail "Desktop: Build failed"
fi

# Check artifacts
if [ -f "apps/desktop/dist/main.cjs" ]; then
    pass "Desktop: main.cjs exists"
else
    fail "Desktop: main.cjs missing"
fi

if [ -f "apps/desktop/dist/preload.cjs" ]; then
    pass "Desktop: preload.cjs exists"
else
    fail "Desktop: preload.cjs missing"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 3: Mobile (Flutter)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Test 3: Mobile (Flutter)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Flutter installation
if command -v flutter &> /dev/null; then
    pass "Mobile: Flutter installed"
    
    # Get dependencies
    echo "Getting Flutter dependencies..."
    cd apps/mobile
    if flutter pub get > /tmp/flutter-pub.log 2>&1; then
        pass "Mobile: Dependencies installed"
    else
        fail "Mobile: Dependencies failed"
    fi
    
    # Analyze
    if flutter analyze > /tmp/flutter-analyze.log 2>&1; then
        pass "Mobile: Code analysis passed"
    else
        fail "Mobile: Code analysis failed"
    fi
    
    cd ../..
else
    fail "Mobile: Flutter not installed"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 4: SDK Integration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Test 4: SDK Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build SDK
if pnpm --filter @f0/sdk build > /tmp/sdk-build.log 2>&1; then
    pass "SDK: Build successful"
else
    fail "SDK: Build failed"
fi

# Check SDK artifacts
if [ -f "packages/sdk/dist/index.js" ]; then
    pass "SDK: index.js exists"
else
    fail "SDK: index.js missing"
fi

if [ -f "packages/sdk/dist/index.d.ts" ]; then
    pass "SDK: TypeScript definitions exist"
else
    fail "SDK: TypeScript definitions missing"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""
TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$(awk "BEGIN {printf \"%.0f\", ($PASSED/$TOTAL)*100}")
echo "Success Rate: $SUCCESS_RATE% ($PASSED/$TOTAL)"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎊 ALL TESTS PASSED! Phase 28R.1 ready for deployment!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  SOME TESTS FAILED! Fix issues before deployment."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi


