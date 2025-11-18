#!/usr/bin/env bash
set -euo pipefail

BASE="https://cashoutswap.app"
echo "==========================================="
echo "🧪 Smoke Tests - Production Environment"
echo "Base URL: $BASE"
echo "Time: $(date)"
echo "==========================================="
echo ""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function pass() {
  echo -e "${GREEN}✓${NC} $1"
}

function fail() {
  echo -e "${RED}✗${NC} $1"
}

function warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# 1) Health Check (optional)
echo "== 1. Health Check =="
if curl -sS -f "$BASE/api/health" > /dev/null 2>&1; then
  pass "Health endpoint responding"
else
  warn "Health endpoint not found (skipping)"
fi
echo ""

# 2) API Keys: Create → List → Revoke
echo "== 2. API Keys Management =="
echo "Creating new API key..."
CREATE=$(curl -sS -X POST "$BASE/api/devportal/keys" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Key","scopes":["read","write"]}' || echo '{"error":"failed"}')

echo "$CREATE" | jq '.' 2>/dev/null || echo "$CREATE"

KEY_ID=$(echo "$CREATE" | jq -r '.id // .doc.id // .doc?.id // empty' 2>/dev/null || echo "")
API_KEY=$(echo "$CREATE" | jq -r '.apiKey // empty' 2>/dev/null || echo "")

if [[ -n "$API_KEY" && "$API_KEY" != "null" ]]; then
  pass "API Key created: ${API_KEY:0:20}..."
else
  fail "Failed to create API key"
fi

echo ""
echo "Listing API keys..."
LIST=$(curl -sS "$BASE/api/devportal/keys" || echo '[]')
KEY_COUNT=$(echo "$LIST" | jq 'length' 2>/dev/null || echo "0")
if [[ "$KEY_COUNT" -gt 0 ]]; then
  pass "Found $KEY_COUNT API key(s)"
else
  warn "No API keys found"
fi
echo ""

# 3) Billing Portal
echo "== 3. Billing Portal =="
PORTAL=$(curl -sS -X POST "$BASE/api/billing/portal" || echo '{"error":"failed"}')
PORTAL_URL=$(echo "$PORTAL" | jq -r '.url // empty' 2>/dev/null || echo "")

if [[ -n "$PORTAL_URL" && "$PORTAL_URL" != "null" ]]; then
  pass "Billing portal URL generated"
  echo "   URL: $PORTAL_URL"
else
  fail "Failed to generate billing portal URL"
fi
echo ""

# 4) Test Webhook
echo "== 4. Webhook Test =="
WEBHOOK=$(curl -sS -X POST "$BASE/api/webhooks/test" \
  -H "Content-Type: application/json" \
  -d '{"event":"test.smoke","payload":{"timestamp":"'$(date -u +%s)'"}}' || echo '{"error":"failed"}')

echo "$WEBHOOK" | jq '.' 2>/dev/null || echo "$WEBHOOK"

WEBHOOK_OK=$(echo "$WEBHOOK" | jq -r '.ok // false' 2>/dev/null || echo "false")
if [[ "$WEBHOOK_OK" == "true" ]]; then
  pass "Test webhook sent successfully"
else
  fail "Test webhook failed"
fi
echo ""

# 5) Public API - GET Events
echo "== 5. Public API - GET /api/v1/events =="
EVENTS_GET=$(curl -sS "$BASE/api/v1/events?limit=3" || echo '[]')
EVENT_COUNT=$(echo "$EVENTS_GET" | jq 'length' 2>/dev/null || echo "0")

if [[ "$EVENT_COUNT" -gt 0 ]]; then
  pass "GET /api/v1/events returned $EVENT_COUNT events"
else
  warn "GET /api/v1/events returned empty array"
fi
echo ""

# 6) Public API - POST Event (with Gate Check)
echo "== 6. Public API - POST /api/v1/events (Gate Check) =="
EVENT_POST=$(curl -sS -X POST "$BASE/api/v1/events" \
  -H "Content-Type: application/json" \
  -d '{"uid":"demo","type":"smoke.test","data":{"timestamp":"'$(date -u +%s)'"}}' || echo '{"error":"failed"}')

echo "$EVENT_POST" | jq '.' 2>/dev/null || echo "$EVENT_POST"

POST_OK=$(echo "$EVENT_POST" | jq -r '.ok // false' 2>/dev/null || echo "false")
POST_CODE=$(echo "$EVENT_POST" | jq -r '.code // ""' 2>/dev/null || echo "")

if [[ "$POST_OK" == "true" ]]; then
  pass "POST /api/v1/events succeeded (gate allowed)"
elif [[ "$POST_CODE" == "quota_exceeded" ]]; then
  warn "POST blocked by quota (expected for demo user)"
elif [[ "$POST_CODE" == "subscription_inactive" ]]; then
  warn "POST blocked by subscription status"
else
  fail "POST /api/v1/events failed unexpectedly"
fi
echo ""

# 7) Billing UI Page
echo "== 7. Billing UI Page =="
BILLING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/developers/billing")

if [[ "$BILLING_STATUS" == "200" ]]; then
  pass "Billing UI page accessible (HTTP $BILLING_STATUS)"
elif [[ "$BILLING_STATUS" == "302" || "$BILLING_STATUS" == "301" ]]; then
  warn "Billing UI redirecting (HTTP $BILLING_STATUS)"
else
  fail "Billing UI not accessible (HTTP $BILLING_STATUS)"
fi
echo ""

# 8) Subscription Data
echo "== 8. Subscription API =="
SUB=$(curl -sS "$BASE/api/devportal/subscription" || echo '{"error":"failed"}')
SUB_PLAN=$(echo "$SUB" | jq -r '.plan // "unknown"' 2>/dev/null || echo "unknown")

if [[ "$SUB_PLAN" != "unknown" && "$SUB_PLAN" != "null" ]]; then
  pass "Subscription API returned plan: $SUB_PLAN"
else
  fail "Failed to fetch subscription data"
fi
echo ""

# 9) Usage Month Data
echo "== 9. Usage Month API =="
USAGE=$(curl -sS "$BASE/api/devportal/usage-month" || echo '{"error":"failed"}')
USED=$(echo "$USAGE" | jq -r '.used // 0' 2>/dev/null || echo "0")
QUOTA=$(echo "$USAGE" | jq -r '.quota // 0' 2>/dev/null || echo "0")

if [[ "$QUOTA" -gt 0 ]]; then
  pass "Usage API returned: $USED / $QUOTA requests"
else
  fail "Failed to fetch usage data"
fi
echo ""

# Summary
echo "==========================================="
echo "📊 Smoke Test Summary"
echo "==========================================="
echo "Completed at: $(date)"
echo ""
echo "Next steps:"
echo "1. Check Firebase Functions logs: firebase functions:log --limit 50"
echo "2. Monitor error rates in Firebase Console"
echo "3. Verify Firestore collections populated correctly"
echo "4. Check Stripe webhook delivery logs"
echo ""
echo "For detailed monitoring, visit:"
echo "- Firebase: https://console.firebase.google.com/project/cashout-swap/functions/list"
echo "- Stripe: https://dashboard.stripe.com/webhooks"
echo ""
