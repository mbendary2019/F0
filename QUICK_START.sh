#!/bin/bash

# Quick Start Script for Phase 72-73
# Usage: ./QUICK_START.sh

echo "🚀 From Zero - Phase 72-73 Quick Start"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if port 3030 is available
if lsof -Pi :3030 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 3030 is already in use${NC}"
    echo "Dev server might already be running!"
    echo ""
else
    echo -e "${GREEN}✅ Port 3030 is available${NC}"
    echo ""
fi

# Check if port 8080 is available for Firestore
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 8080 is already in use${NC}"
    echo "Firestore emulator might already be running!"
    echo ""
else
    echo -e "${GREEN}✅ Port 8080 is available${NC}"
    echo ""
fi

echo "📋 Setup Instructions:"
echo "====================="
echo ""
echo "1️⃣  Start Firestore Emulator (Terminal 1):"
echo "   ${GREEN}firebase emulators:start --only firestore${NC}"
echo ""
echo "2️⃣  Seed Test Data (Terminal 2):"
echo "   ${GREEN}FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seed-analytics-data.ts${NC}"
echo ""
echo "3️⃣  Dev Server should already be running on:"
echo "   ${GREEN}http://localhost:3030${NC}"
echo ""
echo "📊 Test URLs:"
echo "============"
echo ""
echo "🏠 Home (Mock Projects):"
echo "   ${GREEN}http://localhost:3030/ar${NC}"
echo ""
echo "📋 Projects List:"
echo "   ${GREEN}http://localhost:3030/ar/projects${NC}"
echo ""
echo "📈 Analytics Dashboard:"
echo "   ${GREEN}http://localhost:3030/ar/ops/analytics${NC}"
echo ""
echo "🔍 API Endpoint:"
echo "   ${GREEN}http://localhost:3030/api/ops/metrics?days=7${NC}"
echo ""
echo "📚 Documentation:"
echo "================="
echo ""
echo "English:"
echo "  - PHASE_72_MOCK_MODE_COMPLETE.md"
echo "  - ANALYTICS_TESTING_GUIDE.md"
echo "  - PHASE_72_73_STABLE_SNAPSHOT.md"
echo ""
echo "Arabic:"
echo "  - PHASE_72_دليل_سريع.md"
echo "  - دليل_اختبار_Analytics.md"
echo "  - المرحلة_72_73_ملخص_نهائي.md"
echo ""
echo "✨ Ready to develop! Happy coding! ✨"
echo ""
