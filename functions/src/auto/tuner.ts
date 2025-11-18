/**
 * Auto-Policy Tuner
 * Automatically adjusts RL policy hyperparameters based on performance
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import type { Tuning, WindowStats } from './types';

/**
 * Load performance stats for a time window
 */
async function loadWindowStats(
  db: FirebaseFirestore.Firestore,
  since: number
): Promise<WindowStats> {
  const outcomesSnap = await db
    .collection('rl_outcomes')
    .where('timestamp', '>=', since)
    .get()
    .catch(() => null);

  if (!outcomesSnap || outcomesSnap.empty) {
    return {
      avgReward: 0,
      decisions: 0,
      avgMttrMin: 0,
      successRate: 0,
      autoApprovedRate: 0
    };
  }

  let totalReward = 0;
  let totalMttr = 0;
  let successCount = 0;
  const count = outcomesSnap.size;

  outcomesSnap.forEach((doc) => {
    const data = doc.data();
    totalReward += Number(data.reward || 0);
    totalMttr += Number(data.mttr_minutes || 0);
    if ((data.reward || 0) > 0) successCount++;
  });

  // Load decision stats
  const decisionsSnap = await db
    .collection('rl_decisions')
    .where('timestamp', '>=', since)
    .get()
    .catch(() => null);

  let autoApproved = 0;
  const decisionCount = decisionsSnap?.size || 0;

  decisionsSnap?.forEach((doc) => {
    const data = doc.data();
    if (data.approval_status === 'auto_approved') autoApproved++;
  });

  return {
    avgReward: count > 0 ? totalReward / count : 0,
    decisions: count,
    avgMttrMin: count > 0 ? totalMttr / count : 0,
    successRate: count > 0 ? successCount / count : 0,
    autoApprovedRate: decisionCount > 0 ? autoApproved / decisionCount : 0
  };
}

/**
 * Auto-tune policy hyperparameters
 * Runs every 24 hours
 */
export const autoPolicyTuner = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    console.log('[Auto-Tuner] Starting policy tuning cycle');

    const db = getFirestore();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    try {
      // Load performance windows
      const weekStats = await loadWindowStats(db, weekAgo);
      const dayStats = await loadWindowStats(db, dayAgo);

      console.log('[Auto-Tuner] Week stats:', weekStats);
      console.log('[Auto-Tuner] Day stats:', dayStats);

      // Get current policy
      const policyRef = db.collection('rl_policy').doc('global');
      const policyDoc = await policyRef.get();
      const policy = policyDoc.exists ? policyDoc.data() : {};
      
      const currentTuning: Tuning = policy?.tuning || {
        alpha: 0.5,
        lr: 0.05,
        weights: {},
        updatedAt: 0
      };

      // Calculate performance deltas
      const rewardDelta = dayStats.avgReward - weekStats.avgReward;
      const mttrDelta = dayStats.avgMttrMin - weekStats.avgMttrMin;
      const successRateDelta = dayStats.successRate - weekStats.successRate;

      console.log('[Auto-Tuner] Deltas:', {
        rewardDelta,
        mttrDelta,
        successRateDelta
      });

      // Determine tuning adjustments
      let newAlpha = currentTuning.alpha;
      let newLr = currentTuning.lr;
      const changes: string[] = [];

      // Decision logic
      if (rewardDelta < -0.05 || mttrDelta > 5 || successRateDelta < -0.1) {
        // Performance degraded → Increase exploration, slow learning
        newAlpha = Math.min(1.0, currentTuning.alpha + 0.1);
        newLr = Math.max(0.02, currentTuning.lr - 0.01);
        changes.push('Performance degraded → Increased exploration, slowed learning');
        
        console.log('[Auto-Tuner] Performance degraded, adjusting...');
      } else if (rewardDelta > 0.05 && mttrDelta < -5 && successRateDelta > 0.05) {
        // Performance improved significantly → Reduce exploration, speed up learning
        newAlpha = Math.max(0.2, currentTuning.alpha - 0.05);
        newLr = Math.min(0.1, currentTuning.lr + 0.005);
        changes.push('Performance improved → Reduced exploration, accelerated learning');
        
        console.log('[Auto-Tuner] Performance improved, optimizing...');
      } else if (Math.abs(rewardDelta) < 0.02 && dayStats.successRate > 0.7) {
        // Stable and good → Fine-tune
        newAlpha = Math.max(0.3, currentTuning.alpha * 0.95);
        changes.push('Stable performance → Fine-tuning exploration');
        
        console.log('[Auto-Tuner] Stable performance, fine-tuning...');
      } else {
        changes.push('No significant changes needed');
        console.log('[Auto-Tuner] No tuning needed');
      }

      // Apply bounds
      newAlpha = Math.max(0.1, Math.min(1.5, newAlpha));
      newLr = Math.max(0.005, Math.min(0.2, newLr));

      // Update policy
      const newTuning: Tuning = {
        alpha: newAlpha,
        lr: newLr,
        weights: currentTuning.weights || {},
        updatedAt: now,
        updatedBy: 'system',
        reason: changes.join('; ')
      };

      await policyRef.set(
        { tuning: newTuning },
        { merge: true }
      );

      console.log('[Auto-Tuner] Updated tuning:', {
        old: { alpha: currentTuning.alpha, lr: currentTuning.lr },
        new: { alpha: newAlpha, lr: newLr }
      });

      // Audit log
      await db.collection('admin_audit').add({
        ts: now,
        action: 'policy_auto_tuned',
        actorUid: 'system',
        meta: {
          rewardDelta,
          mttrDelta,
          successRateDelta,
          old: {
            alpha: currentTuning.alpha,
            lr: currentTuning.lr
          },
          new: {
            alpha: newAlpha,
            lr: newLr
          },
          changes
        }
      });

      console.log('[Auto-Tuner] Tuning cycle complete');
    } catch (error) {
      console.error('[Auto-Tuner] Error:', error);
    }
  });


