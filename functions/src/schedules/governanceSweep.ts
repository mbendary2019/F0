/**
 * Phase 39 - Governance Sweep Scheduler
 * Evaluates draft policies and computes risk scores every 15 minutes
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { evaluateActivation } from '../governance/evaluator';

const db = admin.firestore();

export const governanceSweep = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[governanceSweep] Starting governance sweep');

      const drafts = await db
        .collection('ops_policies')
        .where('status', '==', 'draft')
        .get();

      for (const doc of drafts.docs) {
        const v: any = doc.data();
        const diff = v._diff || {};
        const decision = await evaluateActivation({
          policyId: v.id,
          version: v.version,
          diff,
        });

        // Write risk score
        await db
          .collection('ops_risk_scores')
          .doc(`policy:${v.id}@${v.version}`)
          .set({
            id: `policy:${v.id}@${v.version}`,
            target: `policy_version:${v.id}@${v.version}`,
            kind: 'policy',
            score: decision.allow ? (decision.hold ? 0.5 : 0.2) : 0.85,
            breakdown: { governance: decision.allow ? 0.2 : 0.85 },
            window: '7d',
            ts: Date.now(),
          });
      }

      console.log('[governanceSweep] Completed successfully');
    } catch (error) {
      console.error('[governanceSweep] Error:', error);
      throw error;
    }
  }
);
