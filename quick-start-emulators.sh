#!/bin/bash
# ============================================================
# تشغيل سريع للمحاكيات (بدون إعداد GitHub)
# Quick start emulators (without GitHub setup)
# ============================================================

set -e

echo "🚀 بدء تشغيل المحاكيات..."
echo "🚀 Starting emulators..."

# إيقاف المحاكيات القديمة
echo "🛑 إيقاف المحاكيات القديمة..."
pkill -9 -f "firebase|java" 2>/dev/null || true

# بناء الدوال
echo "🔨 بناء الدوال..."
cd functions && npm run build && cd ..

# تشغيل المحاكيات
echo ""
echo "✅ جاهز! افتح المتصفح على:"
echo "✅ Ready! Open browser at:"
echo "   http://127.0.0.1:4000"
echo ""

firebase emulators:start --only firestore,functions,auth,storage,ui
