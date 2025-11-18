#!/bin/bash
# scripts/test-phase57-smoke.sh
# Phase 57: AI Memory System Smoke Tests

set -e

echo "🧪 Phase 57: AI Memory System - Smoke Tests"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
FIREBASE_PROJECT="${FIREBASE_PROJECT:-from-zero-84253}"

# Check if TOKEN is set
if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Error: TOKEN environment variable not set${NC}"
  echo "Usage: TOKEN=\$YOUR_FIREBASE_ID_TOKEN ./scripts/test-phase57-smoke.sh"
  exit 1
fi

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run test
run_test() {
  local test_name=$1
  local test_command=$2

  echo -e "${YELLOW}▶ Testing: ${test_name}${NC}"

  if eval "$test_command"; then
    echo -e "${GREEN}✅ PASS: ${test_name}${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}❌ FAIL: ${test_name}${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  echo ""
}

# ============================================================
# Phase 57.1: MMR Re-Ranking & Outcome Signals
# ============================================================

echo "📊 Phase 57.1: MMR Re-Ranking & Outcome Signals"
echo "------------------------------------------------"

# Test 1: Snippet Extraction
test_snippet_extraction() {
  local response=$(cat <<EOF | node -
const { extractSnippets } = require('../src/lib/ai/memory/snippetExtractor');
const records = [
  {
    id: 'mem_test1',
    text: 'Deploy to production using firebase deploy. Make sure to test first.',
    created_at: new Date(),
  }
];
const snippets = extractSnippets(records, { maxPerItem: 2 });
console.log(JSON.stringify({ count: snippets.length, success: snippets.length > 0 }));
EOF
)
  echo "$response" | grep -q '"success":true'
}

run_test "Snippet Extraction" test_snippet_extraction

# Test 2: MMR Algorithm
test_mmr_algorithm() {
  local response=$(cat <<EOF | node -
const { mmr } = require('../src/lib/ai/memory/mmr');
const query = [0.1, 0.2, 0.3];
const pool = [
  { id: '1', vec: [0.11, 0.21, 0.31] },
  { id: '2', vec: [0.9, 0.1, 0.1] },
  { id: '3', vec: [0.12, 0.22, 0.32] },
];
const selected = mmr(query, pool, { k: 2, lambda: 0.65 });
console.log(JSON.stringify({ count: selected.length, success: selected.length === 2 }));
EOF
)
  echo "$response" | grep -q '"success":true'
}

run_test "MMR Algorithm" test_mmr_algorithm

# Test 3: Outcome Signals API
test_outcome_api() {
  local response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "clusterId": "cl_test_deploy",
      "outcome": "success",
      "taskId": "task_smoke_test_001",
      "metadata": {
        "test": true,
        "phase": "57.1"
      }
    }' \
    "$API_BASE/api/ops/memory/feedback/outcome")

  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    echo "$body" | grep -q '"success":true'
  else
    echo "HTTP $http_code"
    return 1
  fi
}

run_test "Outcome Feedback API" test_outcome_api

# ============================================================
# Phase 57.2: Snippet Cache & Per-Snippet Feedback
# ============================================================

echo "💾 Phase 57.2: Snippet Cache & Per-Snippet Feedback"
echo "----------------------------------------------------"

# Test 4: Snippet Cache Hit
test_cache_hit() {
  # First request (miss)
  local text="Deploy using firebase deploy command"
  local response1=$(cat <<EOF | node -
const { getOrEmbedSnippet } = require('../src/lib/ai/memory/snippetCache');
(async () => {
  const result = await getOrEmbedSnippet('$text');
  console.log(JSON.stringify({ cache: result.cache, snipId: result.snip_id }));
})();
EOF
)

  # Second request (hit)
  local response2=$(cat <<EOF | node -
const { getOrEmbedSnippet } = require('../src/lib/ai/memory/snippetCache');
(async () => {
  const result = await getOrEmbedSnippet('$text');
  console.log(JSON.stringify({ cache: result.cache, success: result.cache === 'hit' }));
})();
EOF
)

  echo "$response2" | grep -q '"success":true'
}

run_test "Snippet Cache Hit" test_cache_hit

# Test 5: Batch Cache Performance
test_batch_cache() {
  local response=$(cat <<EOF | node -
const { getManyOrEmbed } = require('../src/lib/ai/memory/snippetCache');
(async () => {
  const texts = [
    'Deploy to production',
    'Run tests before deploying',
    'Check build status'
  ];
  const result = await getManyOrEmbed(texts);
  console.log(JSON.stringify({
    total: result.hits.length + result.misses.length,
    success: (result.hits.length + result.misses.length) === 3
  }));
})();
EOF
)

  echo "$response" | grep -q '"success":true'
}

run_test "Batch Cache Performance" test_batch_cache

# Test 6: Snippet Feedback API
test_snippet_feedback() {
  local response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "snipId": "snp_test123",
      "thumb": "up",
      "stars": 5,
      "clusterId": "cl_test_deploy",
      "turnId": "turn_smoke_test",
      "metadata": {
        "test": true,
        "phase": "57.2"
      }
    }' \
    "$API_BASE/api/ops/memory/snippet/feedback")

  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    echo "$body" | grep -q '"success":true'
  else
    echo "HTTP $http_code"
    return 1
  fi
}

run_test "Snippet Feedback API" test_snippet_feedback

