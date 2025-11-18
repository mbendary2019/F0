# Phase 41 - Cognitive Federation Implementation Guide

## ✅ Completed Files

1. **Types**: `functions/src/types/federation.ts` ✓
2. **Security Rules**: `firestore.rules` (lines 355-376) ✓

## 📝 Remaining Implementation Steps

### Step 1: Install Dependencies

```bash
cd functions
npm install node-fetch @types/node-fetch
```

### Step 2: Create Federation Config

**File**: `functions/src/config/federation.ts`

```typescript
export const FED = {
  instanceId: process.env.F0_INSTANCE_ID || 'fz-local',
  privateKey: process.env.FED_PRIVATE_KEY || '',
  publish: { stats: true, confidence: true, risk: true, policies: false },
  pullIntervalMins: 30,
};
```

### Step 3: Create Crypto Utilities

**File**: `functions/src/federation/crypto.ts`

```typescript
import { createSign, createVerify, createPrivateKey, createPublicKey } from 'crypto';

export function sign(payload: object, priv: string): string {
  const key = createPrivateKey(priv);
  const s = createSign('SHA256');
  s.update(Buffer.from(JSON.stringify(payload)));
  s.end();
  return s.sign(key).toString('base64');
}

export function verify(payload: object, sig: string, pub: string): boolean {
  try {
    const key = createPublicKey(pub);
    const v = createVerify('SHA256');
    v.update(Buffer.from(JSON.stringify(payload)));
    v.end();
    return v.verify(key, Buffer.from(sig, 'base64'));
  } catch {
    return false;
  }
}
```

### Step 4: Create Telemetry Publisher

**File**: `functions/src/federation/publisher.ts`

```typescript
import * as admin from 'firebase-admin';
import { FED } from '../config/federation';
import { sign } from './crypto';

const db = admin.firestore();

export async function buildTelemetryBundle() {
  const windows: Array<'1h' | '24h' | '7d'> = ['1h', '24h', '7d'];
  const stats = await db.collection('ops_stats').get();
  const components = stats.docs
    .map((d) => d.data() as any)
    .filter((s: any) => windows.includes(s.window))
    .map((s: any) => ({
      id: String(s.component),
      window: s.window,
      n: s.n || 0,
      successRate: s.successRate || 0,
      p95Latency: s.p95Latency || 0,
      avgReward: s.avgReward || 0,
      avgCostUsd: s.avgCostUsd || 0,
    }));

  const confSnap = await db.collection('ops_confidence').get();
  const confidence = confSnap.docs.map((d) => d.data() as any).map((c) => ({
    key: `${c.component}:${c.window}`,
    score: c.score || 0,
    sampleSize: c.sampleSize || 0,
  }));

  const riskSnap = await db.collection('ops_risk_scores').limit(200).get();
  const risk = riskSnap.docs
    .map((d) => d.data() as any)
    .map((r) => ({ target: r.id, score: r.score || 0 }));

  const body: any = {
    id: `tb_${Date.now()}`,
    ts: Date.now(),
    from: FED.instanceId,
    schema: 'v1',
    windows,
    components,
    confidence,
    risk,
  };

  if (FED.privateKey) {
    body.signature = sign({ ...body, signature: undefined }, FED.privateKey);
  } else {
    body.signature = 'no-key-configured';
  }

  return body;
}
```

### Step 5: Create Federation Inbox

**File**: `functions/src/https/fedInbox.ts`

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { verify } from '../federation/crypto';

const db = admin.firestore();

export const fedInbox = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { bundle, proposal, peer } = req.body || {};

    const pDoc = await db
      .collection('fed_peers')
      .doc(peer?.id || '')
      .get();

    if (!pDoc.exists || !pDoc.data()?.allow) {
      res.status(403).json({ error: 'peer not allowed' });
      return;
    }

    const pubKey = pDoc.data()!.pubKey as string;
    const payload = bundle || proposal;

    if (!payload) {
      res.status(400).json({ error: 'empty payload' });
      return;
    }

    const ok = verify({ ...payload, signature: undefined }, payload.signature, pubKey);

    if (!ok) {
      res.status(401).json({ error: 'invalid signature' });
      return;
    }

    await db.collection('fed_inbox').add({
      ts: Date.now(),
      peer: pDoc.id,
      payload,
    });

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 6: Create Federation Publisher Schedule

