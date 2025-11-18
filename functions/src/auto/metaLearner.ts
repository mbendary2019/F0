/**
 * Meta-Learner
 * Selects the best-performing policy version as "champion"
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import type { PolicyVersion } from './types';

/**
 * Calculate policy performance score
 */
function calculateScore(version: PolicyVersion): number {
  // Multi-objective scoring:
  // - Avg reward (60%)
  // - Success rate (30%)
  // - Risk penalty (10%)
  
  const rewardScore = version.avgReward * 0.6;
  const successScore = (version.performance?.successRate || 0) * 0.3;
  const riskPenalty = version.avgRisk * 0.1;
  
  return rewardScore + successScore - riskPenalty;
}

/**
 * Meta-learning policy selection
 * Runs every 72 hours (3 days)
 */
export const metaLearner = functions.pubsub
  .schedule('every 72 hours')
  .onRun(async () => {
    console.log('[Meta-Learner] Starting champion selection');

    const db = getFirestore();
    const now = Date.now();
    const horizon = now - 7 * 24 * 60 * 60 * 1000; // Last 7 days

    try {
      // Load policy versions
      const versionsSnap = await db
        .collection('rl_policy_versions')
        .where('since', '>=', horizon)
        .get()
        .catch(() => null);

      if (!versionsSnap || versionsSnap.empty) {
        console.log('[Meta-Learner] No policy versions found, creating baseline');
        
        // Create baseline version from current policy
        const currentPolicy = await db.collection('rl_policy').doc('global').get();
        const policyData = currentPolicy.exists ? currentPolicy.data() : {};
        
        await db.collection('rl_policy_versions').add({
          version: 'v1.0',
          tuning: policyData?.tuning || { alpha: 0.5, lr: 0.05 },
          since: now,
          avgReward: 0,
          avgRisk: 0,
          decisions: 0,
          performance: {
            avgReward: 0,
            decisions: 0,
            avgMttrMin: 0,
            successRate: 0,
            autoApprovedRate: 0
          },
          isChampion: true
        });
        
        return;
      }

      // Evaluate all versions
      const versions: PolicyVersion[] = versionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));

      console.log('[Meta-Learner] Evaluating', versions.length, 'policy versions');

      let champion: PolicyVersion | null = null;
      let championScore = -Infinity;

      versions.forEach(version => {
        const score = calculateScore(version);
        
        console.log('[Meta-Learner] Version', version.version, 'score:', score, {
          avgReward: version.avgReward,
          successRate: version.performance?.successRate,
          avgRisk: version.avgRisk
        });

        if (score > championScore) {
          champion = version;
          championScore = score;
        }
      });

      if (!champion) {
        console.log('[Meta-Learner] No champion selected');
        return;
      }

      console.log('[Meta-Learner] Champion:', champion.version, 'score:', championScore);

      // Update global policy with champion
      await db.collection('rl_policy').doc('global').set(
        {
          tuning: champion.tuning,
          fromVersion: champion.version,
          championAt: now,
          championScore
        },
        { merge: true }
      );

      // Mark as champion in versions
      const batch = db.batch();
      
      versionsSnap.docs.forEach(doc => {
        const isChampion = doc.id === (champion as any).id;
        batch.update(doc.ref, { isChampion });
      });
      
      await batch.commit();

      // Audit log
      await db.collection('admin_audit').add({
        ts: now,
        action: 'policy_champion_selected',
        actorUid: 'system',
        meta: {
          version: champion.version,
          score: championScore,
          avgReward: champion.avgReward,
          successRate: champion.performance?.successRate,
          decisions: champion.decisions
        }
      });

      console.log('[Meta-Learner] Champion selection complete');
    } catch (error) {
      console.error('[Meta-Learner] Error:', error);
    }
  });


