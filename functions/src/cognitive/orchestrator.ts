/**
 * Cognitive Ops Copilot - Decision Orchestrator
 * Selects and executes autonomous decisions with guardrails
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { initPolicyParams, selectAction, explainAction, getFeatureDimension } from './policy';
import { assessRisk, applyGuardrails, logGuardrailDecision } from './governor';
import type { Context, PolicyParams, Decision } from './types';

/**
 * Build context from current system state
 */
async function buildContext(): Promise<Context> {
  const db = getFirestore();
  
  // Fetch metrics
  const totalsDoc = await db.collection('observability_cache').doc('totals').get().catch(() => null);
  const totals = totalsDoc?.exists ? totalsDoc.data() : {};
  
  // Fetch recent anomalies
  const anomaliesSnap = await db
    .collection('anomaly_events')
    .orderBy('ts', 'desc')
    .limit(10)
    .get()
    .catch(() => null);
  
  const anomalies = anomaliesSnap ? anomaliesSnap.docs.map(d => d.data()) : [];
  const highSeverity = anomalies.filter((a: any) => a.severity === 'high').length;
  const totalAnomalies = anomalies.length;
  
  // Calculate metrics
  const calls = Number(totals?.calls24h || 1);
  const errors = Number(totals?.errors24h || 0);
  const p95 = Number(totals?.p95 || 0);
  
  const error_rate = errors / calls;
  const p95_normalized = p95 / 1000;
  const traffic_normalized = calls / 100000;
  
  // Spike detection (simplified z-score approximation)
  const error_spike = error_rate > 0.05 ? 2.0 : error_rate > 0.02 ? 1.0 : 0;
  const latency_spike = p95 > 1000 ? 2.0 : p95 > 500 ? 1.0 : 0;
  const traffic_spike = traffic_normalized > 1 ? 1.5 : traffic_normalized > 0.5 ? 0.5 : 0;
  
  // Anomaly severity
  const anomaly_severity = highSeverity > 0 ? 1.0 : totalAnomalies > 2 ? 0.5 : 0.2;
  
  // Time context
  const now = new Date();
  const hour_of_day = now.getHours();
  const day_of_week = now.getDay();
  
  // Forecast trend (simplified - fetch from predictions_daily if available)
  const forecast_trend = 0; // TODO: integrate with Phase 32 predictions
  
  return {
    error_rate: Math.min(1, error_rate),
    error_spike,
    p95_normalized: Math.min(2, p95_normalized),
    latency_spike,
    traffic_normalized: Math.min(1, traffic_normalized),
    traffic_spike,
    anomaly_severity,
    anomaly_count: totalAnomalies,
    hour_of_day,
    day_of_week,
    forecast_trend
  };
}

/**
 * Get or initialize policy
 */
async function getPolicy(): Promise<PolicyParams> {
  const db = getFirestore();
  const policyDoc = await db.collection('rl_policy').doc('global').get();
  
  if (policyDoc.exists) {
    return policyDoc.data() as PolicyParams;
  }
  
  // Initialize new policy
  const params = initPolicyParams(getFeatureDimension());
  await db.collection('rl_policy').doc('global').set(params);
  
  return params;
}

/**
 * Determine target for action
 */
function determineTarget(action: string, context: Context): string | undefined {
  switch (action) {
    case 'restart_fn':
      // Pick function to restart based on context
      return context.error_rate > 0.05 ? 'workerA' : 'workerB';
    
    case 'disable_endpoint':
      // Would need root cause analysis to pick endpoint
      return '/api/slow-endpoint';
    
    case 'reduce_rate':
      return 'main_api';
    
    case 'reroute':
      return 'backup_region';
    
    default:
      return undefined;
  }
}

/**
 * Create agent job for execution
 */
async function createAgentJob(decision: Decision): Promise<void> {
  const db = getFirestore();
  
  await db.collection('agent_jobs').add({
    kind: 'remediate',
    payload: {
      action: decision.action,
      target: decision.target,
      actorUid: 'cognitive_copilot',
      decision_id: decision.id,
      meta: {
        expected_gain: decision.expected_gain,
        risk: decision.risk
      }
    },
    status: 'queued',
    createdAt: Date.now(),
    requestedBy: 'cognitive_copilot'
  });
}

/**
 * Main orchestrator - runs every 3 minutes
 */
