# Phase 43 - Global Cognitive Mesh ✅

**Deployment Status**: COMPLETE
**Deployment Date**: 2025-10-12
**Functions Deployed**: 5

---

## 🎯 Deployed Functions

### HTTPS Endpoints (3)
1. **meshBeacon** - Peer discovery and registration
   - URL: https://meshbeacon-vpxyxgcfbq-uc.a.run.app
   - Purpose: Bootstrap endpoint for mesh peers

2. **meshGossip** - Gossip message ingestion
   - URL: https://meshgossip-vpxyxgcfbq-uc.a.run.app
   - Purpose: Receive gossip envelopes (proposals, votes, risk, telemetry)

3. **apiMesh** - Mesh query API
   - URL: https://apimesh-vpxyxgcfbq-uc.a.run.app
   - Endpoints:
     - GET /api/mesh/peers - List mesh peers
     - GET /api/mesh/links - List mesh links
     - GET /api/mesh/snapshot - Get latest CRDT snapshot

### Scheduled Functions (2)
4. **meshReduce** - CRDT state reduction
   - Schedule: Every 5 minutes
   - Purpose: Merge gossip into latest snapshot using LWW-CRDT

5. **trustFlow** - Trust propagation
   - Schedule: Every 30 minutes
   - Purpose: Calculate peer trust scores via PageRank

---

## 📊 Firestore Collections

### Phase 43 Collections (New)
- **mesh_peers** - Registered mesh peers with Ed25519 pubkeys
- **mesh_links** - P2P connections between peers (health, RTT)
- **mesh_gossip** - Incoming gossip envelopes (CRDT DAG)
- **mesh_snapshots** - Materialized CRDT state (latest snapshot)

### Indexes Created
- `mesh_gossip` by (ts DESC, kind ASC)
- `mesh_gossip` by (kind ASC, ts DESC)

---

## 🔐 Security Model

All Phase 43 collections use service/admin access:

```rules
match /mesh_peers/{id} {
  allow read, write: if isAdmin();
}

match /mesh_links/{id} {
  allow write: if isService();
  allow read: if isService() || isAdmin();
}

match /mesh_gossip/{id} {
  allow create: if isService();
  allow read: if isService() || isAdmin();
}

match /mesh_snapshots/{id} {
  allow write: if isService();
  allow read: if isService() || isAdmin();
}
```

---

## 🚀 Quick Start

### 1. Register Mesh Peer
```bash
curl -X POST https://meshbeacon-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "id": "fz-alpha",
    "pubKey": "ed25519_public_key_base64",
    "region": "us-east-1",
    "endpoints": {
      "https": "https://alpha.example.com",
      "webrtc": "wss://alpha.example.com/rtc"
    }
  }'
```

### 2. Send Gossip Message
```bash
curl -X POST https://meshgossip-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ge_proposal_123",
    "kind": "proposal",
    "from": "fz-alpha",
    "payload": {
      "id": "prop123",
      "policyId": "router-core",
      "params": {"modelWeights": {"gpt-5": 0.6}}
    },
    "ts": '$(date +%s000)',
    "sig": "ed25519_signature",
    "parents": []
  }'
```

### 3. Create Mesh Link (Manual)
```javascript
// Via Firebase shell or admin SDK
db.collection('mesh_links').add({
  id: 'fz-alpha<->fz-beta',
  a: 'fz-alpha',
  b: 'fz-beta',
  health: 'up',
  rttMs: 45,
  ts: Date.now()
});
```

### 4. Query Mesh State
```bash
# List all peers
curl https://apimesh-vpxyxgcfbq-uc.a.run.app/peers

# List links
curl https://apimesh-vpxyxgcfbq-uc.a.run.app/links

# Get latest snapshot
curl https://apimesh-vpxyxgcfbq-uc.a.run.app/snapshot
```

### 5. View Mesh Dashboard
Navigate to: `/ops/mesh` in your F0 web app

---

## 📈 How It Works

### Gossip Replication (CRDT)
1. **Ingest** → Peers send gossip envelopes via `meshGossip`
2. **Store** → Envelopes saved to `mesh_gossip` collection
3. **Reduce** → `meshReduce` merges gossip every 5 min using LWW (Last-Write-Wins)
4. **Snapshot** → Latest state saved to `mesh_snapshots/latest`

### Trust Propagation (PageRank)
1. **Graph** → Build adjacency from peers + healthy links
2. **Iterate** → 20 iterations of PageRank with 0.15 teleport
3. **Update** → Write trust scores (0-1) back to `mesh_peers`
4. **Schedule** → Runs every 30 minutes via `trustFlow`

### Peer Discovery
1. **Beacon** → Peers POST to `meshBeacon` with ID + pubKey
2. **Register** → Peer saved to `mesh_peers` with default trust=0.5
3. **Update** → `lastSeenAt` refreshed on every gossip/beacon

