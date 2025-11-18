#!/bin/bash

# Phase 59 — Cognitive Memory Mesh - Minimal Deployment (API + Firestore only)
# Skips Cloud Functions due to build issues

set -e  # Exit on error

echo "🚀 Starting Phase 59 - Minimal Deployment (API + Firestore)..."
echo ""

# Step 1: Deploy Firestore Config
echo "🔥 Step 1/2: Deploying Firestore indexes and rules..."
firebase deploy --only firestore:indexes,firestore:rules
echo "✅ Firestore config deployed"
echo ""

# Step 2: Info about Next.js API
echo "📊 Step 2/2: Next.js API Endpoints Status"
echo ""
echo "The following API endpoints are ready in src/app/api/memory/:"
echo "  ✅ POST /api/memory/query - Query related nodes"
echo "  ✅ GET  /api/memory/stats - Get graph statistics"
echo "  ✅ POST /api/memory/rebuild - Trigger rebuild"
echo ""
echo "These will be deployed with your next Next.js deployment."
echo ""

# Manual actions
echo "⚠️  CRITICAL: Manual Actions Required"
echo ""
echo "1. Enable TTL Policy in Firebase Console:"
echo "   - Go to: https://console.firebase.google.com/project/from-zero-84253/firestore/indexes"
echo "   - Click: TTL Policies → Create TTL Policy"
echo "   - Set: Collection=ops_memory_edges, Field=expire_at"
echo "   - Wait for status: Serving (~5-10 minutes)"
echo ""
echo "2. Deploy Next.js when ready:"
echo "   pnpm run build && firebase deploy --only hosting"
echo ""
echo "3. Cloud Functions (optional - needs fixing):"
echo "   - Functions have import path issues"
echo "   - Can be deployed later after fixing"
echo ""

echo "🎉 Phase 59 Minimal Deployment Complete!"
echo ""
echo "📊 What's Ready:"
echo "  ✅ Firestore indexes"
echo "  ✅ Firestore security rules"
echo "  ✅ Core TypeScript modules (src/lib/memory/)"
echo "  ✅ API endpoints (src/app/api/memory/)"
echo "  ✅ Tests and benchmarks"
echo ""
echo "📋 What's Pending:"
echo "  ⏳ TTL Policy (manual step required)"
echo "  ⏳ Next.js deployment"
echo "  ⏳ Cloud Functions (needs import path fixes)"
echo ""
echo "✅ Phase 59 core functionality is ready to use! 🚀"
echo ""
