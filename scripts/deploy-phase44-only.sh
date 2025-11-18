#!/bin/bash

# Phase 44 Only Deployment (skip Phase 45 for now)

set -e

echo "🚀 Deploying Phase 44 Only (Add-Ons Pack)"
echo "=========================================="

# Build functions
echo "🔨 Building Cloud Functions..."
cd functions
npm install
npm run build
cd ..

echo "✅ Functions built"

# Deploy only Phase 44 functions
echo "☁️  Deploying Phase 44 Cloud Functions..."
firebase deploy --only functions:resetDailyQuotas,functions:figmaScheduledPull,functions:figmaPullOnDemand,functions:requestInstall

echo "✅ Phase 44 deployed successfully!"
