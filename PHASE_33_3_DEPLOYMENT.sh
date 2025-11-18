#!/bin/bash
# 🧬 Deploy Self-Evolving Ops (Phase 33.3)
# Auto-tuning, adaptation & meta-learning

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧬 SELF-EVOLVING OPS - DEPLOYMENT SCRIPT"
echo "   Phase 33.3: Auto-Policy Tuning & Meta-Learning"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Pre-flight checks
echo "📋 Step 1/5: Pre-flight Checks"
echo "═══════════════════════════════"

if [ ! -d "functions/src/auto" ]; then
  echo "❌ Error: functions/src/auto not found"
  exit 1
fi

FILE_COUNT=$(ls -1 functions/src/auto/*.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$FILE_COUNT" -lt 5 ]; then
  echo "❌ Error: Missing auto module files (expected ≥5, found: $FILE_COUNT)"
  exit 1
fi

echo "✅ Auto module found ($FILE_COUNT files)"

# TypeScript check
echo "Checking TypeScript..."
npm run typecheck > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ TypeScript: 0 errors"
else
  echo "⚠️  TypeScript errors detected (non-blocking)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2/5: Build Functions"
echo "═══════════════════════════════"

cd functions
echo "Installing dependencies..."
npm install --silent

echo "Building..."
npm run build

if [ ! -f "lib/auto/tuner.js" ]; then
  echo "❌ Build failed: tuner.js not found"
  exit 1
fi

echo "✅ Functions built successfully"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  Step 3/5: Deploy Functions"
echo "═══════════════════════════════"

echo "Deploying 4 auto-evolution functions..."
firebase deploy --only \
  functions:autoPolicyTuner,functions:guardrailAdapt,functions:metaLearner,functions:autoDoc

if [ $? -ne 0 ]; then
  echo "❌ Function deployment failed"
  exit 1
fi

echo "✅ Functions deployed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Step 4/5: Deploy Frontend"
echo "═══════════════════════════════"

echo "Building frontend..."
npm run build > /dev/null 2>&1

echo "Deploying hosting..."
firebase deploy --only hosting

if [ $? -ne 0 ]; then
  echo "⚠️  Frontend deployment failed (non-critical)"
else
  echo "✅ Frontend deployed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Step 5/5: Verification"
echo "═══════════════════════════════"

echo "Listing deployed functions..."
firebase functions:list | grep -E "(autoPolicyTuner|guardrailAdapt|metaLearner|autoDoc)" || true

echo ""
echo "Checking recent logs..."
firebase functions:log --limit 5 | grep -E "(Auto-Tuner|Guardrail|Meta-Learner|Auto-Doc)" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Next Steps:"
echo "════════════"
echo ""
echo "1. Visit Policy Dashboard:"
echo "   https://your-domain.com/admin/policies"
echo ""
echo "2. Monitor Firestore Collections:"
echo "   • rl_policy (tuning updates)"
echo "   • ops_policies (guardrail adaptations)"
echo "   • rl_policy_versions (version history)"
echo "   • auto_docs (documentation log)"
echo ""
echo "3. Watch Auto-Tuning:"
echo "   firebase functions:log --only autoPolicyTuner --follow"
echo ""
echo "4. First auto-tuning cycle: ~24 hours"
echo "5. First guardrail adaptation: ~12 hours"
echo "6. First champion selection: ~72 hours"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Documentation:"
echo "   • docs/PHASE_33_3_SELF_EVOLVING_OPS.md"
echo "   • /admin/policies (UI dashboard)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧬 Self-Evolution System is now LIVE! 🚀"
echo ""