---

## 🎛️ Configuration

### CRDT Parameters
- **Merge Strategy**: Last-Write-Wins (LWW) by timestamp
- **Reduction Frequency**: Every 5 minutes
- **Gossip TTL**: 24 hours (auto-cleanup)
- **DAG Parents**: Optional ancestry tracking

### PageRank Parameters
- **Damping Factor**: 0.85 (1 - teleport probability)
- **Teleport**: 0.15 (random jump probability)
- **Iterations**: 20 (convergence)
- **Default Trust**: 0.5 (new peers)

### Gossip Kinds
| Kind | Description |
|------|-------------|
| `proposal` | Consensus proposals |
| `vote` | Peer votes on proposals |
| `risk` | Risk scores/signals |
| `telemetry` | Performance metrics |

---

## 📝 Implementation Files

### Types
- [functions/src/types/mesh.ts](functions/src/types/mesh.ts:1) - Mesh, link, gossip types

### Core Logic
- [functions/src/mesh/crdt.ts](functions/src/mesh/crdt.ts:1) - LWW merge functions
- [functions/src/mesh/trustPropagation.ts](functions/src/mesh/trustPropagation.ts:1) - PageRank algorithm
- [functions/src/mesh/transport.ts](functions/src/mesh/transport.ts:1) - WebRTC stubs (MVP)

### HTTPS Endpoints
- [functions/src/https/meshBeacon.ts](functions/src/https/meshBeacon.ts:1) - Peer registration
- [functions/src/https/meshGossip.ts](functions/src/https/meshGossip.ts:1) - Gossip ingestion

### Schedulers
- [functions/src/schedules/meshReduce.ts](functions/src/schedules/meshReduce.ts:1) - CRDT reduction
- [functions/src/schedules/trustFlow.ts](functions/src/schedules/trustFlow.ts:1) - Trust propagation

### API & UI
- [functions/src/api/mesh.ts](functions/src/api/mesh.ts:1) - Mesh query API
- [apps/web/app/ops/mesh/page.tsx](apps/web/app/ops/mesh/page.tsx:1) - Dashboard UI

### Security
- [firestore.rules](firestore.rules:408-429) - Phase 43 security rules
- [firestore.indexes.json](firestore.indexes.json:465-492) - 2 composite indexes

---

## ✅ Verification Checklist

- [x] All 5 functions deployed successfully
- [x] Firestore rules updated with 4 new collections
- [x] 2 composite indexes created
- [x] HTTPS endpoints accessible
- [x] Schedulers configured correctly
- [x] Security model: admin/service only
- [x] Types, CRDT, and trust propagation implemented
- [x] Mesh UI dashboard created
- [x] Deployment script created

---

## 🔄 Integration with Previous Phases

**Phase 42 (Consensus)** → **Phase 43 (Mesh)**
- Consensus proposals gossiped via mesh
- Votes distributed through gossip protocol
- Trust scores influence consensus weight

**Phase 41 (Federation)** → **Phase 43 (Mesh)**
- `fed_peers` + `mesh_peers` = full peer registry
- Telemetry published via gossip
- Policy sync over mesh links

**Phase 40 (Autonomous)** → **Phase 43 (Mesh)**
- Deploy plans gossiped to all peers
- Economic optimization proposals distributed
- Bus messages routed via mesh

**Phase 38 (Knowledge Graph)** → **Phase 43 (Mesh)**
- Mesh topology → graph edges
- Trust scores → node weights
- Gossip DAG → temporal graph

---

## 🎉 Success Metrics

After 24 hours of operation, expect:
- **Peers**: 3-5 registered peers
- **Links**: 5-10 mesh links (healthy/degraded)
- **Gossip**: 50-100 messages exchanged
- **Snapshot**: Reduced state with 10-30 objects
- **Trust**: All peers scored (updated every 30 min)

---

## 📚 Next Steps

### Phase 43.1: WebRTC Transport
- [ ] Implement real WebRTC in Cloud Run workers
- [ ] Add ICE/TURN server support
- [ ] Bidirectional datachannels
- [ ] Auto-link discovery

### Phase 43.2: Weighted Gossip
- [ ] Trust-based gossip propagation
- [ ] Bloom filters for deduplication
- [ ] Selective forwarding
- [ ] Bandwidth optimization

### Phase 43.3: 3D Globe Visualization
- [ ] Integrate Cesium/Three.js
- [ ] Geographic link rendering
- [ ] Real-time health heatmap
- [ ] Interactive peer explorer

### Phase 43.4: Advanced CRDT
- [ ] LWW-Element-Set for conflicts
- [ ] RGA for ordered lists
- [ ] Causal ordering (vector clocks)
- [ ] Delta-state CRDTs

---

**Phase 43 is now LIVE and ready for P2P mesh networking!** 🚀

Monitor via `/ops/mesh` dashboard or Firestore collections.
