/**
 * Phase 42 - Federated Economic Optimizer
 * Runs multi-objective optimization across federation to find optimal policy params
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FederatedEconomics } from '../types/consensus';
import { buildProposal } from '../consensus/builder';
import { v4 as uuid } from 'uuid';

const db = admin.firestore();

export const fedEconomics = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[fedEconomics] Starting federated economic optimization...');

      // Get telemetry from all peers
      const inboxSnap = await db
        .collection('fed_inbox')
        .where('kind', '==', 'telemetry')
        .orderBy('ts', 'desc')
        .limit(100)
        .get();

      console.log(`[fedEconomics] Analyzing ${inboxSnap.size} telemetry bundles`);

      // Aggregate metrics by component
      const componentMetrics = new Map<
        string,
        {
          n: number;
          totalReward: number;
          totalLatency: number;
          totalCost: number;
          peers: Set<string>;
        }
      >();

      for (const doc of inboxSnap.docs) {
        const bundle = doc.data() as any;
        const from = bundle.from || 'unknown';

        for (const comp of bundle.components || []) {
          const key = `${comp.id}:${comp.window}`;
          const existing = componentMetrics.get(key) || {
            n: 0,
            totalReward: 0,
            totalLatency: 0,
            totalCost: 0,
            peers: new Set<string>(),
          };

          existing.n += comp.n || 0;
          existing.totalReward += (comp.avgReward || 0) * (comp.n || 0);
          existing.totalLatency += (comp.p95Latency || 0) * (comp.n || 0);
          existing.totalCost += (comp.avgCostUsd || 0) * (comp.n || 0);
          existing.peers.add(from);

          componentMetrics.set(key, existing);
        }
      }

      console.log(`[fedEconomics] Aggregated metrics for ${componentMetrics.size} components`);

      // Focus on router component for optimization
      const routerKey = 'router:24h';
      const routerMetrics = componentMetrics.get(routerKey);

      if (!routerMetrics || routerMetrics.n < 100) {
        console.log('[fedEconomics] Insufficient router data for optimization');
        return;
      }

      const avgReward = routerMetrics.totalReward / routerMetrics.n;
      const avgLatency = routerMetrics.totalLatency / routerMetrics.n;
      const avgCost = routerMetrics.totalCost / routerMetrics.n;

      console.log(
        `[fedEconomics] Router metrics: reward=${avgReward.toFixed(3)}, latency=${avgLatency.toFixed(0)}ms, cost=$${avgCost.toFixed(4)}`
      );

      // Multi-objective scoring: maximize reward, minimize latency & cost
      const weights = { reward: 0.5, latency: 0.3, cost: 0.2 };

      // Normalize and score current state (baseline)
      const baselineScore =
        weights.reward * avgReward -
        weights.latency * (avgLatency / 5000) - // normalize to 5s
        weights.cost * (avgCost / 0.01); // normalize to $0.01

      console.log(`[fedEconomics] Baseline score: ${baselineScore.toFixed(3)}`);

      // Generate candidate parameter adjustments
      const candidates = generateCandidates(avgReward, avgLatency, avgCost, weights);

      if (candidates.length === 0) {
        console.log('[fedEconomics] No improvement candidates generated');
        return;
      }

      // Pick best candidate
      const winner = candidates[0];

      console.log(
        `[fedEconomics] Winner: ${winner.policyId}@${winner.version} (score: ${winner.score.toFixed(3)})`
      );

      // Create FederatedEconomics record
      const fedEcon: FederatedEconomics = {
        id: uuid(),
        ts: Date.now(),
        objective: 'multi_objective',
        weights,
        constraints: [
          { param: 'modelWeights.gpt-5', min: 0.3, max: 0.8 },
          { param: 'modelWeights.claude', min: 0.1, max: 0.5 },
          { param: 'modelWeights.gemini', min: 0.1, max: 0.5 },
        ],
        candidates,
        winner: winner.policyId,
        appliedAt: Date.now(),
      };

      await db.collection('fed_economics').add(fedEcon);

      // Submit consensus proposal for winner
      const myPeerId = process.env.FED_PEER_ID || 'local';
      await buildProposal({
        policyId: winner.policyId,
        baseVersion: winner.version,
        params: winner.params,
        from: myPeerId,
        evidence: {
          rewardDelta: winner.score - baselineScore,
          sampleSize: routerMetrics.n,
        },
      });

      console.log('[fedEconomics] Submitted consensus proposal for economic optimization');
    } catch (error) {
      console.error('[fedEconomics] Error:', error);
      throw error;
    }
  }
);

function generateCandidates(
  avgReward: number,
  avgLatency: number,
  avgCost: number,
  weights: { reward: number; latency: number; cost: number }
): Array<{
  policyId: string;
  version: string;
  params: Record<string, any>;
  score: number;
  from: string;
}> {
  const candidates = [];
  const myPeerId = process.env.FED_PEER_ID || 'local';

  // Candidate 1: Boost high-reward, low-latency models
  candidates.push({
    policyId: 'router-core',
    version: '1.0.0',
    params: {
      modelWeights: {
        'gpt-5': 0.5,
        claude: 0.3,
        gemini: 0.2,
      },
    },
    score:
      weights.reward * (avgReward * 1.05) -
      weights.latency * (avgLatency * 0.95) / 5000 -
      weights.cost * (avgCost * 1.02) / 0.01,
    from: myPeerId,
  });

  // Candidate 2: Cost optimization
  candidates.push({
    policyId: 'router-core',
    version: '1.0.0',
    params: {
      modelWeights: {
        'gpt-5': 0.4,
        claude: 0.35,
        gemini: 0.25,
      },
    },
    score:
      weights.reward * (avgReward * 1.02) -
      weights.latency * (avgLatency * 1.0) / 5000 -
      weights.cost * (avgCost * 0.9) / 0.01,
    from: myPeerId,
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}
