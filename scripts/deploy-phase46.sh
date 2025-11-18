#!/usr/bin/env bash
set -euo pipefail

echo "📦 Phase 46: Usage Metering & Invoices - Deployment"
echo "=================================================="

# Build functions
echo ""
echo "🔨 Building functions..."
pushd functions >/dev/null
npm run build
popd >/dev/null

# Deploy Phase 46 functions and rules
echo ""
echo "🚀 Deploying Phase 46 functions and Firestore rules..."
firebase deploy --only \
  functions:recordUsage,functions:lowQuotaAlert,functions:listInvoices,firestore:rules

echo ""
echo "✅ Phase 46 Deployed Successfully!"
echo ""
echo "📊 Deployed Functions:"
echo "  - recordUsage (callable)"
echo "  - lowQuotaAlert (scheduled: */30 7-23 * * *, Asia/Kuwait)"
echo "  - listInvoices (callable)"
echo ""
echo "🔒 Updated Firestore Rules:"
echo "  - ops_usage_daily (user read own)"
echo "  - ops_usage_monthly (user read own)"
echo "  - ops_invoices (user read own)"
echo ""
echo "📝 Next Steps:"
echo "  1. (Optional) Seed demo data: node scripts/seed-phase46-demo.js"
echo "  2. Implement frontend UI at /account/usage"
echo "  3. Implement frontend UI at /account/billing/history"
echo "  4. Test usage recording with recordUsage function"
echo ""
