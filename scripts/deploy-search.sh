#!/usr/bin/env bash
# Phase 56 Day 2 - Deploy Semantic Search Functions
set -euo pipefail

echo "🔍 Phase 56 Day 2 - Semantic Search Deployment"
echo "=============================================="

echo ""
echo "🔧 Building functions..."
pushd functions >/dev/null
pnpm build
popd >/dev/null

echo ""
echo "✅ Build successful!"
echo ""

echo "🔐 Configuration Check..."
echo "Make sure you have set up one of the following providers:"
echo ""
echo "Option 1 - OpenAI (Recommended):"
echo "  firebase functions:secrets:set OPENAI_API_KEY"
echo "  firebase functions:config:set embeddings.provider=\"openai\" embeddings.model=\"text-embedding-3-small\""
echo ""
echo "Option 2 - Cloudflare Workers AI:"
echo "  firebase functions:secrets:set CF_ACCOUNT_ID"
echo "  firebase functions:secrets:set CF_API_TOKEN"
echo "  firebase functions:config:set embeddings.provider=\"cloudflare\" embeddings.model=\"@cf/baai/bge-base-en-v1.5\""
echo ""

read -p "Have you configured the embedding provider? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Please configure the provider first and run this script again."
    exit 1
fi

echo ""
echo "🚀 Deploying searchMemories function..."
firebase deploy --only functions:searchMemories

echo ""
echo "✅ Deployment complete!"
echo ""

echo "📊 View deployment status:"
firebase functions:list | grep searchMemories || echo "Function deployed successfully"

echo ""
echo "📜 Recent logs (last 30 entries):"
firebase functions:log --only searchMemories --limit 30

echo ""
echo "=============================================="
echo "✅ Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3030/en/ops/memory"
echo "2. Test search with queries like:"
echo "   - 'user authentication'"
echo "   - 'login error'"
echo "   - 'firebase'"
echo ""
echo "3. Monitor logs:"
echo "   firebase functions:log --only searchMemories --limit 50"
echo ""
