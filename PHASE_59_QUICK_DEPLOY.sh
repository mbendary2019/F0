#!/bin/bash

# =============================================================
# Phase 59: Quick Deploy Script
# Deploys enhanced job management system
# =============================================================

set -e

echo "============================================="
echo "  Phase 59: Job Management Deployment"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Deploy Firestore indexes
echo -e "${YELLOW}Step 1: Deploying Firestore indexes...${NC}"
firebase deploy --only firestore:indexes --project=from-zero-84253
echo -e "${GREEN}✅ Indexes deployed${NC}"
echo ""

# Step 2: Deploy Firestore rules
echo -e "${YELLOW}Step 2: Deploying Firestore rules...${NC}"
firebase deploy --only firestore:rules --project=from-zero-84253
echo -e "${GREEN}✅ Rules deployed${NC}"
echo ""

# Step 3: Check index status
echo -e "${YELLOW}Step 3: Checking index status...${NC}"
firebase firestore:indexes --project=from-zero-84253
echo ""

# Step 4: Manual steps
echo -e "${RED}⚠️  MANUAL STEPS REQUIRED:${NC}"
echo ""
echo "1. Enable TTL Policy in Firebase Console:"
echo "   → Visit: https://console.firebase.google.com/project/from-zero-84253/firestore/indexes"
echo "   → Click 'TTL Policies' tab"
echo "   → Click 'Create TTL Policy'"
echo "   → Collection group: ops_memory_jobs"
echo "   → TTL field: expire_at"
echo "   → Click 'Create'"
echo ""
echo "2. Wait for indexes to become READY (5-10 minutes)"
echo "   → Run: firebase firestore:indexes"
echo "   → Look for 'READY' status"
echo ""

# Step 5: Test
echo -e "${YELLOW}Step 4: Starting local test server...${NC}"
echo "Run 'pnpm dev' in another terminal, then:"
echo ""
echo "  Test URLs:"
echo "  → Dashboard: http://localhost:3000/ops/memory"
echo "  → Jobs API: http://localhost:3000/api/memory/jobs?workspaceId=demo"
echo ""
echo "  Test workflow:"
echo "  1. Enter workspace ID: 'demo'"
echo "  2. Click 'Rebuild Graph'"
echo "  3. Watch job appear in Job Log"
echo "  4. Click 'Cancel' to test cancellation"
echo ""

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Enable TTL policy (see above)"
echo "  2. Wait for indexes to become READY"
echo "  3. Test locally with 'pnpm dev'"
echo "  4. Deploy to production with 'firebase deploy --only hosting'"
echo ""
