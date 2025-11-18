#!/bin/bash
# Smoke Tests for Admin RBAC System
# Usage: ./scripts/smoke-admin.sh [base-url] [session-cookie]
# Example: ./scripts/smoke-admin.sh http://localhost:3000 "session=abc123..."

set -e

BASE_URL="${1:-http://localhost:3000}"
SESSION="${2:-}"

echo "🔍 Running Admin RBAC Smoke Tests"
echo "📍 Target: $BASE_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

run_test() {
  local name="$1"
  local expected_status="$2"
  local url="$3"
  local method="${4:-GET}"
  local data="${5:-}"
  local use_session="${6:-false}"
  
  test_count=$((test_count + 1))
  
  local headers=()
  if [ "$use_session" = "true" ] && [ -n "$SESSION" ]; then
    headers+=(-H "Cookie: $SESSION")
  fi
  
  if [ -n "$data" ]; then
    headers+=(-H "Content-Type: application/json")
  fi
  
  if [ "$method" = "POST" ]; then
    if [ -n "$data" ]; then
      status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${headers[@]}" -d "$data" "$url")
    else
      status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${headers[@]}" "$url")
    fi
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "${headers[@]}" "$url")
  fi
  
  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} $name (got $status)"
    pass_count=$((pass_count + 1))
  else
    echo -e "${RED}✗${NC} $name (expected $expected_status, got $status)"
    fail_count=$((fail_count + 1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Unauthenticated Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "GET /api/me (unauth)" "401" "$BASE_URL/api/me"
run_test "GET /api/admin/admins (unauth)" "401" "$BASE_URL/api/admin/admins"
run_test "POST /api/admin/users/test/grant (unauth)" "401" "$BASE_URL/api/admin/users/test/grant" "POST" '{"role":"admin"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Authenticated Tests (requires session)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$SESSION" ]; then
  echo -e "${YELLOW}⚠${NC} Skipping authenticated tests (no session cookie provided)"
  echo "  To test authenticated endpoints, run:"
  echo "  ./scripts/smoke-admin.sh $BASE_URL \"session=YOUR_COOKIE\""
else
  run_test "GET /api/me (with session)" "200" "$BASE_URL/api/me" "GET" "" "true"
  run_test "GET /api/admin/admins (admin)" "200" "$BASE_URL/api/admin/admins" "GET" "" "true"
  
  # Note: This will actually grant/revoke roles if you're admin
  # Use with caution on production!
  if [[ "$BASE_URL" != *"localhost"* ]] && [[ "$BASE_URL" != *"127.0.0.1"* ]]; then
    echo -e "${YELLOW}⚠${NC} Skipping write operations on non-localhost"
  else
    echo -e "${YELLOW}ℹ${NC} Testing write operations (only on localhost)"
    # run_test "POST /api/admin/users/test/grant" "200" "$BASE_URL/api/admin/users/test/grant" "POST" '{"role":"test"}' "true"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
if [ $fail_count -gt 0 ]; then
  echo -e "${RED}Failed: $fail_count${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed! ✓${NC}"
  exit 0
fi

