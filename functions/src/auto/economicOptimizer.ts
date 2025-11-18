/**
 * Phase 40 - Economic Optimizer
 * Multi-objective optimization: reward, cost, latency, risk
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const economicOptimizer = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[economicOptimizer] Starting economic optimization');

      const cfgSnap = await db.collection('ops_econ_objectives').doc('router').get();
      const o: any = cfgSnap.exists
        ? cfgSnap.data()
        : {
            objective: 'balanced',
            weights: { cost: 0.25, latency: 0.25, reward: 0.4, risk: 0.1 },
          };

      const statsSnap = await db.collection('ops_stats').doc('Router:24h').get();
      const s: any = statsSnap.exists ? statsSnap.data() : {};

      const riskSnap = await db
        .collection('ops_risk_scores')
        .doc('policy:router-core@current')
        .get();
      const risk = riskSnap.exists ? ((riskSnap.data() as any)?.score ?? 0.2) : 0.2;

      // Simple linear objective: maximize R - w_c*C - w_l*L - w_r*Risk
      const R = s.avgReward ?? 0.6;
      const C = s.avgCostUsd ?? 0.08;
      const L = (s.p95Latency ?? 4000) / 4000; // normalize
      const { cost = 0.25, latency = 0.25, reward = 0.4, risk: wr = 0.1 } = o.weights || {};

      const score = reward * R - cost * C - latency * L - wr * risk;

      await db
        .collection('ops_econ_objectives')
        .doc('router')
        .set({ ...o, lastScore: score, ts: Date.now() }, { merge: true });

      // Log to audit
      await db.collection('ops_audit').add({
        ts: Date.now(),
        actor: 'economic-optimizer',
        action: 'compute_score',
        component: 'router',
        score,
        inputs: { R, C, L, risk },
      });

      console.log(
        `[economicOptimizer] Computed score: ${score.toFixed(3)} (R=${R.toFixed(2)}, C=${C.toFixed(3)}, L=${L.toFixed(2)}, risk=${risk.toFixed(2)})`
      );
    } catch (error) {
      console.error('[economicOptimizer] Error:', error);
      throw error;
    }
  }
);
