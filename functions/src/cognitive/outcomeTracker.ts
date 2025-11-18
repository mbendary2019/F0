/**
 * Cognitive Ops Copilot - Outcome Tracker
 * Measures decision outcomes and updates RL policy
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { updatePolicy } from './policy';
import type { Decision, Outcome, MetricsSnapshot, PolicyParams } from './types';

/**
 * Calculate reward from metrics improvement
 */
function calculateReward(
  pre: MetricsSnapshot,
  post: MetricsSnapshot,
  risk: string
): { reward: number; breakdown: any; improvements: any } {
  // Error rate improvement
  const error_improvement = ((pre.error_rate - post.error_rate) / Math.max(0.001, pre.error_rate)) * 100;
  
  // Latency improvement
  const latency_improvement = ((pre.p95 - post.p95) / Math.max(1, pre.p95)) * 100;
  
  // Throughput change
  const throughput_change = ((post.throughput - pre.throughput) / Math.max(1, pre.throughput)) * 100;
  
  // Reward components
  let error_reward = 0;
  let latency_reward = 0;
  let side_effect_penalty = 0;
  let risk_penalty = 0;
  
  // Error improvement reward
  if (error_improvement >= 20) {
    error_reward = 1.0;
  } else if (error_improvement >= 10) {
    error_reward = 0.5;
  } else if (error_improvement < -10) {
    error_reward = -0.5;
  } else if (error_improvement < -20) {
    error_reward = -1.0;
  }
  
  // Latency improvement reward
  if (latency_improvement >= 15) {
    latency_reward = 0.5;
  } else if (latency_improvement >= 5) {
    latency_reward = 0.25;
  } else if (latency_improvement < -15) {
    latency_reward = -0.5;
  }
  
  // Side effect penalty (throughput drop)
  if (throughput_change < -20) {
    side_effect_penalty = -0.5;
  } else if (throughput_change < -10) {
    side_effect_penalty = -0.25;
  }
  
  // Risk penalty (discourage high-risk actions unless very beneficial)
  if (risk === 'high' && error_reward + latency_reward < 1.0) {
    risk_penalty = -0.3;
  } else if (risk === 'medium' && error_reward + latency_reward < 0.5) {
    risk_penalty = -0.1;
  }
  
  const total_reward = error_reward + latency_reward + side_effect_penalty + risk_penalty;
  
  return {
    reward: total_reward,
    breakdown: {
      error_reduction: error_reward,
      latency_reduction: latency_reward,
      side_effect_penalty,
      risk_penalty
    },
    improvements: {
      error_rate_improvement: error_improvement,
      latency_improvement
    }
  };
}

/**
 * Detect side effects
 */
function detectSideEffects(pre: MetricsSnapshot, post: MetricsSnapshot): string[] {
  const effects: string[] = [];
  
  const throughput_change = ((post.throughput - pre.throughput) / Math.max(1, pre.throughput)) * 100;
  
  if (throughput_change < -20) {
    effects.push('Significant throughput drop (-' + Math.abs(throughput_change).toFixed(1) + '%)');
  }
  
  if (post.error_rate > pre.error_rate * 1.5) {
    effects.push('Error rate increased');
  }
  
  if (post.p95 > pre.p95 * 1.3) {
    effects.push('Latency increased');
  }
  
  return effects;
}

/**
 * Capture current metrics
 */
async function captureMetrics(): Promise<MetricsSnapshot> {
  const db = getFirestore();
  const totalsDoc = await db.collection('observability_cache').doc('totals').get().catch(() => null);
  const totals = totalsDoc?.exists ? totalsDoc.data() : {};
  
  const calls = Number(totals?.calls24h || 1);
  const errors = Number(totals?.errors24h || 0);
  
  return {
    timestamp: Date.now(),
    error_rate: errors / calls,
    p95: Number(totals?.p95 || 0),
    throughput: calls
  };
}

/**
 * Main outcome tracker - runs every 10 minutes
 */
export const outcomeTracker = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async () => {
    console.log('[Outcome Tracker] Starting outcome evaluation');
    
    const db = getFirestore();
    
    try {
      // Find decisions that were executed but not yet evaluated
      // Wait at least 15 minutes after execution before evaluating
      const cutoff = Date.now() - 15 * 60 * 1000;
      
      const decisionsSnap = await db
        .collection('rl_decisions')
        .where('executed', '==', true)
        .where('executed_at', '<=', cutoff)
        .where('reward', '==', null)
        .orderBy('executed_at', 'asc')
        .limit(20)
        .get();
      
      if (decisionsSnap.empty) {
        console.log('[Outcome Tracker] No decisions to evaluate');
        return;
      }
      
      console.log('[Outcome Tracker] Evaluating', decisionsSnap.size, 'decisions');
      
      // Get current policy
      const policyDoc = await db.collection('rl_policy').doc('global').get();
      let policy = policyDoc.exists ? (policyDoc.data() as PolicyParams) : null;
      
      if (!policy) {
        console.error('[Outcome Tracker] No policy found');
        return;
      }
      
      // Evaluate each decision
      for (const decisionDoc of decisionsSnap.docs) {
        const decision = decisionDoc.data() as Decision;
        
        console.log('[Outcome Tracker] Evaluating decision:', decisionDoc.id, decision.action);
        
        // Capture post-execution metrics
        const post_metrics = await captureMetrics();
        
        // Calculate reward
        const pre_metrics = decision.pre_metrics;
        if (!pre_metrics) {
          console.warn('[Outcome Tracker] No pre-metrics for decision:', decisionDoc.id);
          continue;
        }
        
        const { reward, breakdown, improvements } = calculateReward(
          pre_metrics as MetricsSnapshot,
          post_metrics,
          decision.risk
        );
        
        // Detect side effects
        const side_effects = detectSideEffects(
          pre_metrics as MetricsSnapshot,
          post_metrics
        );
        
        console.log('[Outcome Tracker] Reward:', reward, 'Breakdown:', breakdown);
        
        // Update policy
        policy = updatePolicy(
          policy,
          decision.action,
          decision.context,
          reward,
          0.05, // learning rate
          0.95  // confidence decay
        );
        
        // Save outcome
        const outcome: Outcome = {
          decision_id: decisionDoc.id,
          pre_metrics: pre_metrics as MetricsSnapshot,
          post_metrics,
          error_rate_improvement: improvements.error_rate_improvement,
          latency_improvement: improvements.latency_improvement,
          reward,
          reward_breakdown: breakdown,
          side_effects,
          timestamp: Date.now()
        };
        
        await db.collection('rl_outcomes').add(outcome);
        
        // Update decision with reward
        await decisionDoc.ref.update({
          reward,
          post_metrics,
          side_effects,
          evaluated_at: Date.now()
        });
        
        // Log to audit
        await db.collection('admin_audit').add({
          action: 'rl_outcome_evaluated',
          actorUid: 'outcome_tracker',
          targetId: decisionDoc.id,
          ts: Date.now(),
          meta: {
            action: decision.action,
            reward,
            improvements
          }
        });
      }
      
      // Save updated policy
      await db.collection('rl_policy').doc('global').set(policy);
      console.log('[Outcome Tracker] Policy updated. Version:', policy.version, 'Samples:', policy.trained_samples);
      
    } catch (error) {
      console.error('[Outcome Tracker] Error:', error);
    }
  });


