#!/bin/bash

echo "📊 Mesh State Summary:"
echo ""
echo "1️⃣ Peers (3):"
curl -s https://meshview-vpxyxgcfbq-uc.a.run.app/peers | jq -r '.peers[] | "  • \(.id) | Region: \(.region) | Trust: \(.trust)"'
echo ""
echo "2️⃣ Gossip Messages (4):"
curl -s https://meshview-vpxyxgcfbq-uc.a.run.app/gossip | jq -r '.gossip[] | "  • \(.kind) from \(.from) - \(.payload.title // .payload.message // .payload.id)"'
echo ""
echo "3️⃣ Snapshot Status:"
curl -s https://meshview-vpxyxgcfbq-uc.a.run.app/snapshot | jq -r 'if .error then "  ⏳ \(.error)" else "  ✅ \(.objectCount) objects merged at \(.ts)" end'
echo ""
echo "4️⃣ Links:"
curl -s https://meshview-vpxyxgcfbq-uc.a.run.app/links | jq '.count'
echo ""
echo "✅ Done! Mesh is live at:"
echo "   • Peers: https://meshview-vpxyxgcfbq-uc.a.run.app/peers"
echo "   • Gossip: https://meshview-vpxyxgcfbq-uc.a.run.app/gossip"
echo "   • Snapshot: https://meshview-vpxyxgcfbq-uc.a.run.app/snapshot"
