/**
 * Auto-Documentation
 * Automatically documents policy changes and system evolution
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import type { AutoDocEntry } from './types';

/**
 * Generate auto-documentation
 * Runs every 24 hours
 */
export const autoDoc = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    console.log('[Auto-Doc] Starting documentation generation');

    const db = getFirestore();
    const now = Date.now();
    const timestamp = new Date(now).toISOString();

    try {
      // Fetch current state
      const policyDoc = await db.collection('rl_policy').doc('global').get();
      const policy = policyDoc.exists ? policyDoc.data() : {};

      const guardrailDoc = await db
        .collection('ops_policies')
        .doc('protected_targets')
        .get()
        .catch(() => null);
      const guardrails = guardrailDoc?.exists ? guardrailDoc.data() : {};

      // Get recent performance
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const outcomesSnap = await db
        .collection('rl_outcomes')
        .where('timestamp', '>=', dayAgo)
        .get()
        .catch(() => null);

      let avgReward = 0;
      let successCount = 0;
      const outcomeCount = outcomesSnap?.size || 0;

      outcomesSnap?.forEach(doc => {
        const data = doc.data();
        avgReward += Number(data.reward || 0);
        if ((data.reward || 0) > 0) successCount++;
      });

      avgReward = outcomeCount > 0 ? avgReward / outcomeCount : 0;
      const successRate = outcomeCount > 0 ? successCount / outcomeCount : 0;

      // Detect changes
      const changes: string[] = [];
      
      if (policy?.tuning?.updatedBy === 'system') {
        changes.push(`Policy auto-tuned: alpha=${(policy.tuning.alpha as number).toFixed(2)}, lr=${(policy.tuning.lr as number).toFixed(3)}`);
      }
      
      if (guardrails?.lastAdapt && (now - guardrails.lastAdapt) < 24 * 60 * 60 * 1000) {
        changes.push(`Guardrails adapted: ${guardrails.reason} (${guardrails.targets?.length || 0} protected targets)`);
      }

      if (policy?.championAt && (now - policy.championAt) < 24 * 60 * 60 * 1000) {
        changes.push(`New champion policy: ${policy.fromVersion} (score: ${(policy.championScore as number || 0).toFixed(2)})`);
      }

      // Create entry
      const entry: AutoDocEntry = {
        timestamp,
        policy: {
          alpha: policy?.tuning?.alpha,
          lr: policy?.tuning?.lr,
          updatedBy: policy?.tuning?.updatedBy
        },
        guardrails: {
          targets: guardrails?.targets,
          lastAdapt: guardrails?.lastAdapt,
          reason: guardrails?.reason,
          highRiskRate: guardrails?.highRiskRate
        },
        performance: {
          avgReward,
          decisions: outcomeCount,
          successRate,
          avgMttrMin: 0 // TODO: calculate from outcomes
        },
        changes
      };

      // Format as markdown
      const markdown = `
## ${timestamp.split('T')[0]}

**Policy:**
- Alpha: ${entry.policy.alpha?.toFixed(2) || 'N/A'}
- Learning Rate: ${entry.policy.lr?.toFixed(3) || 'N/A'}
- Updated By: ${entry.policy.updatedBy || 'N/A'}

**Guardrails:**
- Protected Targets: ${(entry.guardrails.targets || []).join(', ')}
- Last Adapted: ${entry.guardrails.lastAdapt ? new Date(entry.guardrails.lastAdapt).toLocaleString() : 'Never'}
- Reason: ${entry.guardrails.reason || 'N/A'}
- High Risk Rate: ${((entry.guardrails.highRiskRate || 0) * 100).toFixed(1)}%

**Performance (24h):**
- Avg Reward: ${entry.performance.avgReward?.toFixed(2) || '0.00'}
- Decisions: ${entry.performance.decisions || 0}
- Success Rate: ${((entry.performance.successRate || 0) * 100).toFixed(1)}%

**Changes:**
${changes.length > 0 ? changes.map(c => `- ${c}`).join('\n') : '- No changes'}

---
`;

      // Append to log
      const logRef = db.collection('auto_docs').doc('AUTO_POLICY_LOG');
      const logDoc = await logRef.get();
      const existingLog = logDoc.exists ? (logDoc.data()?.log || '') : '';

      await logRef.set(
        {
          log: markdown + existingLog, // Prepend new entry
          lastUpdated: now,
          entryCount: (logDoc.exists ? (logDoc.data()?.entryCount || 0) : 0) + 1
        },
        { merge: true }
      );

      console.log('[Auto-Doc] Documentation entry created:', {
        changes: changes.length,
        performance: { avgReward, successRate }
      });

      // Audit log
      await db.collection('admin_audit').add({
        ts: now,
        action: 'auto_doc_updated',
        actorUid: 'system',
        meta: {
          changes: changes.length,
          avgReward,
          successRate
        }
      });

      console.log('[Auto-Doc] Documentation generation complete');
    } catch (error) {
      console.error('[Auto-Doc] Error:', error);
    }
  });


