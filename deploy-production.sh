#!/bin/bash

###############################################################################
# سكريبت النشر على الإنتاج - From Zero
# الاستخدام: ./deploy-production.sh [all|functions|hosting|firestore]
###############################################################################

set -e  # توقف عند أي خطأ

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOY_TARGET="${1:-all}"

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 النشر على الإنتاج - From Zero      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# 1. التحقق من Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI غير مثبت${NC}"
    exit 1
fi

# 2. التحقق من المشروع الحالي
echo -e "${YELLOW}🔍 التحقق من المشروع...${NC}"
CURRENT_PROJECT=$(firebase use)
echo -e "${BLUE}المشروع الحالي: $CURRENT_PROJECT${NC}"
echo ""

read -p "هل تريد المتابعة مع هذا المشروع؟ (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "إلغاء النشر."
    exit 0
fi
echo ""

# 3. تحديث التبعيات
echo -e "${YELLOW}📦 تحديث التبعيات...${NC}"
pnpm install --frozen-lockfile

cd functions
npm ci
cd ..
echo -e "${GREEN}✅ تم تحديث التبعيات${NC}"
echo ""

# 4. بناء Next.js
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "hosting" ]; then
    echo -e "${YELLOW}🔨 بناء Next.js...${NC}"
    pnpm build
    echo -e "${GREEN}✅ تم بناء Next.js${NC}"
    echo ""
fi

# 5. بناء Functions
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "functions" ]; then
    echo -e "${YELLOW}🔨 بناء Functions...${NC}"
    cd functions
    npm run build
    cd ..
    echo -e "${GREEN}✅ تم بناء Functions${NC}"
    echo ""
fi

# 6. التحقق من Linting
echo -e "${YELLOW}🔍 فحص الكود...${NC}"
pnpm lint || echo -e "${YELLOW}⚠️  تحذيرات في الكود${NC}"
echo ""

# 7. نسخ احتياطي من Firestore (اختياري)
read -p "هل تريد أخذ نسخة احتياطية من Firestore؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}💾 أخذ نسخة احتياطية...${NC}"
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    firebase firestore:export "$BACKUP_DIR" || echo -e "${YELLOW}⚠️  فشل النسخ الاحتياطي${NC}"
    echo -e "${GREEN}✅ تم الحفظ في: $BACKUP_DIR${NC}"
fi
echo ""

# 8. النشر بناءً على الهدف
echo -e "${YELLOW}🚀 بدء النشر...${NC}"
echo ""

case $DEPLOY_TARGET in
    "all")
        echo -e "${BLUE}نشر جميع المكونات...${NC}"

        # المرحلة 1: Firestore Rules & Indexes
        echo -e "${YELLOW}📋 المرحلة 1/4: Firestore Rules & Indexes${NC}"
        firebase deploy --only firestore
        echo -e "${GREEN}✅ المرحلة 1 منتهية${NC}"
        echo ""

        # المرحلة 2: Functions الحساسة
        echo -e "${YELLOW}⚡ المرحلة 2/4: Functions الحساسة${NC}"
        firebase deploy --only functions:handleStripeWebhook,functions:createCheckoutSession,functions:syncStripeCustomer
        echo -e "${GREEN}✅ المرحلة 2 منتهية${NC}"
        echo ""

        # المرحلة 3: باقي Functions
        echo -e "${YELLOW}⚡ المرحلة 3/4: باقي Functions${NC}"
        firebase deploy --only functions
        echo -e "${GREEN}✅ المرحلة 3 منتهية${NC}"
        echo ""

        # المرحلة 4: Hosting
        echo -e "${YELLOW}🌐 المرحلة 4/4: Hosting${NC}"
        firebase deploy --only hosting
        echo -e "${GREEN}✅ المرحلة 4 منتهية${NC}"
        ;;

    "functions")
        echo -e "${BLUE}نشر Functions فقط...${NC}"
        firebase deploy --only functions
        ;;

    "hosting")
        echo -e "${BLUE}نشر Hosting فقط...${NC}"
        firebase deploy --only hosting
        ;;

    "firestore")
        echo -e "${BLUE}نشر Firestore Rules & Indexes فقط...${NC}"
        firebase deploy --only firestore
        ;;

    *)
        echo -e "${RED}❌ هدف نشر غير صحيح: $DEPLOY_TARGET${NC}"
        echo "الأهداف المتاحة: all, functions, hosting, firestore"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✅ تم النشر بنجاح!                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# 9. الحصول على عنوان URL
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "hosting" ]; then
    HOSTING_URL=$(firebase hosting:sites:list | grep -v "Site ID" | head -1 | awk '{print "https://" $1 ".web.app"}')
    echo -e "${GREEN}🌐 التطبيق متاح على:${NC}"
    echo "   $HOSTING_URL"
    echo ""
fi

# 10. اختبارات دخان سريعة
read -p "هل تريد تشغيل اختبارات دخان على الإنتاج؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧪 اختبارات الدخان...${NC}"

    # اختبار Health Check
    if [ ! -z "$HOSTING_URL" ]; then
        echo -n "🔍 Health Check... "
        response=$(curl -s "$HOSTING_URL/api/health" 2>/dev/null)
        if echo "$response" | grep -q "ok"; then
            echo -e "${GREEN}✅ نجح${NC}"
        else
            echo -e "${RED}❌ فشل${NC}"
        fi
    fi
fi

echo ""
echo -e "${GREEN}✨ تم النشر بنجاح! استمتع بمشروعك على الإنتاج!${NC}"

# 11. عرض الـ Logs (اختياري)
read -p "هل تريد مشاهدة logs الـ Functions؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📊 عرض Logs...${NC}"
    firebase functions:log --limit 50
fi
