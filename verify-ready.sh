#!/bin/bash
# Quick verification that all Phase 49 fixes are in place

echo "🔍 Verifying Phase 49 Configuration..."
echo ""

# Check 1: Emulator flag
echo "1️⃣ Checking NEXT_PUBLIC_USE_EMULATORS..."
if grep -q "NEXT_PUBLIC_USE_EMULATORS=1" .env.local; then
  echo "   ✅ Emulator mode enabled"
else
  echo "   ❌ Emulator mode not enabled"
fi

# Check 2: Login page import
echo ""
echo "2️⃣ Checking login page import..."
if grep -q '@/lib/firebaseClient' src/app/login/page.tsx; then
  echo "   ✅ Login imports from firebaseClient"
else
  echo "   ❌ Login imports from wrong file"
fi

# Check 3: Localized login page import
echo ""
echo "3️⃣ Checking localized login page import..."
if grep -q '@/lib/firebaseClient' src/app/\[locale\]/login/page.tsx; then
  echo "   ✅ Localized login imports from firebaseClient"
else
  echo "   ❌ Localized login imports from wrong file"
fi

# Check 4: FirebaseClient has emulator connection
echo ""
echo "4️⃣ Checking firebaseClient emulator connection..."
if grep -q 'connectAuthEmulator(auth, "http://127.0.0.1:9099"' src/lib/firebaseClient.ts; then
  echo "   ✅ Auth emulator connection configured"
else
  echo "   ❌ Auth emulator not configured"
fi

# Check 5: FirebaseClient authDomain
echo ""
echo "5️⃣ Checking firebaseClient authDomain..."
if grep -q 'authDomain: "local-dev"' src/lib/firebaseClient.ts; then
  echo "   ✅ authDomain set to local-dev"
else
  echo "   ❌ authDomain not set to local-dev"
fi

# Check 6: Orchestrator port
echo ""
echo "6️⃣ Checking Orchestrator port..."
if grep -q "NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8088" .env.local; then
  echo "   ✅ Orchestrator on port 8088"
else
  echo "   ❌ Orchestrator not on 8088"
fi

# Check 7: Emulator processes
echo ""
echo "7️⃣ Checking running emulators..."
if lsof -ti:9099 > /dev/null 2>&1; then
  echo "   ✅ Auth emulator running (9099)"
else
  echo "   ⚠️  Auth emulator not running"
fi

if lsof -ti:8080 > /dev/null 2>&1; then
  echo "   ✅ Firestore emulator running (8080)"
else
  echo "   ⚠️  Firestore emulator not running"
fi

if lsof -ti:4000 > /dev/null 2>&1; then
  echo "   ✅ Emulator UI running (4000)"
else
  echo "   ⚠️  Emulator UI not running"
fi

# Check 8: Next.js process
echo ""
echo "8️⃣ Checking Next.js dev server..."
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "   ✅ Next.js running (3000)"
else
  echo "   ⚠️  Next.js not running"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. If emulators not running:"
echo "   firebase emulators:start --only auth,firestore,functions,ui"
echo ""
echo "2. If Next.js not running:"
echo "   npm run dev"
echo ""
echo "3. Then follow testing guide:"
echo "   cat TEST_LOGIN_NOW.md"
echo ""
echo "4. Open in browser:"
echo "   • Login: http://localhost:3000/login"
echo "   • Emulator UI: http://127.0.0.1:4000"
echo ""
