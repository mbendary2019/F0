#!/bin/bash

###############################################################################
# سكريبت إيقاف الخدمات المحلية - From Zero
###############################################################################

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}🛑 إيقاف جميع الخدمات...${NC}"
echo ""

# قراءة PIDs المحفوظة وإيقافها
if [ -d ".pids" ]; then
    if [ -f ".pids/emulators.pid" ]; then
        PID=$(cat .pids/emulators.pid)
        kill $PID 2>/dev/null && echo -e "${GREEN}✅ تم إيقاف Emulators (PID: $PID)${NC}" || echo -e "${YELLOW}⚠️  Emulators غير مشغل${NC}"
    fi

    if [ -f ".pids/nextjs.pid" ]; then
        PID=$(cat .pids/nextjs.pid)
        kill $PID 2>/dev/null && echo -e "${GREEN}✅ تم إيقاف Next.js (PID: $PID)${NC}" || echo -e "${YELLOW}⚠️  Next.js غير مشغل${NC}"
    fi

    if [ -f ".pids/orchestrator.pid" ]; then
        PID=$(cat .pids/orchestrator.pid)
        kill $PID 2>/dev/null && echo -e "${GREEN}✅ تم إيقاف Orchestrator (PID: $PID)${NC}" || echo -e "${YELLOW}⚠️  Orchestrator غير مشغل${NC}"
    fi

    rm -rf .pids
fi

# تنظيف شامل لجميع عمليات Node و Firebase
echo ""
echo -e "${YELLOW}🧹 تنظيف شامل...${NC}"
pkill -f "firebase emulators" && echo -e "${GREEN}✅ تم إيقاف Firebase Emulators${NC}" || true
pkill -f "next dev" && echo -e "${GREEN}✅ تم إيقاف Next.js${NC}" || true
pkill -f "orchestrator" && echo -e "${GREEN}✅ تم إيقاف Orchestrator${NC}" || true

# تحرير البورتات
echo ""
echo -e "${YELLOW}🔓 تحرير البورتات...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ تم تحرير البورت 3000${NC}" || true
lsof -ti:5001 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ تم تحرير البورت 5001${NC}" || true
lsof -ti:8080 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ تم تحرير البورت 8080${NC}" || true
lsof -ti:9090 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ تم تحرير البورت 9090${NC}" || true
lsof -ti:9099 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ تم تحرير البورت 9099${NC}" || true

echo ""
echo -e "${GREEN}✅ تم إيقاف جميع الخدمات بنجاح${NC}"
