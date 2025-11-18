/**
 * Phase 40 - Auto-Verify & Recovery
 * Verifies deployed policies and auto-rollbacks on regressions
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const autoVerify = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[autoVerify] Starting verification and recovery scan');

      const plans = await db
        .collection('ops_deploy_plans')
        .orderBy('ts', 'desc')
        .limit(20)
        .get();

      for (const p of plans.docs) {
        const plan: any = p.data();
        const tgt = plan.target || {};

        if (tgt.kind !== 'policy') continue;
        if (plan.result) continue; // Already finalized

        // Read latest metrics
        const winSnap = await db.collection('ops_stats').doc('Router:1h').get();
        const s: any = winSnap.exists ? winSnap.data() : {};

        const avgReward = s.avgReward ?? 0.6;
        const p95Latency = s.p95Latency ?? 5000;

        const ok = avgReward >= 0.55 && p95Latency <= 4000;

        if (ok) {
          await db
            .collection('ops_deploy_plans')
            .doc(plan.id)
            .update({ result: 'success' });

          // Log to audit
          await db.collection('ops_audit').add({
            ts: Date.now(),
            actor: 'auto-verify',
            action: 'verify_success',
            policyId: tgt.id,
            version: tgt.version,
            metrics: { avgReward, p95Latency },
          });

          console.log(`[autoVerify] Plan ${plan.id} verified successfully`);
          continue;
        }

        // Auto rollback to previous active version
        console.log(`[autoVerify] Metrics failed for ${plan.id}, rolling back`);

        const prevVersion = plan.prevVersion || '1.0.0';

        try {
          await db
            .collection('ops_policies')
            .doc(`${tgt.id}@${prevVersion}`)
            .update({ status: 'active' });

          await db
            .collection('ops_policies')
            .doc(`${tgt.id}@${tgt.version}`)
            .update({ status: 'draft' });

          await db
            .collection('ops_deploy_plans')
            .doc(plan.id)
            .update({ result: 'rolled_back' });

          // Log to audit
          await db.collection('ops_audit').add({
            ts: Date.now(),
            actor: 'auto-verify',
            action: 'rollback',
            policyId: tgt.id,
            version: tgt.version,
            prevVersion,
            reason: `Metrics failed: reward=${avgReward}, latency=${p95Latency}`,
          });

          console.log(`[autoVerify] Rolled back ${tgt.id}@${tgt.version} to ${prevVersion}`);
        } catch (e: any) {
          console.error(`[autoVerify] Rollback failed for ${plan.id}:`, e);
        }
      }

      console.log('[autoVerify] Completed successfully');
    } catch (error) {
      console.error('[autoVerify] Error:', error);
      throw error;
    }
  }
);