export const cognitiveOrchestrator = functions.pubsub
  .schedule('every 3 minutes')
  .onRun(async () => {
    console.log('[Cognitive Orchestrator] Starting decision cycle');
    
    const db = getFirestore();
    
    try {
      // Build context
      const context = await buildContext();
      console.log('[Cognitive Orchestrator] Context:', JSON.stringify(context, null, 2));
      
      // Get policy
      const policy = await getPolicy();
      console.log('[Cognitive Orchestrator] Policy version:', policy.version, 'samples:', policy.trained_samples);
      
      // Select action
      const selection = selectAction(context, policy, 0.5);
      console.log('[Cognitive Orchestrator] Selected action:', selection.action, 'score:', selection.score);
      
      // Skip if "do_nothing" is selected
      if (selection.action === 'do_nothing') {
        console.log('[Cognitive Orchestrator] No action needed');
        return;
      }
      
      // Determine target
      const target = determineTarget(selection.action, context);
      
      // Assess risk
      const risk = assessRisk(selection.action, context, target);
      console.log('[Cognitive Orchestrator] Risk assessment:', risk);
      
      // Apply guardrails
      const governorDecision = await applyGuardrails(selection.action, risk, target, context);
      console.log('[Cognitive Orchestrator] Governor decision:', governorDecision);
      
      // Explain action
      const { explanation, contributing_factors } = explainAction(context, selection.action, policy);
      
      // Create decision record
      const decision: Decision = {
        context,
        timestamp: Date.now(),
        action: selection.action,
        target,
        expected_gain: selection.score,
        confidence: selection.confidence,
        risk,
        approval_status: governorDecision.allow
          ? (governorDecision.approval_required ? 'pending' : 'auto_approved')
          : 'rejected',
        approval_reason: governorDecision.reason,
        executed: false,
        explanation,
        contributing_factors
      };
      
      // Save decision
      const decisionRef = await db.collection('rl_decisions').add(decision);
      decision.id = decisionRef.id;
      
      // Log guardrail decision
      await logGuardrailDecision(decisionRef.id, governorDecision);
      
      // Execute or request approval
      if (governorDecision.allow && !governorDecision.approval_required) {
        // Auto-execute low-risk decisions
        await executeDecision(decision);
        console.log('[Cognitive Orchestrator] Auto-executed:', selection.action);
      } else if (governorDecision.approval_required) {
        // Request approval (could trigger Slack notification here)
        console.log('[Cognitive Orchestrator] Approval required for:', selection.action);
        await requestApproval(decision);
      } else {
        console.log('[Cognitive Orchestrator] Decision rejected:', governorDecision.reason);
      }
      
    } catch (error) {
      console.error('[Cognitive Orchestrator] Error:', error);
    }
  });

/**
 * Execute a decision
 */
async function executeDecision(decision: Decision): Promise<void> {
  const db = getFirestore();
  
  // Capture pre-execution metrics
  const pre_metrics = await captureMetrics();
  
  // Create agent job
  await createAgentJob(decision);
  
  // Update decision
  await db.collection('rl_decisions').doc(decision.id!).update({
    executed: true,
    executed_at: Date.now(),
    pre_metrics
  });
  
  // Log execution
  await db.collection('admin_audit').add({
    action: 'cognitive_decision_executed',
    actorUid: 'cognitive_copilot',
    targetId: decision.id,
    ts: Date.now(),
    meta: {
      action: decision.action,
      target: decision.target,
      risk: decision.risk
    }
  });
}

/**
 * Request human approval
 */
async function requestApproval(decision: Decision): Promise<void> {
  const db = getFirestore();
  
  // Log approval request
  await db.collection('admin_audit').add({
    action: 'cognitive_approval_requested',
    actorUid: 'cognitive_copilot',
    targetId: decision.id,
    ts: Date.now(),
    meta: {
      action: decision.action,
      target: decision.target,
      risk: decision.risk,
      explanation: decision.explanation
    }
  });
  
  // TODO: Send Slack notification
  // const slackUrl = process.env.SLACK_WEBHOOK_URL;
  // if (slackUrl) {
  //   await sendSlackApprovalRequest(slackUrl, decision);
  // }
  
  // Set expiration timer (e.g., 30 minutes)
  const expirationTime = Date.now() + 30 * 60 * 1000;
  await db.collection('rl_decisions').doc(decision.id!).update({
    approval_expires_at: expirationTime
  });
}

/**
 * Capture current metrics snapshot
 */
async function captureMetrics(): Promise<any> {
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


