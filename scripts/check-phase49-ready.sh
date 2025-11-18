#!/bin/bash

###############################################################################
# Phase 49 Pre-Deployment Check
# Verifies all files are in place before deployment
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🔍 Phase 49: Pre-Deployment Check       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

ALL_GOOD=true

check_file() {
    local file="$1"
    local desc="$2"

    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✅${NC} $desc"
        return 0
    else
        echo -e "  ${RED}❌${NC} $desc (Missing: $file)"
        ALL_GOOD=false
        return 1
    fi
}

check_dir() {
    local dir="$1"
    local desc="$2"

    if [ -d "$dir" ]; then
        echo -e "  ${GREEN}✅${NC} $desc"
        return 0
    else
        echo -e "  ${RED}❌${NC} $desc (Missing: $dir)"
        ALL_GOOD=false
        return 1
    fi
}

echo -e "${YELLOW}📋 Configuration Files:${NC}"
check_file "firestore.rules.phase49" "Firestore Rules"
check_file "firestore.indexes.phase49.json" "Firestore Indexes"
echo ""

echo -e "${YELLOW}⚡ Cloud Functions - Utilities:${NC}"
check_file "functions/src/util/redact.ts" "PII Redaction"
check_file "functions/src/util/hash.ts" "Hashing"
check_file "functions/src/util/rateLimit.ts" "Rate Limiting"
echo ""

echo -e "${YELLOW}⚡ Cloud Functions - Main:${NC}"
check_file "functions/src/http/log.ts" "Log Endpoint"
check_file "functions/src/incidents/onEventWrite.ts" "Incident Detection"
check_file "functions/src/alerts/notify.ts" "Alert Notifications"
echo ""

echo -e "${YELLOW}💻 Client Code:${NC}"
check_file "src/lib/logger.ts" "Client Logger"
check_file "src/app/api/log/route.ts" "API Proxy"
check_file "src/app/ops/incidents/page.tsx" "Incidents Dashboard"
echo ""

echo -e "${YELLOW}🚀 Deployment Scripts:${NC}"
check_file "scripts/deploy-phase49.sh" "Deploy Script"
check_file "scripts/test-phase49.sh" "Test Script"
echo ""

echo -e "${YELLOW}📚 Documentation:${NC}"
check_file "PHASE_49_COMPLETE.md" "Complete Guide"
check_file "PHASE_49_دليل_سريع.md" "Quick Guide (Arabic)"
echo ""

# Check environment variables
echo -e "${YELLOW}🔧 Environment Check:${NC}"

if [ -f ".env.local" ]; then
    echo -e "  ${GREEN}✅${NC} .env.local exists"

    if grep -q "NEXT_PUBLIC_FIREBASE_PROJECT_ID" .env.local; then
        echo -e "  ${GREEN}✅${NC} Firebase Project ID configured"
    else
        echo -e "  ${YELLOW}⚠️${NC}  NEXT_PUBLIC_FIREBASE_PROJECT_ID not found in .env.local"
    fi
else
    echo -e "  ${YELLOW}⚠️${NC}  .env.local not found"
fi
echo ""

# Check Firebase login
echo -e "${YELLOW}🔑 Firebase Authentication:${NC}"
if firebase projects:list > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Firebase CLI authenticated"
    CURRENT_PROJECT=$(firebase use 2>&1 | grep "Now using" | awk '{print $4}')
    if [ -n "$CURRENT_PROJECT" ]; then
        echo -e "  ${GREEN}✅${NC} Current project: $CURRENT_PROJECT"
    fi
else
    echo -e "  ${RED}❌${NC} Firebase CLI not authenticated"
    echo -e "  ${YELLOW}→${NC} Run: firebase login"
    ALL_GOOD=false
fi
echo ""

# Check Node modules
echo -e "${YELLOW}📦 Dependencies:${NC}"
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✅${NC} Root node_modules"
else
    echo -e "  ${YELLOW}⚠️${NC}  Root node_modules missing"
    echo -e "  ${YELLOW}→${NC} Run: pnpm install"
fi

if [ -d "functions/node_modules" ]; then
    echo -e "  ${GREEN}✅${NC} Functions node_modules"
else
    echo -e "  ${YELLOW}⚠️${NC}  Functions node_modules missing"
    echo -e "  ${YELLOW}→${NC} Run: cd functions && npm install"
fi
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
if [ "$ALL_GOOD" = true ]; then
    echo -e "${BLUE}║  ${GREEN}✅ All Checks Passed!${BLUE}                     ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}🚀 Ready to deploy!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Deploy: ./scripts/deploy-phase49.sh"
    echo "  2. Test:   ./scripts/test-phase49.sh"
    echo ""
    exit 0
else
    echo -e "${BLUE}║  ${RED}❌ Some Checks Failed${BLUE}                     ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}⚠️  Please fix the issues above before deploying${NC}"
    echo ""
    exit 1
fi
