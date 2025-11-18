#!/bin/bash
# Phase 36 → 37 Transition: 24h Data Collection Monitor
# Collects ops_stats data needed for Confidence Model training

set -e

PROJECT_ID=${FIREBASE_PROJECT_ID:-"from-zero-84253"}
OUTPUT_DIR="./data/ops_stats_24h"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=================================================="
echo "Phase 36→37: 24h Data Collection Monitor"
echo "=================================================="
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}📊 Checking ops_stats collection...${NC}"
echo ""

# Function to query Firestore
query_stats() {
    local window=$1
    echo -e "${YELLOW}Querying ${window} window...${NC}"

    firebase firestore:query ops_stats \
        --where "window" "==" "$window" \
        --project "$PROJECT_ID" \
        2>/dev/null > "${OUTPUT_DIR}/stats_${window}_${TIMESTAMP}.json" || {
        echo -e "${RED}  ⚠️  Failed to query ${window}${NC}"
        return 1
    }

    local count=$(cat "${OUTPUT_DIR}/stats_${window}_${TIMESTAMP}.json" | grep -c '"component"' || echo "0")
    echo -e "${GREEN}  ✓ Found ${count} components${NC}"
    return 0
}

# Query all windows
query_stats "1h"
query_stats "24h"
query_stats "7d"

echo ""
echo -e "${BLUE}📈 Analyzing data coverage...${NC}"
echo ""

# Count total observations
OBS_COUNT=$(firebase firestore:query ops_observations \
    --limit 1000 \
    --project "$PROJECT_ID" 2>/dev/null | grep -c '"id"' || echo "0")

# Count rewards
REWARD_COUNT=$(firebase firestore:query ops_rewards \
    --limit 1000 \
    --project "$PROJECT_ID" 2>/dev/null | grep -c '"obsId"' || echo "0")

# Count policies
POLICY_COUNT=$(firebase firestore:query ops_policies \
    --project "$PROJECT_ID" 2>/dev/null | grep -c '"id"' || echo "0")

echo "Observations:  $OBS_COUNT"
echo "Rewards:       $REWARD_COUNT"
echo "Policies:      $POLICY_COUNT"
echo ""

# Check if we have enough data for confidence model
MIN_OBS=100
MIN_COMPONENTS=3

if [ "$OBS_COUNT" -lt "$MIN_OBS" ]; then
    echo -e "${RED}⚠️  Insufficient observations (${OBS_COUNT}/${MIN_OBS} minimum)${NC}"
    echo -e "${YELLOW}   Run simulation: pnpm tsx scripts/simulateObservations.ts${NC}"
    READY=false
else
    echo -e "${GREEN}✅ Sufficient observations (${OBS_COUNT} ≥ ${MIN_OBS})${NC}"
    READY=true
fi

# Get component count from 24h window
COMPONENT_COUNT=$(cat "${OUTPUT_DIR}/stats_24h_${TIMESTAMP}.json" 2>/dev/null | grep -c '"component"' || echo "0")

if [ "$COMPONENT_COUNT" -lt "$MIN_COMPONENTS" ]; then
    echo -e "${RED}⚠️  Insufficient components (${COMPONENT_COUNT}/${MIN_COMPONENTS} minimum)${NC}"
    READY=false
else
    echo -e "${GREEN}✅ Sufficient components (${COMPONENT_COUNT} ≥ ${MIN_COMPONENTS})${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Readiness Assessment:${NC}"
echo ""

if [ "$READY" = true ]; then
    echo -e "${GREEN}✅ Phase 36 data collection COMPLETE${NC}"
    echo -e "${GREEN}✅ Ready for Phase 37 Confidence Model training${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Review collected data in: $OUTPUT_DIR"
    echo "  2. Verify adaptive flags: cat functions/src/config/flags.ts"
    echo "  3. Deploy confidence model functions"
    echo "  4. Begin Phase 37 implementation"
else
    echo -e "${YELLOW}⏳ Data collection in progress...${NC}"
    echo -e "${YELLOW}   Current progress: ${OBS_COUNT}/${MIN_OBS} observations${NC}"
    echo ""
    echo -e "${BLUE}Actions Required:${NC}"
    echo "  1. Wait for more observations to accumulate"
    echo "  2. Or run: pnpm tsx scripts/simulateObservations.ts"
    echo "  3. Re-run this script to check progress"
fi

echo ""
echo "=================================================="
echo -e "${BLUE}📁 Data Export Summary${NC}"
echo "=================================================="
echo ""
echo "Location: $OUTPUT_DIR"
echo "Files created:"
ls -lh "$OUTPUT_DIR" | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
echo ""
echo -e "${GREEN}Collection timestamp: ${TIMESTAMP}${NC}"
echo ""

# Create summary report
cat > "${OUTPUT_DIR}/summary_${TIMESTAMP}.txt" <<EOF
Phase 36 → 37 Data Collection Summary
Generated: $(date)
Project: $PROJECT_ID

Data Counts:
- Observations: $OBS_COUNT
- Rewards: $REWARD_COUNT
- Policies: $POLICY_COUNT
- Components (24h): $COMPONENT_COUNT

Readiness Status:
- Minimum Observations: $([ "$OBS_COUNT" -ge "$MIN_OBS" ] && echo "✅ PASS" || echo "❌ FAIL ($OBS_COUNT/$MIN_OBS)")
- Minimum Components: $([ "$COMPONENT_COUNT" -ge "$MIN_COMPONENTS" ] && echo "✅ PASS" || echo "❌ FAIL ($COMPONENT_COUNT/$MIN_COMPONENTS)")

Overall Status: $([ "$READY" = true ] && echo "READY FOR PHASE 37" || echo "DATA COLLECTION IN PROGRESS")

Files:
- stats_1h_${TIMESTAMP}.json
- stats_24h_${TIMESTAMP}.json
- stats_7d_${TIMESTAMP}.json
- summary_${TIMESTAMP}.txt

Next Action:
$(if [ "$READY" = true ]; then
    echo "Proceed with Phase 37 Confidence Model implementation"
else
    echo "Continue data collection until minimum thresholds are met"
fi)
EOF

echo -e "${GREEN}✓ Summary report saved: ${OUTPUT_DIR}/summary_${TIMESTAMP}.txt${NC}"
echo ""
