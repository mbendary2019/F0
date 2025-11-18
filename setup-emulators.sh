#!/bin/bash
# ============================================================
# إعداد Firebase Emulators مع GitHub Integration
# Setup Firebase Emulators with GitHub Integration
# ============================================================

set -e

echo "🔧 إعداد بيئة التطوير المحلية..."
echo "🔧 Setting up local development environment..."

# ============================================================
# 1. توليد مفتاح التشفير
# 1. Generate encryption key
# ============================================================

if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL غير مثبت. يرجى تثبيته أولاً."
    echo "❌ OpenSSL is not installed. Please install it first."
    exit 1
fi

ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "✅ تم توليد مفتاح التشفير"
echo "✅ Encryption key generated"

# ============================================================
# 2. إعداد GitHub Config
# 2. Setup GitHub Config
# ============================================================

echo ""
echo "📝 إعداد GitHub OAuth Configuration..."
echo "📝 Setting up GitHub OAuth Configuration..."
echo ""
echo "يرجى إدخال معلومات GitHub App الخاصة بك:"
echo "Please enter your GitHub App credentials:"
echo ""

read -p "GitHub Client ID: " GITHUB_CLIENT_ID
read -p "GitHub Client Secret: " GITHUB_CLIENT_SECRET
read -p "GitHub Webhook Secret: " GITHUB_WEBHOOK_SECRET

# ============================================================
# 3. حفظ Config في Firebase Functions
# 3. Save Config to Firebase Functions
# ============================================================

echo ""
echo "💾 حفظ الإعدادات في Firebase Functions Config..."
echo "💾 Saving settings to Firebase Functions Config..."

firebase functions:config:set \
  github.client_id="$GITHUB_CLIENT_ID" \
  github.client_secret="$GITHUB_CLIENT_SECRET" \
  github.redirect_uri="http://localhost:3000/api/github/callback" \
  github.webhook_secret="$GITHUB_WEBHOOK_SECRET" \
  encryption.key="$ENCRYPTION_KEY"

echo "✅ تم حفظ الإعدادات بنجاح"
echo "✅ Settings saved successfully"

# ============================================================
# 4. التحقق من الإعدادات
# 4. Verify settings
# ============================================================

echo ""
echo "🔍 التحقق من الإعدادات المحفوظة..."
echo "🔍 Verifying saved settings..."

firebase functions:config:get github
firebase functions:config:get encryption

# ============================================================
# 5. إيقاف المحاكيات القديمة
# 5. Stop old emulators
# ============================================================

echo ""
echo "🛑 إيقاف المحاكيات القديمة إن وجدت..."
echo "🛑 Stopping old emulators if running..."

pkill -9 -f "firebase|java" 2>/dev/null || true

# ============================================================
# 6. بناء الدوال
# 6. Build functions
# ============================================================

echo ""
echo "🔨 بناء الدوال..."
echo "🔨 Building functions..."

cd functions
npm run build
cd ..

# ============================================================
# 7. تشغيل المحاكيات
# 7. Start emulators
# ============================================================

echo ""
echo "🚀 تشغيل المحاكيات..."
echo "🚀 Starting emulators..."
echo ""
echo "ستتمكن من الوصول إلى:"
echo "You can access:"
echo "  • Emulator UI: http://127.0.0.1:4000"
echo "  • Firestore: http://127.0.0.1:8080"
echo "  • Auth: http://127.0.0.1:9099"
echo "  • Functions: http://127.0.0.1:5001"
echo "  • Storage: http://127.0.0.1:9199"
echo ""

firebase emulators:start --only firestore,functions,auth,storage,ui
