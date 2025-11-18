# Phase 42 - Federated Consensus & Collective Optimization ✅

**Deployment Status**: COMPLETE
**Deployment Date**: 2025-10-12
**Functions Deployed**: 10

---

## 🎯 Deployed Functions

### HTTPS Endpoints
1. **fedVote** - Receive votes from federation peers
   - URL: https://fedvote-vpxyxgcfbq-uc.a.run.app
   - Purpose: Accept/reject/abstain votes on consensus proposals

2. **apiConsensus** - Consensus management API
   - URL: https://apiconsensus-vpxyxgcfbq-uc.a.run.app
   - Endpoints:
     - GET /api/consensus - List proposals (filter by status, policyId)
     - POST /api/consensus - Create new proposal

3. **apiEconomics** - Federated economic optimization API
   - URL: https://apieconomics-vpxyxgcfbq-uc.a.run.app
   - Endpoints:
     - GET /api/economics - List optimization runs
     - POST /api/economics - Create objective

4. **apiTrust** - Peer trust scores API
   - URL: https://apitrust-vpxyxgcfbq-uc.a.run.app
   - Endpoints:
     - GET /api/trust - Get trust scores (filter by peer, minScore)

5. **apiIncentives** - Incentive credits and leaderboard API
   - URL: https://apiincentives-vpxyxgcfbq-uc.a.run.app
   - Endpoints:
     - GET /api/incentives - Get credits (filter by peer, action)
     - GET /api/incentives/leaderboard - Daily top 10

### Scheduled Functions
6. **consensusSweep** - Check proposals for quorum and timeout
   - Schedule: Every 10 minutes
   - Purpose: Approve/reject/expire proposals based on votes

7. **consensusApply** - Apply approved proposals to system
   - Schedule: Every 5 minutes
   - Purpose: Create new policy versions from consensus

8. **fedEconomics** - Multi-objective optimization
   - Schedule: Every 60 minutes
   - Purpose: Analyze telemetry, generate candidates, submit proposals

9. **trustSweep** - Calculate peer trust scores
   - Schedule: Every 4 hours
   - Purpose: Score peers on uptime, proposals, voting accuracy, contributions

10. **incentives** - Daily incentive aggregation
    - Schedule: Every 24 hours
    - Purpose: Award credits, generate leaderboard, bonus for high performers

---

## 📊 Firestore Collections

### Phase 42 Collections (New)
- **consensus_proposals** - Quorum-based voting on policy changes
- **consensus_votes** - Individual peer votes (audit trail)
- **fed_economics** - Economic optimization runs
- **incentive_credits** - Credit ledger for peer contributions
- **trust_scores** - Peer reputation scores (0-1)
- **incentive_reports** - Daily aggregated reports per peer
- **incentive_leaderboard** - Top 10 contributors daily

### Indexes Created
- `consensus_proposals` by (status, ts) and (policyId, ts)
- `fed_economics` by (objective, ts)
- `trust_scores` by (peer, ts)

---

## 🔐 Security Model

All Phase 42 collections use service-only writes:
```rules
match /consensus_proposals/{id} {
  allow create: if isService();
  allow update: if isService(); // For vote updates
  allow read: if isService() || isAdmin();
}
```

Federation peers must be registered in `fed_peers` collection with `allow: true`.

---

## 🚀 Quick Start

### 1. Register Federation Peer
```javascript
db.collection('fed_peers').doc('peer1').set({
  id: 'peer1',
  url: 'https://peer1.example.com',
  pubKey: 'ed25519_public_key_here',
  role: 'both', // publisher + subscriber
  scopes: ['stats', 'policies', 'risk'],
  allow: true,
  createdAt: Date.now(),
});
```

### 2. Create Consensus Proposal
```bash
curl -X POST https://apiconsensus-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "policyId": "router-core",
    "baseVersion": "1.0.0",
    "params": {
      "modelWeights": {
        "gpt-5": 0.5,
        "claude": 0.3,
        "gemini": 0.2
      }
    },
    "from": "peer1",
    "quorum": 0.67,
    "ttlMs": 3600000,
    "evidence": {
      "rewardDelta": 0.05,
      "sampleSize": 1000
    }
  }'
```

### 3. Cast Vote
```bash
curl -X POST https://fedvote-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "cp_1234567890",
    "peer": "peer1",
    "vote": "accept",
    "reason": "Improves latency by 15%",
    "signature": "ed25519_signature_here"
  }'
```

### 4. Check Proposal Status
```bash
curl https://apiconsensus-vpxyxgcfbq-uc.a.run.app?status=open
```

### 5. View Trust Scores
```bash
curl https://apitrust-vpxyxgcfbq-uc.a.run.app?minScore=0.5
```

### 6. Check Incentive Leaderboard
```bash
curl https://apiincentives-vpxyxgcfbq-uc.a.run.app/leaderboard
```

---

## 📈 How It Works

### Consensus Flow
1. **Proposal Created** → `consensus_proposals` (status: open)
2. **Peers Vote** → Votes added to proposal via `fedVote` endpoint
3. **consensusSweep** (every 10 min) → Checks quorum
   - If ≥⅔ accept: status → approved
   - If ≥⅔ reject: status → rejected
   - If expired (>1h): status → expired
4. **consensusApply** (every 5 min) → Creates new policy version
   - Marks proposal as applied
   - Awards 5 credits to proposer

