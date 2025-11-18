#!/bin/bash
# Phase 36 - Self-Learning Orchestrator Deployment Script

set -e

echo "============================================"
echo "Phase 36 - Self-Learning Orchestrator"
echo "Deployment Script"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Firebase project is set
if [ -z "$FIREBASE_PROJECT_ID" ]; then
  echo -e "${YELLOW}Warning: FIREBASE_PROJECT_ID not set. Using default project.${NC}"
fi

PROJECT_ID=${FIREBASE_PROJECT_ID:-$(firebase use 2>&1 | grep "Now using" | awk '{print $NF}' | tr -d '()')}

if [ -z "$PROJECT_ID" ]; then
  # Try alternative method
  PROJECT_ID=$(cat .firebaserc 2>/dev/null | grep '"default"' | cut -d'"' -f4)
fi

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: No Firebase project configured. Run 'firebase use --add' first.${NC}"
  exit 1
fi

echo -e "${GREEN}Using Firebase project: ${PROJECT_ID}${NC}"
echo ""

# Step 1: Install dependencies
echo "============================================"
echo "Step 1: Installing dependencies"
echo "============================================"
cd functions
if ! npm list uuid >/dev/null 2>&1; then
  echo "Installing uuid..."
  npm install uuid
fi
if ! npm list zod >/dev/null 2>&1; then
  echo "Installing zod..."
  npm install zod
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""
cd ..

# Step 2: Deploy Firestore rules
echo "============================================"
echo "Step 2: Deploying Firestore rules"
echo "============================================"
firebase deploy --only firestore:rules --project "$PROJECT_ID"
echo -e "${GREEN}✓ Firestore rules deployed${NC}"
echo ""

# Step 3: Deploy Firestore indexes
echo "============================================"
echo "Step 3: Deploying Firestore indexes"
echo "============================================"
firebase deploy --only firestore:indexes --project "$PROJECT_ID"
echo -e "${GREEN}✓ Firestore indexes deployed${NC}"
echo ""

# Step 4: Seed configuration data
echo "============================================"
echo "Step 4: Seeding configuration data"
echo "============================================"

# Create reward config
echo "Creating config/reward_config..."
cat > /tmp/reward_config.json <<EOF
{
  "version": "1.0.0",
  "weights": {
    "latency": 0.25,
    "cost": 0.2,
    "success": 0.6,
    "error": 0.6
  },
  "bounds": {
    "maxLatencyMs": 4000,
    "maxCostUsd": 0.10
  },
  "thresholds": {
    "minAcceptable": 0.55,
    "retrain": 0.40
  }
}
EOF

firebase firestore:set config/reward_config /tmp/reward_config.json --project "$PROJECT_ID"
echo -e "${GREEN}✓ Reward config created${NC}"

# Create initial router policy
echo "Creating initial policy ops_policies/router-core@1.0.0..."
TIMESTAMP=$(date +%s000)
cat > /tmp/router_policy.json <<EOF
{
  "id": "router-core",
  "version": "1.0.0",
  "status": "active",
  "createdAt": ${TIMESTAMP},
  "createdBy": "system",
  "notes": "Initial router policy for Phase 36",
  "params": {
    "modelWeights": {
      "gpt-5": 0.6,
      "gemini": 0.25,
      "claude": 0.15
    },
    "latencyTargetMs": 2500,
    "maxCostUsd": 0.09,
    "fallbackOn": ["timeout", "rate_limit"],
    "cooldownMs": 30000
  }
}
EOF

firebase firestore:set "ops_policies/router-core@1.0.0" /tmp/router_policy.json --project "$PROJECT_ID"
echo -e "${GREEN}✓ Initial router policy created${NC}"

# Create scaler policy
echo "Creating initial policy ops_policies/scaler-core@1.0.0..."
cat > /tmp/scaler_policy.json <<EOF
{
  "id": "scaler-core",
  "version": "1.0.0",
  "status": "active",
  "createdAt": ${TIMESTAMP},
  "createdBy": "system",
  "notes": "Initial scaler policy for Phase 36",
  "params": {
    "rpsThreshold": 120,
    "p95Threshold": 800,
    "errorRateThreshold": 0.02,
    "concurrencyNormal": 80,
    "concurrencyHigh": 200,
    "cacheTtlNormal": 300,
    "cacheTtlHigh": 120,
    "throttleNormal": 1.0,
    "throttleDegraded": 0.7
  }
}
EOF

firebase firestore:set "ops_policies/scaler-core@1.0.0" /tmp/scaler_policy.json --project "$PROJECT_ID"
echo -e "${GREEN}✓ Initial scaler policy created${NC}"

# Create canary policy
echo "Creating initial policy ops_policies/canary-core@1.0.0..."
cat > /tmp/canary_policy.json <<EOF
{
  "id": "canary-core",
  "version": "1.0.0",
  "status": "active",
  "createdAt": ${TIMESTAMP},
  "createdBy": "system",
  "notes": "Initial canary policy for Phase 36",
  "params": {
    "initialPercent": 10,
    "incrementStep": 15,
    "intervalMinutes": 5,
    "errorRateThreshold": 0.01,
    "p95ThresholdMs": 900,
    "rollbackOnBreach": true
  }
}
EOF

firebase firestore:set "ops_policies/canary-core@1.0.0" /tmp/canary_policy.json --project "$PROJECT_ID"
echo -e "${GREEN}✓ Initial canary policy created${NC}"

echo ""

# Step 5: Deploy Cloud Functions
echo "============================================"
echo "Step 5: Deploying Cloud Functions"
echo "============================================"
firebase deploy --only functions:scoreObservations,functions:autoTunePolicies --project "$PROJECT_ID"
echo -e "${GREEN}✓ Cloud Functions deployed${NC}"
echo ""

# Step 6: Verify deployment
echo "============================================"
echo "Step 6: Verifying deployment"
echo "============================================"

echo "Checking function logs..."
firebase functions:log --only scoreObservations --limit 5 --project "$PROJECT_ID" || true
echo ""

echo "Checking policies..."
firebase firestore:get "ops_policies/router-core@1.0.0" --project "$PROJECT_ID" || echo "Policy query not supported by CLI"
echo ""

echo "Checking stats collection..."
firebase firestore:query ops_stats --project "$PROJECT_ID" || echo "Stats query not supported by CLI"
echo ""

# Cleanup
rm -f /tmp/reward_config.json /tmp/router_policy.json /tmp/scaler_policy.json /tmp/canary_policy.json

echo "============================================"
echo -e "${GREEN}✓ Phase 36 Deployment Complete!${NC}"
echo "============================================"
echo ""
echo "Next Steps:"
echo "1. Monitor function logs: firebase functions:log"
echo "2. View learning dashboard: http://localhost:3000/ops/learning"
echo "3. Manage policies: http://localhost:3000/ops/policies"
echo "4. Integrate recordObservation() calls in your components"
echo ""
echo "Documentation: See PHASE_36_IMPLEMENTATION.md for integration examples"
echo ""
