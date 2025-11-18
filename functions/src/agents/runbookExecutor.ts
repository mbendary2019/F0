/**
 * Runbook Executor - Automated Response Playbooks
 * Monitors triggers and executes predefined sequences of actions
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import type { Runbook } from './types';

/**
 * Runbook Executor Cloud Function
 * Runs every 3 minutes to check triggers and execute runbooks
 */
export const runbookExecutor = functions.pubsub
  .schedule('every 3 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[RunbookExecutor] Starting runbook check');
    
    const db = getFirestore();
    
    // Fetch enabled runbooks
    const runbooksSnap = await db
      .collection('runbooks')
      .where('enabled', '==', true)
      .get();
    
    if (runbooksSnap.empty) {
      console.log('[RunbookExecutor] No enabled runbooks');
      return null;
    }
    
    console.log(`[RunbookExecutor] Checking ${runbooksSnap.size} runbooks`);
    
    // Fetch current system state
    const totalsSnap = await db.collection('observability_cache').doc('totals').get();
    const totals = totalsSnap.exists ? totalsSnap.data() : {};
    
    const errors24h = Number(totals?.errors24h || 0);
    const calls24h = Number(totals?.calls24h || 1);
    const p95 = Number(totals?.p95 || 0);
    
    // Calculate metrics
    const errorRate = Math.round((errors24h / calls24h) * 100);
    const errorRatePerMin = errors24h / (24 * 60);
    
    const systemState = {
      errorRate,
      errorRatePerMin,
      errors24h,
      calls24h,
      p95
    };
    
    console.log('[RunbookExecutor] System state:', systemState);
    
    let triggeredCount = 0;
    
    // Check each runbook
    for (const doc of runbooksSnap.docs) {
      const runbook = { id: doc.id, ...doc.data() } as Runbook;
      
      try {
        // Check cooldown
        if (runbook.lastTriggered && runbook.cooldown) {
          const timeSinceLastTrigger = Date.now() - runbook.lastTriggered;
          const cooldownMs = runbook.cooldown * 60 * 1000;
          
          if (timeSinceLastTrigger < cooldownMs) {
            console.log(`[RunbookExecutor] Runbook ${runbook.name} in cooldown`);
            continue;
          }
        }
        
        // Evaluate trigger
        const triggered = evaluateTrigger(runbook.trigger, systemState);
        
        if (triggered) {
          console.log(`[RunbookExecutor] Trigger activated: ${runbook.name} (${runbook.trigger})`);
          
          // Execute runbook steps
          await executeRunbook(db, runbook);
          
          // Update last triggered time
          await doc.ref.update({
            lastTriggered: Date.now(),
            triggerCount: (runbook as any).triggerCount ? (runbook as any).triggerCount + 1 : 1
          });
          
          triggeredCount++;
        }
        
      } catch (error) {
        console.error(`[RunbookExecutor] Error processing runbook ${runbook.id}:`, error);
      }
    }
    
    console.log(`[RunbookExecutor] Completed: ${triggeredCount} runbooks triggered`);
    return null;
  });

/**
 * Evaluate trigger condition
 */
function evaluateTrigger(
  trigger: string,
  state: {
    errorRate: number;
    errorRatePerMin: number;
    errors24h: number;
    calls24h: number;
    p95: number;
  }
): boolean {
  
  try {
    // Parse trigger string
    // Supported formats:
    // - "error_rate>80"
    // - "errors_per_min>10"
    // - "p95>1000"
    // - "calls24h>100000"
    
    const match = trigger.match(/^(\w+)(>|<|>=|<=|==)(\d+\.?\d*)$/);
    
    if (!match) {
      console.warn(`[RunbookExecutor] Invalid trigger format: ${trigger}`);
      return false;
    }
    
    const [, metric, operator, thresholdStr] = match;
    const threshold = parseFloat(thresholdStr);
    
    // Get metric value
    let value: number;
    
    switch (metric) {
      case 'error_rate':
        value = state.errorRate;
        break;
      case 'errors_per_min':
        value = state.errorRatePerMin;
        break;
      case 'errors24h':
        value = state.errors24h;
        break;
      case 'calls24h':
        value = state.calls24h;
        break;
      case 'p95':
        value = state.p95;
        break;
      default:
        console.warn(`[RunbookExecutor] Unknown metric: ${metric}`);
        return false;
    }
    
    // Evaluate condition
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      default:
        return false;
    }
    
  } catch (error) {
    console.error('[RunbookExecutor] Error evaluating trigger:', error);
    return false;
  }
}

/**
 * Execute runbook steps
 */
async function executeRunbook(
  db: FirebaseFirestore.Firestore,
  runbook: Runbook
): Promise<void> {
  
  console.log(`[RunbookExecutor] Executing runbook: ${runbook.name} (${runbook.steps.length} steps)`);
  
  // Log runbook execution
  await db.collection('admin_audit').add({
    ts: Date.now(),
    action: 'runbook_triggered',
    actorUid: 'system',
    meta: {
      runbookId: runbook.id,
      runbookName: runbook.name,
      trigger: runbook.trigger,
      steps: runbook.steps
    }
  });
  
  // Convert steps to agent jobs
  for (const step of runbook.steps) {
    try {
      // Parse step format: "action:target" or just "action"
      const [action, target] = step.split(':').map(s => s.trim());
      
      // Determine job kind
      let kind: 'remediate' | 'report' = 'remediate';
      
      if (action.includes('report') || action.includes('notify') || action.includes('alert')) {
        kind = 'report';
      }
      
      // Create agent job
      await db.collection('agent_jobs').add({
        kind,
        payload: {
          action,
          target: target || null,
          actorUid: 'system',
          runbookId: runbook.id,
          runbookName: runbook.name
        },
        status: 'queued',
        createdAt: Date.now(),
        requestedBy: 'system'
      });
      
      console.log(`[RunbookExecutor] Queued job: ${action}${target ? ':' + target : ''}`);
      
    } catch (error) {
      console.error(`[RunbookExecutor] Error queueing step "${step}":`, error);
    }
  }
}


