#!/bin/bash
# 🧠 Deploy Cognitive Ops Copilot (Phase 33.2 Advanced)
# Version: v33.2.0
# Date: 2025-10-11

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧠 COGNITIVE OPS COPILOT - DEPLOYMENT SCRIPT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Pre-flight checks
echo "📋 Step 1/5: Pre-flight Checks"
echo "═══════════════════════════════"

# Check if cognitive module exists
if [ ! -d "functions/src/cognitive" ]; then
  echo "❌ Error: functions/src/cognitive not found"
  echo "   Run Phase 33.2 setup first"
  exit 1
fi

# Count files
FILE_COUNT=$(ls -1 functions/src/cognitive/*.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$FILE_COUNT" -lt 5 ]; then
  echo "❌ Error: Missing cognitive module files"
  echo "   Expected ≥5 files, found: $FILE_COUNT"
  exit 1
fi

echo "✅ Cognitive module found ($FILE_COUNT files)"

# TypeScript check
echo ""
echo "Checking TypeScript..."
npm run typecheck > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ TypeScript: 0 errors"
else
  echo "❌ TypeScript errors detected. Run: npm run typecheck"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2/5: Build Functions"
echo "═══════════════════════════════"

cd functions
echo "Installing dependencies..."
npm install --silent

echo "Building Functions..."
npm run build

if [ ! -f "lib/cognitive/orchestrator.js" ]; then
  echo "❌ Build failed: orchestrator.js not found"
  exit 1
fi

echo "✅ Functions built successfully"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  Step 3/5: Deploy Functions"
echo "═══════════════════════════════"

echo "Deploying cognitiveOrchestrator & outcomeTracker..."
firebase deploy --only functions:cognitiveOrchestrator,functions:outcomeTracker

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

echo "Checking deployed functions..."
firebase functions:list | grep -E "(cognitiveOrchestrator|outcomeTracker)" || true

echo ""
echo "Waiting 30 seconds for first orchestrator run..."
sleep 30

echo "Checking logs..."
firebase functions:log --only cognitiveOrchestrator --limit 3 || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Next Steps:"
echo "════════════"
echo ""
echo "1. Visit Dashboard:"
echo "   https://your-domain.com/admin/cognitive"
echo ""
echo "2. Monitor Firestore:"
echo "   Collections: rl_policy, rl_decisions, rl_outcomes"
echo ""
echo "3. Watch Logs:"
echo "   firebase functions:log --only cognitiveOrchestrator --follow"
echo ""
echo "4. Wait 3 minutes for first decision"
echo ""
echo "5. Wait 15+ minutes for first outcome & learning"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Documentation:"
echo "   • PHASE_33_2_PRODUCTION_READY.md"
echo "   • docs/PHASE_33_2_COGNITIVE_COPILOT.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧠 Cognitive Ops Copilot is now LIVE! 🚀"
echo ""
