#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Phase 47 Smoke Tests - Teams, Seats & RBAC"
echo ""

PASS=0
FAIL=0

# Check function deployment
echo "1️⃣  Checking deployed functions..."
FUNCTIONS=(
  "createOrg"
  "updateOrg"
  "deleteOrg"
  "inviteMember"
  "acceptInvite"
  "removeMember"
  "updateRole"
  "updateSeats"
)

for func in "${FUNCTIONS[@]}"; do
  if firebase functions:list | grep -q "$func"; then
    echo "   ✅ $func deployed"
    ((PASS++))
  else
    echo "   ❌ $func NOT deployed"
    ((FAIL++))
  fi
done

echo ""

# Check source files
echo "2️⃣  Checking source files..."
FILES=(
  "functions/src/orgs/management.ts"
  "functions/src/orgs/members.ts"
  "functions/src/orgs/seats.ts"
  "functions/src/utils/rbac.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file exists"
    ((PASS++))
  else
    echo "   ❌ $file missing"
    ((FAIL++))
  fi
done

echo ""

# Check exports in index.ts
echo "3️⃣  Checking exports in index.ts..."
EXPORTS=(
  "createOrg"
  "updateOrg"
  "deleteOrg"
  "inviteMember"
  "acceptInvite"
  "removeMember"
  "updateRole"
  "updateSeats"
)

for exp in "${EXPORTS[@]}"; do
  if grep -q "export.*$exp" functions/src/index.ts; then
    echo "   ✅ $exp exported"
    ((PASS++))
  else
    echo "   ❌ $exp NOT exported"
    ((FAIL++))
  fi
done

echo ""

# Check Firestore rules
echo "4️⃣  Checking Firestore rules..."
RULES=(
  "ops_orgs"
  "ops_org_members"
  "ops_org_invites"
)

for rule in "${RULES[@]}"; do
  if grep -q "match /$rule/" firestore.rules; then
    echo "   ✅ $rule rule defined"
    ((PASS++))
  else
    echo "   ❌ $rule rule missing"
    ((FAIL++))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ All smoke tests passed!"
  echo ""
  echo "📝 Next Steps:"
  echo "  1. Run: node scripts/seed-phase47-demo.js"
  echo "  2. Test org creation via Firebase Console"
  echo "  3. Test member invites and role changes"
  echo ""
  exit 0
else
  echo "❌ Some tests failed. Please review the output above."
  exit 1
fi
