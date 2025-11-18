#!/bin/bash

###############################################################################
# Phase 49 Deployment Script
# Error Tracking & Incident Center
###############################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Phase 49: Error Tracking Deployment  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# 1. Update Firestore Rules
echo -e "${YELLOW}📋 Step 1/6: Updating Firestore Rules...${NC}"
if [ -f "firestore.rules.phase49" ]; then
    cp firestore.rules.phase49 firestore.rules
    firebase deploy --only firestore:rules
    echo -e "${GREEN}✅ Firestore Rules updated${NC}"
else
    echo -e "${RED}❌ firestore.rules.phase49 not found${NC}"
    exit 1
fi
echo ""

# 2. Update Firestore Indexes
echo -e "${YELLOW}📊 Step 2/6: Updating Firestore Indexes...${NC}"
if [ -f "firestore.indexes.phase49.json" ]; then
    cp firestore.indexes.phase49.json firestore.indexes.json
    firebase deploy --only firestore:indexes
    echo -e "${GREEN}✅ Firestore Indexes updated${NC}"
else
    echo -e "${RED}❌ firestore.indexes.phase49.json not found${NC}"
    exit 1
fi
echo ""

# 3. Build Functions
echo -e "${YELLOW}🔨 Step 3/6: Building Cloud Functions...${NC}"
cd functions
npm run build
cd ..
echo -e "${GREEN}✅ Functions built${NC}"
echo ""

# 4. Deploy Phase 49 Functions
echo -e "${YELLOW}⚡ Step 4/6: Deploying Phase 49 Functions...${NC}"
firebase deploy --only functions:log,functions:onEventWrite,functions:processAlerts,functions:testAlert
echo -e "${GREEN}✅ Functions deployed${NC}"
echo ""

# 5. Build Next.js
echo -e "${YELLOW}🌐 Step 5/6: Building Next.js App...${NC}"
pnpm build
echo -e "${GREEN}✅ Next.js built${NC}"
echo ""

# 6. Deploy Hosting
echo -e "${YELLOW}🚀 Step 6/6: Deploying Hosting...${NC}"
firebase deploy --only hosting
echo -e "${GREEN}✅ Hosting deployed${NC}"
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✅ Phase 49 Deployed Successfully!       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}📋 Deployment Summary:${NC}"
echo "  • Firestore Rules: ✅"
echo "  • Firestore Indexes: ✅"
echo "  • Cloud Functions: ✅"
echo "    - log (HTTP)"
echo "    - onEventWrite (Firestore trigger)"
echo "    - processAlerts (Scheduled)"
echo "    - testAlert (HTTP)"
echo "  • Next.js Hosting: ✅"
echo ""

echo -e "${YELLOW}🧪 Next Steps:${NC}"
echo "1. Test the log endpoint:"
echo "   ./scripts/test-phase49.sh"
echo ""
echo "2. Configure Telegram alerts (optional):"
echo "   firebase functions:config:set \\"
echo "     alerts.telegram_bot_token=\"YOUR_BOT_TOKEN\" \\"
echo "     alerts.telegram_chat_id=\"YOUR_CHAT_ID\""
echo ""
echo "3. Access Incidents Dashboard:"
echo "   https://your-app.web.app/ops/incidents"
echo ""

echo -e "${GREEN}✨ Phase 49 deployment complete!${NC}"
