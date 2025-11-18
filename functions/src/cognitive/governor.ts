/**
 * Cognitive Ops Copilot - Safe Governor
 * Guardrails & approval flow for autonomous decisions
 */

import { getFirestore } from 'firebase-admin/firestore';
import type { Action, RiskLevel, GovernorDecision, Guardrail, Context } from './types';

/**
 * Assess risk level for an action
 */
export function assessRisk(action: Action, context: Context, target?: string): RiskLevel {
  // High risk actions
  const highRiskActions: Action[] = ['disable_endpoint', 'reroute'];
  
  // Medium risk actions
  const mediumRiskActions: Action[] = ['restart_fn', 'reduce_rate', 'scale_up'];
  
  // Protected production targets
  const protectedTargets = ['production', 'main_api', 'auth_service', 'payment_api'];
  
  // Risk factors
  let riskScore = 0;
  
  // Action inherent risk
  if (highRiskActions.includes(action)) {
    riskScore += 3;
  } else if (mediumRiskActions.includes(action)) {
    riskScore += 2;
  } else {
    riskScore += 1;
  }
  
  // Target sensitivity
  if (target && protectedTargets.some(pt => target.includes(pt))) {
    riskScore += 2;
  }
  
  // Context severity
  if (context.anomaly_severity > 0.7) {
    riskScore += 1; // High severity → more risk in action
  }
  
  // Traffic level
  if (context.traffic_normalized > 0.7) {
    riskScore += 1; // High traffic → more risk
  }
  
  // Classify
  if (riskScore >= 5) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
}

/**
 * Apply guardrails and determine if action is allowed
 */
export async function applyGuardrails(
  action: Action,
  risk: RiskLevel,
  target?: string,
  context?: Context
): Promise<GovernorDecision> {
  const db = getFirestore();
  
  // Load guardrails
  const guardrailsSnap = await db
    .collection('rl_guardrails')
    .where('enabled', '==', true)
    .orderBy('priority', 'desc')
    .get()
    .catch(() => null);
  
  const guardrails: Guardrail[] = guardrailsSnap
    ? guardrailsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Guardrail))
    : getDefaultGuardrails();
  
  const matchedGuardrails: string[] = [];
  let allow = true;
  let approval_required = false;
  let reason: string | undefined;
  
  // Apply guardrails in priority order
  for (const guard of guardrails) {
    // Check if guardrail applies
    if (guard.action && guard.action !== action) continue;
    if (guard.risk_level && guard.risk_level !== risk) continue;
    
    // Check protected targets
    if (guard.protected_targets && target) {
      const isProtected = guard.protected_targets.some(pt => 
        target.toLowerCase().includes(pt.toLowerCase())
      );
      if (!isProtected) continue;
    }
    
    matchedGuardrails.push(guard.name);
    
    // Apply policy
    if (guard.policy === 'deny') {
      allow = false;
      reason = `Denied by guardrail: ${guard.name}`;
      break;
    } else if (guard.policy === 'require_approval') {
      approval_required = true;
      reason = `Requires approval: ${guard.name}`;
    } else if (guard.policy === 'allow_with_limit') {
      // Check cooldown
      if (guard.cooldown_minutes) {
        const cooldownOk = await checkCooldown(action, target, guard.cooldown_minutes);
        if (!cooldownOk) {
          allow = false;
          reason = `Cooldown active: ${guard.cooldown_minutes} minutes`;
          break;
        }
      }
      
      // Max impact check would go here (e.g., throttle ≤ 30%)
      // For now, we just allow
    }
  }
  
  return {
    allow,
    reason,
    approval_required,
    risk_assessment: risk,
    matched_guardrails: matchedGuardrails
  };
}

/**
 * Check if cooldown period has passed
 */
async function checkCooldown(
  action: Action,
  target: string | undefined,
  cooldownMinutes: number
): Promise<boolean> {
  const db = getFirestore();
  const cutoff = Date.now() - cooldownMinutes * 60 * 1000;
  
  const recent = await db
    .collection('rl_decisions')
    .where('action', '==', action)
    .where('executed', '==', true)
    .where('timestamp', '>=', cutoff)
    .limit(1)
    .get()
    .catch(() => null);
  
  if (!recent || recent.empty) return true;
  
  // If target specified, check if same target
  if (target) {
    const recentTarget = recent.docs[0].data().target;
    return recentTarget !== target;
  }
  
  return false;
}

/**
 * Default guardrails (used if none in Firestore)
 */
function getDefaultGuardrails(): Guardrail[] {
  return [
    {
      name: 'Deny high-risk on protected targets',
      risk_level: 'high',
      protected_targets: ['production', 'main_api', 'auth', 'payment'],
      policy: 'deny',
      enabled: true,
      priority: 100
    },
    {
      name: 'Require approval for disable_endpoint',
      action: 'disable_endpoint',
      policy: 'require_approval',
      enabled: true,
      priority: 90
    },
    {
      name: 'Require approval for reroute',
      action: 'reroute',
      policy: 'require_approval',
      enabled: true,
      priority: 90
    },
    {
      name: 'Cooldown for restart_fn',
      action: 'restart_fn',
      policy: 'allow_with_limit',
      cooldown_minutes: 5,
      enabled: true,
      priority: 50
    },
    {
      name: 'Limit reduce_rate impact',
      action: 'reduce_rate',
      policy: 'allow_with_limit',
      max_impact_percentage: 30,
      cooldown_minutes: 10,
      enabled: true,
      priority: 50
    },
    {
      name: 'Allow low-risk actions',
      risk_level: 'low',
      policy: 'allow_with_limit',
      enabled: true,
      priority: 10
    }
  ];
}

/**
 * Log guardrail decision
 */
export async function logGuardrailDecision(
  decision_id: string,
  governorDecision: GovernorDecision
): Promise<void> {
  const db = getFirestore();
  
  await db.collection('admin_audit').add({
    action: 'guardrail_check',
    targetId: decision_id,
    ts: Date.now(),
    meta: {
      allow: governorDecision.allow,
      reason: governorDecision.reason,
      approval_required: governorDecision.approval_required,
      risk: governorDecision.risk_assessment,
      matched_guardrails: governorDecision.matched_guardrails
    }
  });
}


