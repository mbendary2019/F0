#!/bin/bash
set -e

echo "🚀 Deploy Phase 42: Federated Consensus & Collective Optimization"
echo ""

# Step 1: Deploy Firestore rules and indexes
echo "📋 Step 1/4: Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules,firestore:indexes

# Step 2: Install dependencies
echo ""
echo "📦 Step 2/4: Installing dependencies..."
cd functions
npm install libsodium-wrappers @types/node

# Step 3: Build functions
echo ""
echo "🔨 Step 3/4: Building functions..."
npm run build

# Step 4: Deploy Phase 42 functions
echo ""
echo "🚀 Step 4/4: Deploying Phase 42 functions..."
firebase deploy --only functions:fedVote,functions:consensusSweep,functions:consensusApply,functions:fedEconomics,functions:trustSweep,functions:incentives,functions:apiConsensus,functions:apiEconomics,functions:apiTrust,functions:apiIncentives

echo ""
echo "✅ Phase 42 deployment complete!"
echo ""
echo "Deployed functions:"
echo "  - fedVote (HTTPS)"
echo "  - consensusSweep (Schedule: every 10 minutes)"
echo "  - consensusApply (Schedule: every 5 minutes)"
echo "  - fedEconomics (Schedule: every 60 minutes)"
echo "  - trustSweep (Schedule: every 4 hours)"
echo "  - incentives (Schedule: every 24 hours)"
echo "  - apiConsensus (HTTPS)"
echo "  - apiEconomics (HTTPS)"
echo "  - apiTrust (HTTPS)"
echo "  - apiIncentives (HTTPS)"
echo ""
echo "🎯 Next steps:"
echo "  1. Register federation peers in fed_peers collection"
echo "  2. Test consensus proposal via Firebase shell or API"
echo "  3. Monitor consensus_proposals collection for quorum progress"
echo "  4. Check trust_scores for peer reputation"
echo "  5. Review incentive_credits for contribution tracking"
