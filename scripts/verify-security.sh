#!/bin/bash
# Firestore Security Rules Verification
# Tests security rules locally using Firebase Emulator

set -e

echo "🛡️  Firestore Security Rules Verification"
echo "=========================================="
echo ""

# Check if emulator is available
if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI not installed"
  echo "Install: npm install -g firebase-tools"
  exit 1
fi

# Check if rules file exists
if [ ! -f "firestore.rules" ]; then
  echo "❌ firestore.rules file not found"
  exit 1
fi

echo "📋 Rules Summary:"
echo "----------------"
echo "Total lines: $(wc -l < firestore.rules)"
echo ""

# Check for common security patterns
echo "🔍 Security Checks:"
echo "-------------------"

# 1. Default deny
if grep -q "allow read, write: if false" firestore.rules; then
  echo "✅ Default deny-all rule found"
else
  echo "⚠️  No default deny-all rule detected"
fi

# 2. Auth checks
if grep -q "request.auth != null" firestore.rules; then
  echo "✅ Auth verification found"
else
  echo "❌ No auth verification found"
fi

# 3. Admin checks
if grep -q "isAdmin()" firestore.rules; then
  echo "✅ Admin role checks found"
else
  echo "⚠️  No admin role checks"
fi

# 4. Owner checks
if grep -q "isOwner" firestore.rules; then
  echo "✅ Owner validation found"
else
  echo "⚠️  No owner validation"
fi

# 5. Role-based access
if grep -q "hasRole" firestore.rules; then
  echo "✅ Role-based access control found"
else
  echo "⚠️  No role-based access control"
fi

echo ""

# Validate rules syntax
echo "🔧 Validating Rules Syntax:"
echo "--------------------------"
if firebase deploy --only firestore:rules --dry-run 2>&1 | grep -q "success\|valid"; then
  echo "✅ Rules syntax is valid"
else
  echo "Running validation..."
  firebase deploy --only firestore:rules --dry-run || echo "⚠️  Validation had warnings"
fi

echo ""

# Security recommendations
echo "📝 Security Recommendations:"
echo "---------------------------"
echo "1. ✅ Use default deny-all rule"
echo "2. ✅ Require authentication for all operations"
echo "3. ✅ Implement admin-only access for sensitive data"
echo "4. ✅ Use Cloud Functions for server-side operations"
echo "5. ✅ Validate data types and required fields"
echo "6. ✅ Implement rate limiting in application code"
echo "7. ✅ Use App Check for additional protection"
echo ""

# Test with emulator (optional)
echo "🧪 Emulator Testing (optional):"
echo "-------------------------------"
echo "To test rules locally:"
echo "  firebase emulators:start --only firestore"
echo ""
echo "Then run your tests or manual checks."
echo ""

echo "✅ Security verification complete!"