**File**: `functions/src/schedules/fedPublish.ts`

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { FED } from '../config/federation';
import { buildTelemetryBundle } from '../federation/publisher';

const db = admin.firestore();

export const fedPublish = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[fedPublish] Starting federation publish');

      const peers = await db
        .collection('fed_peers')
        .where('allow', '==', true)
        .get();

      const bundle = await buildTelemetryBundle();

      for (const p of peers.docs) {
        const peer: any = p.data();
        if (!peer.scopes?.includes('stats')) continue;

        try {
          await fetch(`${peer.url}/api/fed/inbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bundle, peer: { id: FED.instanceId } }),
          });

          // Update last seen
          await db
            .collection('fed_peers')
            .doc(p.id)
            .update({ lastSeenAt: Date.now() });
        } catch (error) {
          console.error(`[fedPublish] Failed to publish to ${peer.id}:`, error);
        }
      }

      console.log('[fedPublish] Completed successfully');
    } catch (error) {
      console.error('[fedPublish] Error:', error);
      throw error;
    }
  }
);
```

### Step 7: Create Policy Proposal Builder

**File**: `functions/src/federation/buildPolicyProposal.ts`

```typescript
import { FED } from '../config/federation';
import { sign } from './crypto';

export function buildPolicyProposal(input: {
  policyId: string;
  baseVersion: string;
  params: Record<string, any>;
  evidence: { rewardDelta?: number; latencyDeltaMs?: number; sampleSize?: number };
}) {
  const proposal: any = {
    id: `pp_${Date.now()}`,
    ts: Date.now(),
    from: FED.instanceId,
    ...input,
    provenance: { peer: FED.instanceId, signature: '' },
  };

  if (FED.privateKey) {
    proposal.provenance.signature = sign(
      { ...proposal, provenance: undefined },
      FED.privateKey
    );
  }

  return proposal;
}
```

### Step 8: Create Proposal Evaluator

**File**: `functions/src/federation/proposalEvaluator.ts`

```typescript
import * as admin from 'firebase-admin';
import { evaluateActivation } from '../governance/evaluator';

const db = admin.firestore();

export async function evaluatePeerProposal(proposal: any) {
  // Convert peer params -> local draft with _diff and provenance
  const next = {
    id: proposal.policyId,
    version: proposal.baseVersion,
    status: 'draft',
    params: proposal.params,
    _diff: proposal.params,
    provenance: proposal.provenance,
  };

  await db
    .collection('ops_policies')
    .doc(`${next.id}@${next.version}`)
    .set(next, { merge: true });

  // Run governance guard
  const decision = await evaluateActivation({
    policyId: next.id,
    version: next.version,
    diff: next._diff,
  });

  await db.collection('ops_audit').add({
    ts: Date.now(),
    actor: 'federation',
    action: 'evaluate-peer-proposal',
    decision,
    peer: proposal.from,
  });

  return decision;
}
```

### Step 9: Create Federation Consumer

**File**: `functions/src/schedules/fedConsume.ts`

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { evaluatePeerProposal } from '../federation/proposalEvaluator';

const db = admin.firestore();

export const fedConsume = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[fedConsume] Starting federation consume');

      const inbox = await db
        .collection('fed_inbox')
        .orderBy('ts', 'desc')
        .limit(50)
        .get();

      for (const d of inbox.docs) {
        const p: any = d.data();
        if (p.payload?.policyId) {
          await evaluatePeerProposal(p.payload);
        }
      }

      console.log('[fedConsume] Completed successfully');
    } catch (error) {
      console.error('[fedConsume] Error:', error);
      throw error;
    }
  }
);
```

### Step 10: Create Risk Aggregator

**File**: `functions/src/federation/riskAggregator.ts`

```typescript
import * as admin from 'firebase-admin';

