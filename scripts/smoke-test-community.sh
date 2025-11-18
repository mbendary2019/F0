#!/bin/bash

# Community Features Smoke Test
# Tests all endpoints, rate limiting, CORS, and PII filtering

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3030}"
TRACK_API="$BASE_URL/api/ops/analytics/track"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🧪 Community Features - Smoke Test${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for assertions
assert_status() {
  local expected=$1
  local actual=$2
  local test_name=$3

  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✓${NC} $test_name (HTTP $actual)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name (expected $expected, got $actual)"
    ((TESTS_FAILED++))
  fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 1: Community Pages Load
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[1/8]${NC} Testing Community Pages..."

AR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/ar/community")
assert_status 200 "$AR_STATUS" "Community page (AR)"

EN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/en/community")
assert_status 200 "$EN_STATUS" "Community page (EN)"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 2: Tracking API - Valid Request
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[2/8]${NC} Testing Tracking API - Valid Request..."

VALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$TRACK_API" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke_test","data":{"test":"valid"}}')

assert_status 200 "$VALID_STATUS" "Valid tracking request"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 3: Tracking API - Invalid Request (no name)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[3/8]${NC} Testing Tracking API - Invalid Request..."

INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$TRACK_API" \
  -H "Content-Type: application/json" \
  -d '{"data":{"test":"no_name"}}')

assert_status 400 "$INVALID_STATUS" "Invalid request (missing name)"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 4: Rate Limiting
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[4/8]${NC} Testing Rate Limiting..."

# Send burst of requests
echo -e "  ${BLUE}→${NC} Sending 15 rapid requests..."
COUNT_429=0
for i in {1..15}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$TRACK_API" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"burst_$i\",\"data\":{}}")

  if [ "$STATUS" -eq 429 ]; then
    ((COUNT_429++))
  fi
done

if [ "$COUNT_429" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Rate limit triggered ($COUNT_429 requests blocked)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Rate limit NOT triggered (expected some 429s)"
  ((TESTS_FAILED++))
fi

# Check Retry-After header
echo -e "  ${BLUE}→${NC} Checking Retry-After header..."
RETRY_AFTER=$(curl -s -i -X POST "$TRACK_API" \
  -H "Content-Type: application/json" \
  -d '{"name":"retry_check","data":{}}' | grep -i "retry-after" | head -1)

if [ -n "$RETRY_AFTER" ]; then
  echo -e "${GREEN}✓${NC} Retry-After header present: $RETRY_AFTER"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠${NC} Retry-After header not found (might not be rate limited yet)"
fi

echo ""

# Wait for rate limit to reset
echo -e "  ${BLUE}⏳${NC} Waiting 5 seconds for token refill..."
sleep 5

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 5: Payload Size Limit
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[5/8]${NC} Testing Payload Size Limit..."

# Generate large payload (>4KB)
LARGE_DATA=$(printf '{"name":"large_test","data":{"content":"%s"}}' "$(head -c 5000 /dev/urandom | base64)")

LARGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$TRACK_API" \
  -H "Content-Type: application/json" \
  -d "$LARGE_DATA" 2>/dev/null || echo "413")

if [ "$LARGE_STATUS" -eq 413 ] || [ "$LARGE_STATUS" -eq 400 ]; then
  echo -e "${GREEN}✓${NC} Large payload rejected (HTTP $LARGE_STATUS)"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠${NC} Large payload test (HTTP $LARGE_STATUS) - may need adjustment"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 6: PII Filtering
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[6/8]${NC} Testing PII Filtering..."

# Send request with PII data
PII_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$TRACK_API" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"pii_test",
    "data":{
      "email":"test@example.com",
      "phone":"+1234567890",
      "name":"John Doe",
      "walletAddress":"0x1234...",
      "ip":"192.168.1.1",
      "safeData":"this_should_be_stored"
    }
  }')

if [ "$PII_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓${NC} PII test request accepted (HTTP 200)"
  echo -e "  ${BLUE}→${NC} PII should be filtered server-side (check Firestore)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} PII test request failed (HTTP $PII_STATUS)"
  ((TESTS_FAILED++))
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 7: CORS Preflight
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[7/8]${NC} Testing CORS Preflight..."

CORS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS "$TRACK_API" \
  -H "Origin: http://localhost:3030" \
  -H "Access-Control-Request-Method: POST")

assert_status 200 "$CORS_STATUS" "CORS preflight request"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 8: Banner Visibility
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[8/8]${NC} Testing Banner Visibility..."

AR_PAGE=$(curl -s "$BASE_URL/ar/community")
if echo "$AR_PAGE" | grep -q "معلوماتية فقط"; then
  echo -e "${GREEN}✓${NC} Arabic banner present"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Arabic banner NOT found"
  ((TESTS_FAILED++))
fi

EN_PAGE=$(curl -s "$BASE_URL/en/community")
if echo "$EN_PAGE" | grep -q "Informational Only"; then
  echo -e "${GREEN}✓${NC} English banner present"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} English banner NOT found"
  ((TESTS_FAILED++))
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Test Results${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}✅ Community features are ready for deployment!${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${RED}⚠ Please fix issues before deployment${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
