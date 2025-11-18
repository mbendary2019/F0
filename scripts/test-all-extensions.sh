#!/bin/bash
# F0 Extensions - Complete Test Suite

set -e

echo "🧪 F0 Extensions Test Suite"
echo "============================"
echo ""

echo "📝 Test 1: Validate Firebase Deploy Manifest"
pnpm tsx scripts/ext-validate.ts f0/extensions/examples/firebase.deploy.json
echo ""

echo "📝 Test 2: Validate Stripe Billing Manifest"
pnpm tsx scripts/ext-validate.ts f0/extensions/examples/stripe.billing.json
echo ""

echo "📝 Test 3: Validate HTTP Test Manifest"
pnpm tsx scripts/ext-validate.ts f0/extensions/examples/http.test.json
echo ""

echo "🔒 Test 4: Sandbox Concepts"
pnpm tsx scripts/sandbox-simple-test.ts
echo ""

echo "💥 Test 5: Chaos Tests (Error Handling)"
pnpm tsx scripts/chaos-test-simple.ts
echo ""

echo "============================"
echo "✅ All extension tests passed!"
echo ""
echo "Additional commands:"
echo "  • System health: pnpm tsx scripts/ext-doctor.ts"
echo "  • Start orchestrator: cd orchestrator && pnpm dev"
echo "  • Check diagnostics: http://localhost:3000/admin/diagnostics"