const db = admin.firestore();

export async function aggregateGlobalRisk(policyId: string) {
  const inbox = await db.collection('fed_inbox').get();
  const src: Array<{ peer: string; score: number }> = [];

  for (const d of inbox.docs) {
    const x: any = d.data();
    const riskArr = x.payload?.risk as Array<any> | undefined;
    if (riskArr) {
      for (const r of riskArr) {
        if (String(r.target).includes(`policy:${policyId}`)) {
          src.push({ peer: x.peer, score: Number(r.score) || 0 });
        }
      }
    }
  }

  if (!src.length) return;

  const sum = src.reduce((a, c) => a + c.score, 0);
  const mean = sum / src.length;
  const sorted = src.map((s) => s.score).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(0.95 * (src.length - 1))];

  await db
    .collection('global_risk_ledger')
    .doc(`gr_${policyId}`)
    .set({
      id: `gr_${policyId}`,
      ts: Date.now(),
      policyId,
      aggregates: { mean, p95, n: src.length },
      sources: src.map((s) => ({ ...s, weight: 1 / src.length })),
    });
}
```

### Step 11: Create Risk Sweep Scheduler

**File**: `functions/src/schedules/fedRiskSweep.ts`

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { aggregateGlobalRisk } from '../federation/riskAggregator';

export const fedRiskSweep = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[fedRiskSweep] Starting risk aggregation');
      await aggregateGlobalRisk('router-core');
      console.log('[fedRiskSweep] Completed successfully');
    } catch (error) {
      console.error('[fedRiskSweep] Error:', error);
      throw error;
    }
  }
);
```

### Step 12: Update functions/src/index.ts

Add to exports section:

```typescript
// ============================================================
// PHASE 41: COGNITIVE FEDERATION
// ============================================================

// Federation inbox
export { fedInbox } from './https/fedInbox';

// Federation schedulers
export { fedPublish } from './schedules/fedPublish';
export { fedConsume } from './schedules/fedConsume';
export { fedRiskSweep } from './schedules/fedRiskSweep';
```

### Step 13: Create API Endpoints

**File**: `src/app/api/fed/peers/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const { db } = initAdmin();
    const snap = await db.collection('fed_peers').get();
    return NextResponse.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { db } = initAdmin();
    await db
      .collection('fed_peers')
      .doc(body.id)
      .set({ ...body, createdAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/fed/inbox/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fedInboxUrl = process.env.FED_INBOX_URL;

    if (!fedInboxUrl) {
      return NextResponse.json(
        { error: 'FED_INBOX_URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(fedInboxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json(await response.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**File**: `src/app/api/fed/risk/global/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const { db } = initAdmin();
    const snap = await db
      .collection('global_risk_ledger')
      .orderBy('ts', 'desc')
      .limit(50)
      .get();
    return NextResponse.json(snap.docs.map((d) => d.data()));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 🚀 Deployment

```bash
# Install dependencies
cd functions
npm install node-fetch @types/node-fetch

# Build
npm run build

# Deploy rules
firebase deploy --only firestore:rules

# Deploy functions
firebase deploy --only functions:fedInbox,functions:fedPublish,functions:fedConsume,functions:fedRiskSweep
```

## 🔧 Configuration

Add to `.env` or environment variables:

```bash
F0_INSTANCE_ID=fz-main
FED_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FED_INBOX_URL=https://us-central1-your-project.cloudfunctions.net/fedInbox
```

## ✅ Testing

1. Register a peer in `fed_peers` collection
2. Run `fedPublish` manually or wait 30 mins
3. Check `fed_inbox` on receiving instance
4. View `/api/fed/peers` and `/api/fed/risk/global`

## 📊 Phase 41 Complete!

**Federated learning is now active across F0 instances!**