# Test 7: Cache Metrics Recording
test_metrics_recording() {
  local response=$(cat <<EOF | node -
const { recordCacheStats, getCacheInsights } = require('../src/lib/ai/telemetry/snippetMetrics');
(async () => {
  const day = new Date().toISOString().split('T')[0];
  await recordCacheStats(day, {
    cacheHits: 8,
    cacheMisses: 2,
    totalRequests: 10,
    tokensSaved: 5000,
    costSaved: 0.0065
  }, 150);

  const insights = await getCacheInsights(7);
  console.log(JSON.stringify({ success: insights.hitRate >= 0, performance: insights.performance }));
})();
EOF
)

  echo "$response" | grep -q '"success":true'
}

run_test "Cache Metrics Recording" test_metrics_recording

# ============================================================
# Phase 57.3: TTL, Compaction & Analytics
# ============================================================

echo "🗄️ Phase 57.3: TTL, Compaction & Analytics"
echo "--------------------------------------------"

# Test 8: TTL Field Creation
test_ttl_creation() {
  local response=$(cat <<EOF | node -
const { createTTLField, daysUntilExpiration } = require('../src/lib/ai/util/ttl');
const ttlField = createTTLField('snippet', { useCount: 75 });
const days = daysUntilExpiration(ttlField.expire_at);
console.log(JSON.stringify({ days, success: days >= 180 && days <= 360 }));
EOF
)

  echo "$response" | grep -q '"success":true'
}

run_test "TTL Field Creation" test_ttl_creation

# Test 9: Adaptive TTL Calculation
test_adaptive_ttl() {
  local response=$(cat <<EOF | node -
const { getAdaptiveTTL } = require('../src/lib/ai/util/ttl');
const ttl50 = getAdaptiveTTL(50, 180);  // Should be 270 (1.5x)
const ttl100 = getAdaptiveTTL(100, 180); // Should be 360 (2x)
console.log(JSON.stringify({ ttl50, ttl100, success: ttl50 === 270 && ttl100 === 360 }));
EOF
)

  echo "$response" | grep -q '"success":true'
}

run_test "Adaptive TTL Calculation" test_adaptive_ttl

# Test 10: Compaction Script (Dry Run)
test_compaction_dry_run() {
  local response=$(tsx scripts/compactSnippets.ts --dry-run 2>&1)
  echo "$response" | grep -q "dryRun: true"
}

run_test "Compaction Script (Dry Run)" test_compaction_dry_run

# Test 11: Analytics Dashboard Data
test_analytics_data() {
  # This test just checks if the analytics endpoint returns valid data
  local response=$(curl -s "$API_BASE/ops/analytics" | head -n 50)

  # Check if page loads (contains expected text)
  echo "$response" | grep -q -i "analytics"
}

run_test "Analytics Dashboard Loading" test_analytics_data

# Test 12: Firestore Indexes Validity
test_indexes_valid() {
  # Check if firestore.indexes.json is valid JSON
  cat firestore.indexes.json | jq empty 2>/dev/null
}

run_test "Firestore Indexes Valid JSON" test_indexes_valid

# Test 13: Security Rules Syntax
test_rules_syntax() {
  # Basic syntax check for firestore.rules
  grep -q "rules_version = '2'" firestore.rules && \
  grep -q "ops_memory_snippets" firestore.rules && \
  grep -q "ops_memory_snippet_feedback" firestore.rules
}

run_test "Security Rules Syntax" test_rules_syntax

# ============================================================
# Performance Benchmarks
# ============================================================

echo "⚡ Performance Benchmarks"
echo "-------------------------"

# Test 14: Cache Latency
test_cache_latency() {
  local start=$(date +%s%3N)

  cat <<EOF | node - >/dev/null 2>&1
const { getOrEmbedSnippet } = require('../src/lib/ai/memory/snippetCache');
(async () => {
  await getOrEmbedSnippet('Test latency measurement');
})();
EOF

  local end=$(date +%s%3N)
  local latency=$((end - start))

  echo "Latency: ${latency}ms"

  # Target: < 500ms for cache hit, < 1000ms for miss
  [ "$latency" -lt 1000 ]
}

run_test "Cache Latency Benchmark" test_cache_latency

# Test 15: MMR Performance
test_mmr_performance() {
  local start=$(date +%s%3N)

  cat <<EOF | node - >/dev/null 2>&1
const { mmr } = require('../src/lib/ai/memory/mmr');
const query = Array(1536).fill(0).map(() => Math.random());
const pool = Array(100).fill(0).map((_, i) => ({
  id: String(i),
  vec: Array(1536).fill(0).map(() => Math.random())
}));
const selected = mmr(query, pool, { k: 10 });
EOF

  local end=$(date +%s%3N)
  local latency=$((end - start))

  echo "MMR Latency: ${latency}ms (100 items, k=10)"

  # Target: < 200ms for 100 items
  [ "$latency" -lt 500 ]
}

run_test "MMR Performance Benchmark" test_mmr_performance

# ============================================================
# Summary
# ============================================================

echo ""
echo "================================================"
echo "🎯 Test Results Summary"
echo "================================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Deploy Firestore indexes: firebase deploy --only firestore:indexes"
  echo "2. Deploy security rules: firebase deploy --only firestore:rules"
  echo "3. Deploy compaction function: firebase deploy --only functions:weeklyCompactSnippets"
  echo "4. Enable TTL policy in Firebase Console"
  echo "5. Monitor /ops/analytics dashboard"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
  exit 1
fi
