#!/usr/bin/env bash
# Phase 56 Day 2 - Run All Search Tests
set -euo pipefail

echo "🧪 Phase 56 - Semantic Search Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
  local test_name="$1"
  local test_command="$2"

  echo -e "${YELLOW}Running: ${test_name}${NC}"

  if eval "$test_command"; then
    echo -e "${GREEN}✅ PASS: ${test_name}${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}❌ FAIL: ${test_name}${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  echo ""
}

# 1. Unit Tests
echo "1️⃣ Running Unit Tests..."
echo "─────────────────────────"
run_test "Embedding Tools Unit Tests" "cd functions && pnpm test src/collab/embeddingTools.test.ts --silent"

# 2. TypeScript Build
echo "2️⃣ Running TypeScript Build..."
echo "──────────────────────────────"
run_test "Functions TypeScript Build" "cd functions && pnpm build 2>&1 | grep -q 'searchMemories' && echo 'searchMemories built successfully' || (cd functions && pnpm build 2>&1 | grep -E 'error TS' | wc -l | grep -q '^0$')"

# 3. Check if dev server is running
echo "3️⃣ Checking Dev Server..."
echo "─────────────────────────"
if curl -s http://localhost:3030 > /dev/null; then
  echo -e "${GREEN}✅ Dev server is running on http://localhost:3030${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${YELLOW}⚠️  Dev server not running. Start with: PORT=3030 pnpm dev${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# 4. Check deployment status
echo "4️⃣ Checking Deployment Status..."
echo "─────────────────────────────────"
if command -v firebase &> /dev/null; then
  if firebase functions:list 2>/dev/null | grep -q searchMemories; then
    echo -e "${GREEN}✅ searchMemories function is deployed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))

    # Show function details
    echo ""
    echo "Function details:"
    firebase functions:list | grep searchMemories || true
  else
    echo -e "${YELLOW}⚠️  searchMemories not deployed. Run: ./scripts/deploy-search.sh${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠️  Firebase CLI not installed${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# 5. Check recent logs for errors
echo "5️⃣ Checking Recent Logs..."
echo "─────────────────────────"
if command -v firebase &> /dev/null; then
  ERROR_COUNT=$(firebase functions:log --only searchMemories --limit 50 2>/dev/null | grep -c '"severity":"ERROR"' || echo "0")

  if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ No errors in recent logs${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}❌ Found $ERROR_COUNT errors in recent logs${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo ""
    echo "Recent errors:"
    firebase functions:log --only searchMemories --limit 10 --filter error || true
  fi
else
  echo -e "${YELLOW}⚠️  Skipped (Firebase CLI not available)${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Run UI smoke tests: http://localhost:3030/en/ops/memory"
  echo "  2. Run browser console tests (see PHASE_56_TESTING_GUIDE.md)"
  echo "  3. Run load tests: k6 run k6/searchMemories.js"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please review and fix.${NC}"
  echo ""
  echo "For detailed testing guide, see: PHASE_56_TESTING_GUIDE.md"
  echo ""
  exit 1
fi
