/**
 * Phase 40 - Auto-Deploy Agent
 * Autonomous deployment pipeline with governance gates
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { evaluateActivation } from '../governance/evaluator';

const db = admin.firestore();

async function logStage(
  planId: string,
  name: string,
  status: 'pending' | 'ok' | 'fail',
  log?: string
) {
  const ref = db.collection('ops_deploy_plans').doc(planId);
  await ref.set({ planId, ts: Date.now() }, { merge: true });
  await ref.update({
    stages: admin.firestore.FieldValue.arrayUnion({
      name,
      ts: Date.now(),
      status,
      log,
    }),
  });
}

export const autoDeploy = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[autoDeploy] Starting autonomous deployment scan');

      // Pick drafts that passed adaptive suggestion but not yet evaluated/activated
      const drafts = await db
        .collection('ops_policies')
        .where('status', '==', 'draft')
        .limit(3)
        .get();

      console.log(`[autoDeploy] Found ${drafts.size} draft policies`);

      for (const d of drafts.docs) {
        const pol: any = d.data();
        const planId = `dp_${d.id}`;

        await logStage(planId, 'plan', 'pending', `Draft ${pol.id}@${pol.version}`);

        // Governance gate
        const decision = await evaluateActivation({
          policyId: pol.id,
          version: pol.version,
          diff: pol._diff || {},
        });

        await db
          .collection('ops_deploy_plans')
          .doc(planId)
          .set(
            {
              id: planId,
              ts: Date.now(),
              actor: 'auto-deploy',
              target: { kind: 'policy', id: pol.id, version: pol.version },
              reason: 'adaptive improvement candidate',
              guard: {
                allow: decision.allow,
                hold: decision.hold,
                reasons: decision.reasons,
              },
              stages: [],
            },
            { merge: true }
          );

        if (!decision.allow || decision.hold) {
          await logStage(
            planId,
            'plan',
            'fail',
            `Blocked/hold: ${decision.reasons?.join(', ')}`
          );
          continue; // stop here
        }

        await logStage(planId, 'build', 'ok', 'No build for policy params');

        // Deploy (activate)
        try {
          await db
            .collection('ops_policies')
            .doc(`${pol.id}@${pol.version}`)
            .update({ status: 'active' });
          await logStage(planId, 'deploy', 'ok', 'Activated policy');
        } catch (e: any) {
          await logStage(planId, 'deploy', 'fail', e?.message || 'error');
          continue;
        }

        // Verify (watch reward/latency over 15 min window)
        await logStage(planId, 'verify', 'pending', 'Awaiting metrics');
        // mark as done; a separate verifier will finalize
      }

      console.log('[autoDeploy] Completed successfully');
    } catch (error) {
      console.error('[autoDeploy] Error:', error);
      throw error;
    }
  }
);
