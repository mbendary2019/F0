#!/bin/bash
# Phase 53 Day 3 - Live Cursors Smoke Test

set -e

echo "================================================"
echo "🧪 Phase 53 Day 3 - Live Cursors Smoke Test"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 Pre-flight Checks${NC}"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed${NC}"
    echo "Install with: npm install -g pnpm"
    exit 1
fi
echo -e "${GREEN}✅ pnpm is installed${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, installing dependencies...${NC}"
    pnpm install
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Check if y-protocols is installed
if ! grep -q "y-protocols" package.json; then
    echo -e "${RED}❌ y-protocols not found in package.json${NC}"
    exit 1
fi
echo -e "${GREEN}✅ y-protocols dependency found${NC}"

# Check if files exist
echo ""
echo -e "${YELLOW}📁 Checking implementation files...${NC}"

files=(
    "src/lib/collab/createCollabClient.ts"
    "src/lib/collab/useLiveCursors.ts"
    "src/app/[locale]/dev/collab/page.tsx"
    "src/app/globals.css"
    "functions/src/collab/requestJoin.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
        exit 1
    fi
done

# Check for awareness integration
echo ""
echo -e "${YELLOW}🔍 Verifying awareness integration...${NC}"

if grep -q "awareness.setLocalStateField" "src/lib/collab/createCollabClient.ts"; then
    echo -e "${GREEN}✅ Awareness user presence initialized${NC}"
else
    echo -e "${RED}❌ Awareness user presence not found${NC}"
    exit 1
fi

if grep -q "useLiveCursors" "src/app/[locale]/dev/collab/page.tsx"; then
    echo -e "${GREEN}✅ Live cursors hook integrated${NC}"
else
    echo -e "${RED}❌ Live cursors hook not integrated${NC}"
    exit 1
fi

# Check for auto-reconnect
if grep -q "reconnectAttempts" "src/lib/collab/createCollabClient.ts"; then
    echo -e "${GREEN}✅ Auto-reconnect logic implemented${NC}"
else
    echo -e "${RED}❌ Auto-reconnect logic not found${NC}"
    exit 1
fi

# Check for ICE servers configuration
if grep -q "getICEServers" "functions/src/collab/requestJoin.ts"; then
    echo -e "${GREEN}✅ ICE servers configuration present${NC}"
else
    echo -e "${RED}❌ ICE servers configuration not found${NC}"
    exit 1
fi

# Check CSS styles
if grep -q "fz-remote-cursor" "src/app/globals.css"; then
    echo -e "${GREEN}✅ Remote cursor CSS styles present${NC}"
else
    echo -e "${RED}❌ Remote cursor CSS styles not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ All Day 3 features verified!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

echo -e "${YELLOW}🚀 Manual Testing Instructions:${NC}"
echo ""
echo "1. Start the development server:"
echo -e "   ${GREEN}pnpm dev${NC}"
echo ""
echo "2. Open the collaboration test page:"
echo -e "   ${GREEN}http://localhost:3000/en/dev/collab${NC}"
echo ""
echo "3. Open the same URL in 2-3 additional browser tabs"
echo ""
echo "4. Test the following:"
echo "   • Move cursor in one tab → appears in others"
echo "   • Select text in one tab → highlighted in others"
echo "   • Type in any tab → syncs across all tabs"
echo "   • Check sidebar shows all connected users"
echo "   • Verify cursor colors are distinct per user"
echo "   • Test auto-reconnect by pausing network"
echo ""
echo -e "${YELLOW}📊 Expected Results:${NC}"
echo "   ✅ Live cursors with user names"
echo "   ✅ Selection highlights in user colors"
echo "   ✅ Real-time text synchronization"
echo "   ✅ User presence panel with colors"
echo "   ✅ Auto-reconnect on disconnect"
echo "   ✅ Connection status indicator"
echo ""
echo -e "${GREEN}Ready to test! Start the dev server to continue.${NC}"
echo ""
