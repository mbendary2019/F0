#!/bin/bash

# Phase 63: أوامر النشر السريعة
# تاريخ: 2025-11-07
# الحالة: جاهز للتنفيذ

set -e  # Exit on error

echo "🚀 Phase 63: بدء عملية النشر..."
echo ""

# تحقق من Node version
echo "1️⃣ التحقق من Node version..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20
node -v
echo "✅ Node 20 LTS نشط"
echo ""

# بناء Functions
echo "2️⃣ بناء Functions..."
cd functions
pnpm install
pnpm build
cd ..
echo "✅ تم بناء Functions بنجاح"
echo ""

# نشر Functions
echo "3️⃣ نشر Functions إلى Firebase..."
firebase deploy --only \
  functions:aggregateDailyMetrics,\
  functions:aggregateDailyMetricsBackfill,\
  functions:generateDailyReport,\
  functions:generateDailyReportBackfill,\
  functions:generateTrendInsights,\
  functions:generateTrendInsightsBackfill

echo "✅ تم نشر Functions بنجاح"
echo ""

# نشر Firestore Rules & Indexes
echo "4️⃣ نشر Firestore Rules & Indexes..."
firebase deploy --only firestore:rules,firestore:indexes
echo "✅ تم نشر Rules & Indexes بنجاح"
echo ""

# اختبار اختياري
echo "5️⃣ (اختياري) Backfill للاختبار"
echo "هل تريد تشغيل Backfill لآخر 7 أيام؟ (y/N)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "تشغيل Backfill..."
    firebase functions:call aggregateDailyMetricsBackfill --data='{"days":7}'
    firebase functions:call generateDailyReportBackfill --data='{"days":7}'
    firebase functions:call generateTrendInsightsBackfill --data='{"days":7}'
    echo "✅ اكتمل Backfill"
else
    echo "⏭️ تم تخطي Backfill"
fi
echo ""

# النهاية
echo "🎉 اكتملت عملية النشر!"
echo ""
echo "📊 افتح Dashboard:"
echo "   https://YOUR-PROJECT.web.app/ar/ops/analytics"
echo ""
echo "📚 مراقبة Logs:"
echo "   firebase functions:log"
echo ""
echo "✅ Phase 63 جاهز ويعمل!"
