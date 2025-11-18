#!/bin/bash

# F0 Agent - Quick Start Script
# تشغيل سريع للمشروع

set -e

echo "🚀 Starting F0 Agent..."
echo ""

# الألوان
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# التحقق من .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    if [ -f ".env.template" ]; then
        cp .env.template .env
        echo -e "${GREEN}✓ Created .env${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env and add your API keys${NC}"
        exit 1
    else
        echo -e "${YELLOW}⚠️  .env.template not found${NC}"
        exit 1
    fi
fi

# التحقق من orchestrator node_modules
if [ ! -d "orchestrator/node_modules" ]; then
    echo -e "${BLUE}📦 Installing orchestrator dependencies...${NC}"
    cd orchestrator
    npm install --legacy-peer-deps
    cd ..
fi

# التحقق من desktop node_modules
if [ ! -d "desktop/node_modules" ]; then
    echo -e "${BLUE}📦 Installing desktop dependencies...${NC}"
    cd desktop
    npm install --legacy-peer-deps
    cd ..
fi

# التحقق من tsx
echo -e "${BLUE}📦 Installing tsx globally (if needed)...${NC}"
npm install -g tsx 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ All dependencies installed${NC}"
echo ""

# الخيارات
echo "Select run mode:"
echo "1) Electron (Desktop app with UI)"
echo "2) Orchestrator only (Server only)"
echo "3) Both (Orchestrator + Electron)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo -e "${BLUE}🚀 Starting Electron...${NC}"
        cd desktop
        npm run dev
        ;;
    2)
        echo -e "${BLUE}🚀 Starting Orchestrator on port 8080...${NC}"
        cd orchestrator

        # نسخ .env من الجذر إذا لم يكن موجوداً
        if [ ! -f ".env" ] && [ -f "../.env" ]; then
            cp ../.env .env
        fi

        # تشغيل مع npx tsx
        npx tsx watch src/index.ts
        ;;
    3)
        echo -e "${BLUE}🚀 Starting both Orchestrator and Electron...${NC}"

        # تشغيل orchestrator في الخلفية
        cd orchestrator
        if [ ! -f ".env" ] && [ -f "../.env" ]; then
            cp ../.env .env
        fi
        npx tsx src/index.ts &
        ORC_PID=$!
        cd ..

        # انتظار بدء orchestrator
        sleep 3

        # تشغيل electron
        cd desktop
        npm run dev

        # قتل orchestrator عند الخروج
        kill $ORC_PID 2>/dev/null || true
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
