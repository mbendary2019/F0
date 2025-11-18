#!/usr/bin/env bash
#
# Phase 48 Deployment Script
# Deploy Analytics & Audit Trail functions and hosting
#

set -e

echo "==================================="
echo "Phase 48 Deployment"
echo "Analytics & Audit Trail"
echo "==================================="
echo ""

# Check we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo "❌ Error: Must run from project root (where firebase.json is)"
  exit 1
fi

# Build functions
echo "📦 Building Cloud Functions..."
pushd functions > /dev/null
npm install
npm run build
popd > /dev/null
echo "✅ Functions built"
echo ""

# Build Next.js
echo "📦 Building Next.js app..."
npm run build
echo "✅ Next.js built"
echo ""

# Deploy functions
echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions:recordEvent,functions:logAudit,functions:aggregateDailyMetrics,functions:getAnalytics,functions:exportAuditCsv
echo "✅ Functions deployed"
echo ""

# Deploy Firestore rules
echo "🔒 Deploying Firestore rules..."
firebase deploy --only firestore:rules
echo "✅ Rules deployed"
echo ""

# Deploy hosting
echo "🌐 Deploying Hosting..."
firebase deploy --only hosting
echo "✅ Hosting deployed"
echo ""

echo "==================================="
echo "✅ Phase 48 Deployment Complete!"
echo "==================================="
echo ""
echo "New Pages:"
echo "  • /ops/analytics - Analytics Dashboard"
echo "  • /ops/audit - Audit Trail"
echo ""
echo "New Functions:"
echo "  • recordEvent - Record analytics events"
echo "  • logAudit - Log audit entries"
echo "  • aggregateDailyMetrics - Daily aggregation (scheduled)"
echo "  • getAnalytics - Get dashboard data"
echo "  • exportAuditCsv - Export audit CSV"
echo ""
