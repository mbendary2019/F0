/**
 * Self-Healing Engine
 * Automatically applies remediation actions when predictions exceed thresholds
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

export type RemediationRule = {
  metric: 'calls' | 'errors' | 'latency_p95';
  comparator: '>=' | '>' | '<' | '<=';
  threshold: number;
  action: 'disable_endpoint' | 'reduce_rate' | 'restart_function';
  target?: string; // endpoint or function name
  reduceByPct?: number; // for rate limiting
  enabled: boolean;
  createdBy?: string;
  createdAt?: number;
};

/**
 * Compare two values using the specified operator
 */
function compare(a: number, op: RemediationRule['comparator'], b: number): boolean {
  switch (op) {
    case '>=': return a >= b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '<': return a < b;
    default: return false;
  }
}

/**
 * Apply remediation action
 * Currently writes to feature_flags, rate_limits, and ops_commands collections
 * TODO: Connect to your actual systems (Feature Flag service, Rate Limiter, etc.)
 */
async function applyRemediation(
  db: FirebaseFirestore.Firestore,
  rule: RemediationRule,
  forecastValue: number
): Promise<void> {
  const timestamp = Date.now();
  
  // Log to audit trail
  await db.collection('admin_audit').add({
    ts: timestamp,
    action: 'self_heal',
    actorUid: 'system',
    targetUid: rule.target ?? null,
    meta: {
      rule: {
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        action: rule.action
      },
      forecast: forecastValue,
      triggered: true
    }
  });
  
  // Apply specific action
  switch (rule.action) {
    case 'disable_endpoint':
      if (rule.target) {
        await db.collection('feature_flags').doc(`endpoint:${rule.target}`).set({
          enabled: false,
          reason: 'self_heal',
          disabledAt: timestamp,
          forecast: forecastValue,
          threshold: rule.threshold
        }, { merge: true });
        
        console.log(`[selfHeal] Disabled endpoint: ${rule.target}`);
      }
      break;
    
    case 'reduce_rate':
      if (rule.target && rule.reduceByPct) {
        await db.collection('rate_limits').doc(rule.target).set({
          reduceBy: rule.reduceByPct,
          reason: 'self_heal',
          appliedAt: timestamp,
          forecast: forecastValue,
          threshold: rule.threshold
        }, { merge: true });
        
        console.log(`[selfHeal] Reduced rate limit for ${rule.target} by ${rule.reduceByPct}%`);
      }
      break;
    
    case 'restart_function':
      if (rule.target) {
        await db.collection('ops_commands').add({
          cmd: 'restart_fn',
          target: rule.target,
          reason: 'self_heal',
          ts: timestamp,
          forecast: forecastValue,
          threshold: rule.threshold,
          status: 'pending'
        });
        
        console.log(`[selfHeal] Queued restart for function: ${rule.target}`);
      }
      break;
  }
}

/**
 * Self-Healing Engine Cloud Function
 * Runs every 5 minutes to check predictions and apply remediations
 */
export const selfHealEngine = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[selfHealEngine] Starting remediation check');
    
    const db = getFirestore();
    
    // Load enabled remediation rules
    const rulesSnap = await db
      .collection('remediation_rules')
      .where('enabled', '==', true)
      .get();
    
    if (rulesSnap.empty) {
      console.log('[selfHealEngine] No enabled rules found');
      return null;
    }
    
    const rules = rulesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<RemediationRule & { id: string }>;
    
    console.log(`[selfHealEngine] Checking ${rules.length} enabled rules`);
    
    // Load recent predictions (last 6 forecasts)
    const predsSnap = await db
      .collection('predictions_daily')
      .orderBy('t', 'desc')
      .limit(20)
      .get();
    
    if (predsSnap.empty) {
      console.log('[selfHealEngine] No predictions available yet');
      return null;
    }
    
    const predictions = predsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    let actionsTriggered = 0;
    
    // Check each rule against latest predictions
    for (const rule of rules) {
      try {
        // Find the most recent prediction for this metric
        const latestPrediction = predictions.find(p => p.metric === rule.metric);
        
        if (!latestPrediction) {
          console.log(`[selfHealEngine] No prediction found for ${rule.metric}`);
          continue;
        }
        
        // Get the next forecasted value (first in array)
        const nextValue = Array.isArray(latestPrediction.forecast) 
          ? latestPrediction.forecast[0] 
          : latestPrediction.forecast;
        
        // Check if threshold is exceeded
        if (compare(nextValue, rule.comparator, rule.threshold)) {
          console.log(`[selfHealEngine] Rule triggered: ${rule.metric} ${rule.comparator} ${rule.threshold} (forecast: ${nextValue})`);
          
          // Apply remediation
          await applyRemediation(db, rule, nextValue);
          actionsTriggered++;
          
          // Optional: Disable rule temporarily to avoid repeated triggers
          // await db.collection('remediation_rules').doc(rule.id).update({
          //   lastTriggered: Date.now(),
          //   cooldownUntil: Date.now() + (15 * 60 * 1000) // 15 min cooldown
          // });
        }
      } catch (err) {
        console.error(`[selfHealEngine] Error processing rule ${rule.id}:`, err);
      }
    }
    
    console.log(`[selfHealEngine] Completed: ${actionsTriggered} actions triggered`);
    return null;
  });

/**
 * Revert self-healing actions after cooldown period
 * Runs every 30 minutes
 */
export const revertSelfHeal = functions.pubsub
  .schedule('every 30 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[revertSelfHeal] Checking for actions to revert');
    
    const db = getFirestore();
    const cooldownMs = 60 * 60 * 1000; // 1 hour
    const revertBefore = Date.now() - cooldownMs;
    
    let revertedCount = 0;
    
    try {
      // Revert disabled endpoints
      const disabledFlags = await db
        .collection('feature_flags')
        .where('reason', '==', 'self_heal')
        .where('disabledAt', '<', revertBefore)
        .get();
      
      for (const doc of disabledFlags.docs) {
        await doc.ref.update({
          enabled: true,
          revertedAt: Date.now()
        });
        revertedCount++;
      }
      
      // Revert rate limit reductions
      const reducedLimits = await db
        .collection('rate_limits')
        .where('reason', '==', 'self_heal')
        .where('appliedAt', '<', revertBefore)
        .get();
      
      for (const doc of reducedLimits.docs) {
        await doc.ref.delete();
        revertedCount++;
      }
      
      console.log(`[revertSelfHeal] Reverted ${revertedCount} actions`);
    } catch (err) {
      console.error('[revertSelfHeal] Error:', err);
    }
    
    return null;
  });

