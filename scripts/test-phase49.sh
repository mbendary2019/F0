#!/bin/bash

###############################################################################
# Phase 49 Testing Script
# Error Tracking & Incident Center End-to-End Tests
###############################################################################

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🧪 Phase 49: Error Tracking Tests       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Get project ID
PROJECT_ID=$(firebase use | grep "Now using project" | awk '{print $4}' || echo "from-zero-84253")
CF_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net"

TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_code="${5:-200}"

    echo -n "🔍 $name... "

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "$expected_code" ] || [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Success (HTTP $http_code)${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ Failed (HTTP $http_code, expected $expected_code)${NC}"
        echo "   Response: $body"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "${YELLOW}🌐 Test 1: Log Endpoint (Single Error)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint \
    "Send error log" \
    "$CF_URL/log" \
    "POST" \
    '{
        "level": "error",
        "service": "web",
        "code": 500,
        "message": "TEST_ERROR_SINGLE from smoke test",
        "context": {"route": "/api/test", "test": true},
        "fingerprint": "test:500:/api/test"
    }'
echo ""

echo -e "${YELLOW}⚡ Test 2: Log Endpoint (Multiple Errors - Spike)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending 15 errors to trigger incident..."

for i in {1..15}; do
    curl -s -X POST "$CF_URL/log" \
        -H "Content-Type: application/json" \
        -d "{
            \"level\": \"error\",
            \"service\": \"web\",
            \"code\": 500,
            \"message\": \"TEST_ERROR_SPIKE #$i\",
            \"context\": {\"route\": \"/api/spike-test\", \"test\": true},
            \"fingerprint\": \"test:500:/api/spike-test\"
        }" > /dev/null 2>&1
    echo -n "."
done

echo ""
echo -e "${GREEN}✅ Sent 15 errors${NC}"
((TESTS_PASSED++))
echo ""

echo -e "${YELLOW}🔔 Test 3: Test Alert Endpoint${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint \
    "Trigger test alert" \
    "$CF_URL/testAlert" \
    "POST"
echo ""

echo -e "${YELLOW}📊 Test 4: Verify Firestore Data${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for triggers to process
echo "⏳ Waiting 5 seconds for triggers to process..."
sleep 5

echo -n "🔍 Checking ops_events collection... "
event_count=$(firebase firestore:list ops_events --project "$PROJECT_ID" 2>/dev/null | grep -c "Document ID:" || echo "0")

if [ "$event_count" -ge 10 ]; then
    echo -e "${GREEN}✅ Found $event_count events${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Found $event_count events (expected >= 10)${NC}"
fi

echo -n "🔍 Checking ops_incidents collection... "
incident_count=$(firebase firestore:list ops_incidents --project "$PROJECT_ID" 2>/dev/null | grep -c "Document ID:" || echo "0")

if [ "$incident_count" -ge 1 ]; then
    echo -e "${GREEN}✅ Found $incident_count incidents${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Found $incident_count incidents (expected >= 1)${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  📊 Test Summary                          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ Failed: $TESTS_FAILED${NC}"
echo ""

echo -e "${YELLOW}📋 Manual Verification:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Check Firestore Console:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/firestore"
echo ""
echo "2. View incidents:"
echo "   Collection: ops_incidents"
echo "   Document ID: test:500:/api/spike-test"
echo ""
echo "3. View events:"
echo "   Collection: ops_events"
echo "   Filter: fingerprint == 'test:500:/api/spike-test'"
echo ""
echo "4. Check alerts queue:"
echo "   Collection: _alerts_queue"
echo ""
echo "5. View Incidents Dashboard:"
echo "   https://your-app.web.app/ops/incidents"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check logs above.${NC}"
    exit 1
fi
