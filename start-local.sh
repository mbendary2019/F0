#!/bin/bash

###############################################################################
# سكريبت التشغيل المحلي الشامل - From Zero
# يشغل جميع الخدمات المطلوبة للتطوير المحلي
###############################################################################

set -e  # توقف عند أي خطأ

# ألوان للطباعة
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 From Zero - التشغيل المحلي         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# 1. التحقق من المتطلبات
echo -e "${YELLOW}📋 التحقق من المتطلبات...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js غير مثبت${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm غير مثبت${NC}"
    echo "قم بتثبيته: npm install -g pnpm"
    exit 1
fi

if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI غير مثبت${NC}"
    echo "قم بتثبيته: npm install -g firebase-tools"
    exit 1
fi

echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"
echo -e "${GREEN}✅ pnpm: $(pnpm -v)${NC}"
echo -e "${GREEN}✅ Firebase CLI: $(firebase --version)${NC}"
echo ""

# 2. التحقق من ملفات البيئة
echo -e "${YELLOW}🔧 التحقق من ملفات البيئة...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local غير موجود${NC}"
    if [ -f ".env.local.example" ]; then
        echo "📝 نسخ من .env.local.example..."
        cp .env.local.example .env.local
        echo -e "${YELLOW}⚠️  يرجى تحديث .env.local بقيمك الخاصة${NC}"
    else
        echo -e "${RED}❌ .env.local.example غير موجود${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env.local موجود${NC}"
fi

if [ ! -f "functions/.env" ]; then
    echo -e "${YELLOW}⚠️  functions/.env غير موجود${NC}"
    echo "📝 إنشاء ملف بيئة افتراضي..."
    cat > functions/.env << EOF
FIREBASE_PROJECT_ID=demo-project
APP_URL=http://localhost:3000
EOF
    echo -e "${YELLOW}⚠️  يرجى تحديث functions/.env بقيمك الخاصة${NC}"
else
    echo -e "${GREEN}✅ functions/.env موجود${NC}"
fi
echo ""

# 3. تثبيت التبعيات
echo -e "${YELLOW}📦 التحقق من التبعيات...${NC}"

if [ ! -d "node_modules" ]; then
    echo "📥 تثبيت التبعيات الرئيسية..."
    pnpm install
else
    echo -e "${GREEN}✅ التبعيات الرئيسية مثبتة${NC}"
fi

if [ ! -d "functions/node_modules" ]; then
    echo "📥 تثبيت تبعيات Functions..."
    cd functions
    npm install
    cd ..
else
    echo -e "${GREEN}✅ تبعيات Functions مثبتة${NC}"
fi
echo ""

# 4. بناء Functions
echo -e "${YELLOW}🔨 بناء Functions...${NC}"
cd functions
npm run build
cd ..
echo -e "${GREEN}✅ تم بناء Functions${NC}"
echo ""

# 5. قتل العمليات القديمة
echo -e "${YELLOW}🧹 تنظيف العمليات القديمة...${NC}"
pkill -f "firebase emulators" || true
pkill -f "next dev" || true
pkill -f "orchestrator" || true
sleep 2
echo -e "${GREEN}✅ تم التنظيف${NC}"
echo ""

# 6. بذر البيانات (إذا لم يتم من قبل)
echo -e "${YELLOW}🌱 التحقق من البيانات الأولية...${NC}"
read -p "هل تريد بذر البيانات الآن؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 بذر البيانات..."
    FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js &
    SEED_PID=$!
fi
echo ""

# 7. تشغيل Firebase Emulators في الخلفية
echo -e "${YELLOW}🔥 تشغيل Firebase Emulators...${NC}"
firebase emulators:start --only functions,firestore,auth > logs/emulators.log 2>&1 &
EMULATORS_PID=$!
echo -e "${GREEN}✅ Emulators PID: $EMULATORS_PID${NC}"
echo "📝 Logs: logs/emulators.log"

# انتظر حتى تبدأ Emulators
echo "⏳ انتظار بدء Emulators..."
for i in {1..30}; do
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Firestore Emulator جاهز${NC}"
        break
    fi
    sleep 1
done
echo ""

# 8. بذر البيانات بعد بدء Emulator (إذا تم اختياره)
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wait $SEED_PID
    echo -e "${GREEN}✅ تم بذر البيانات${NC}"
    echo ""
fi

# 9. تشغيل Next.js Dev Server
echo -e "${YELLOW}⚛️  تشغيل Next.js Dev Server...${NC}"
pnpm dev > logs/nextjs.log 2>&1 &
NEXTJS_PID=$!
echo -e "${GREEN}✅ Next.js PID: $NEXTJS_PID${NC}"
echo "📝 Logs: logs/nextjs.log"
echo ""

# 10. تشغيل Orchestrator (اختياري)
read -p "هل تريد تشغيل Orchestrator؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🎼 تشغيل Orchestrator...${NC}"
    cd orchestrator
    pnpm dev > ../logs/orchestrator.log 2>&1 &
    ORCHESTRATOR_PID=$!
    cd ..
    echo -e "${GREEN}✅ Orchestrator PID: $ORCHESTRATOR_PID${NC}"
    echo "📝 Logs: logs/orchestrator.log"
fi
echo ""

# 11. ملخص
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✅ جميع الخدمات تعمل!                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 الخدمات المتاحة:${NC}"
echo "  • Next.js App:       http://localhost:3000"
echo "  • Firestore:         http://localhost:8080"
echo "  • Auth:              http://localhost:9099"
echo "  • Functions:         http://localhost:5001"
if [[ $ORCHESTRATOR_PID ]]; then
    echo "  • Orchestrator:      http://localhost:9090"
fi
echo ""
echo -e "${YELLOW}📋 معلومات العمليات:${NC}"
echo "  • Emulators PID:     $EMULATORS_PID"
echo "  • Next.js PID:       $NEXTJS_PID"
if [[ $ORCHESTRATOR_PID ]]; then
    echo "  • Orchestrator PID:  $ORCHESTRATOR_PID"
fi
echo ""
echo -e "${YELLOW}📝 الـ Logs:${NC}"
echo "  • Emulators:         tail -f logs/emulators.log"
echo "  • Next.js:           tail -f logs/nextjs.log"
if [[ $ORCHESTRATOR_PID ]]; then
    echo "  • Orchestrator:      tail -f logs/orchestrator.log"
fi
echo ""
echo -e "${YELLOW}🛑 لإيقاف جميع الخدمات:${NC}"
echo "  ./stop-local.sh"
echo "  أو: killall node && pkill -f firebase"
echo ""
echo -e "${GREEN}✨ استمتع بالتطوير!${NC}"

# حفظ PIDs لاستخدامها في الإيقاف
mkdir -p .pids
echo $EMULATORS_PID > .pids/emulators.pid
echo $NEXTJS_PID > .pids/nextjs.pid
if [[ $ORCHESTRATOR_PID ]]; then
    echo $ORCHESTRATOR_PID > .pids/orchestrator.pid
fi

# Keep script running to show logs
trap "echo 'إيقاف الخدمات...'; ./stop-local.sh; exit" INT TERM

# Show combined logs
echo ""
echo -e "${BLUE}📊 عرض الـ Logs المباشرة (Ctrl+C للإيقاف):${NC}"
tail -f logs/*.log
