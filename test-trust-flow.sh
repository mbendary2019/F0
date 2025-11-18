#!/bin/bash

echo "🔐 Testing Trust Flow (PageRank)"
echo ""
echo "Current Trust Scores:"
curl -s https://meshview-vpxyxgcfbq-uc.a.run.app/peers | jq -r '.peers[] | "  \(.id): \(.trust)"'
echo ""
echo "⏳ Trust Flow runs automatically every 30 minutes via Cloud Scheduler"
echo "   Next run will update trust scores based on mesh topology"
echo ""
echo "📊 To manually trigger (requires Firebase Admin access):"
echo "   firebase functions:shell"
echo "   > trustFlow()"
echo ""
echo "✅ Trust propagation algorithm:"
echo "   • PageRank with damping=0.85, teleport=0.15"
echo "   • 20 iterations for convergence"
echo "   • Only healthy links contribute to trust flow"