### Economic Optimization Flow
1. **fedEconomics** (every 60 min) → Analyzes telemetry from all peers
2. Generates candidates (e.g., boost gpt-5, reduce cost)
3. Picks winner by multi-objective score: `0.5*reward - 0.3*latency - 0.2*cost`
4. Submits consensus proposal for winner
5. Waits for peer votes

### Trust & Incentives Flow
1. **trustSweep** (every 4 hours) → Calculates peer trust:
   - 20% uptime (last seen < 24h)
   - 30% good proposals ratio (approved/total)
   - 30% voting accuracy (aligned with outcome)
   - 20% contribution frequency (telemetry publishes)
2. Auto-disables peers with score < 0.3 (after 5+ proposals)
3. **incentives** (daily) → Aggregates credits by action:
   - `telemetry_publish`: 1 credit
   - `policy_proposal`: 2 credits
   - `vote_cast`: 1 credit
   - `consensus_reached`: 5 credits
   - `improvement_validated`: 10 credits
4. Awards 10 bonus credits to peers with ≥20 daily credits
5. Publishes daily leaderboard (top 10)

---

## 🎛️ Configuration

### Environment Variables
- `FED_PEER_ID` - This instance's peer ID (default: "local")

### Consensus Defaults
- **Quorum**: 0.67 (⅔ majority)
- **TTL**: 3600000 ms (1 hour)
- **Retry**: 2 attempts

### Trust Thresholds
- **Auto-disable**: score < 0.3 (after 5+ proposals)
- **High trust**: score ≥ 0.7
- **Medium trust**: 0.5 ≤ score < 0.7
- **Low trust**: score < 0.5

### Incentive Credits
| Action | Credits |
|--------|---------|
| telemetry_publish | 1 |
| policy_proposal | 2 |
| vote_cast | 1 |
| consensus_reached | 5 |
| improvement_validated | 10 |
| High daily contribution (≥20) | +10 bonus |

---

## 📝 Implementation Files

### Types
- [functions/src/types/consensus.ts](functions/src/types/consensus.ts) - Core types

### Core Logic
- [functions/src/consensus/builder.ts](functions/src/consensus/builder.ts) - Proposal creation & voting

### HTTPS Endpoints
- [functions/src/https/fedVote.ts](functions/src/https/fedVote.ts)
- [functions/src/api/consensus.ts](functions/src/api/consensus.ts)
- [functions/src/api/economics.ts](functions/src/api/economics.ts)
- [functions/src/api/trust.ts](functions/src/api/trust.ts)
- [functions/src/api/incentives.ts](functions/src/api/incentives.ts)

### Schedulers
- [functions/src/schedules/consensusSweep.ts](functions/src/schedules/consensusSweep.ts)
- [functions/src/schedules/consensusApply.ts](functions/src/schedules/consensusApply.ts)
- [functions/src/schedules/fedEconomics.ts](functions/src/schedules/fedEconomics.ts)
- [functions/src/schedules/trustSweep.ts](functions/src/schedules/trustSweep.ts)
- [functions/src/schedules/incentives.ts](functions/src/schedules/incentives.ts)

### Security
- [firestore.rules](firestore.rules) - Lines 378-406 (Phase 42 section)
- [firestore.indexes.json](firestore.indexes.json) - Lines 409-464 (4 new indexes)

---

## ✅ Verification Checklist

- [x] All 10 functions deployed successfully
- [x] Firestore rules updated with 5 new collections
- [x] 4 composite indexes created
- [x] HTTPS endpoints accessible
- [x] Schedulers configured with correct cadences
- [x] Security model: service-only writes, admin reads
- [x] Types, builders, and API endpoints in place
- [x] Deployment script created

---

## 🔄 Integration with Previous Phases

**Phase 41 (Federation)** → **Phase 42 (Consensus)**
- Uses `fed_peers` for peer registry
- Uses `fed_inbox` telemetry for economic optimization
- Publishes consensus results back to federation

**Phase 40 (Autonomous)** → **Phase 42 (Consensus)**
- Economic optimizer feeds candidates to consensus
- Auto-deploy respects consensus-approved policies

**Phase 39 (Governance)** → **Phase 42 (Consensus)**
- Consensus proposals pass through Policy Guard
- Risk scores influence trust scores

**Phase 38 (Knowledge Graph)** → **Phase 42 (Consensus)**
- Graph edges track policy lineage (DERIVED_FROM)
- Consensus decisions become graph nodes

---

## 🎉 Success Metrics

After 24 hours of operation, expect:
- **Proposals**: 2-5 open proposals (economic optimizations)
- **Votes**: 10-20 votes cast (if 3+ peers registered)
- **Consensus**: 1-2 policies applied via consensus
- **Trust Scores**: All active peers scored (run every 4h)
- **Incentives**: Daily leaderboard published
- **Credits**: 50-100 credits distributed across peers

---

## 📚 Next Steps

### Phase 43 (Future): Advanced Consensus
- [ ] Implement Ed25519 signature verification
- [ ] Add weighted voting (trust-based)
- [ ] Byzantine fault tolerance (BFT)
- [ ] Sharded consensus for scale

### Phase 44 (Future): Global Coordination
- [ ] Cross-region consensus
- [ ] Multi-datacenter quorum
- [ ] Conflict resolution for divergent policies
- [ ] Real-time federation dashboard

---

**Phase 42 is now LIVE and ready for federated consensus!** 🚀

All functions are operational. Monitor via Cloud Functions logs or Firestore collections.
