/**
 * Guardian - Security Gate for Autonomous Operations
 * Validates and authorizes all automated actions before execution
 */

import { getFirestore } from 'firebase-admin/firestore';
import type { GuardDecision } from './types';

export type GuardCheckInput = {
  actorUid: string;
  action: string;
  target?: string;
  meta?: any;
};

/**
 * Guardian Check - Security validation for operations
 * Implements multi-layer security checks
 */
export async function guardianCheck(op: GuardCheckInput): Promise<GuardDecision> {
  const db = getFirestore();
  const timestamp = Date.now();

  try {
    // Layer 1: Actor Validation
    // Verify actor exists and is authorized
    const actor = await db.collection('admins').doc(op.actorUid).get();
    
    if (!actor.exists) {
      console.warn(`[Guardian] Actor not found: ${op.actorUid}`);
      return {
        allow: false,
        reason: 'actor_not_admin',
        risk: 'high',
        timestamp
      };
    }

    const actorData = actor.data();
    
    // Check if actor is suspended
    if (actorData?.suspended) {
      console.warn(`[Guardian] Actor suspended: ${op.actorUid}`);
      return {
        allow: false,
        reason: 'actor_suspended',
        risk: 'high',
        timestamp
      };
    }

    // Layer 2: Action Blacklist Check
    // Check if action is blocked by policy
    const denylist = await db.collection('ops_policies').doc('denylist').get();
    
    if (denylist.exists) {
      const blocked = (denylist.data()?.actions as string[]) || [];
      
      if (blocked.includes(op.action)) {
        console.warn(`[Guardian] Action blocked by policy: ${op.action}`);
        return {
          allow: false,
          reason: 'action_blocked_by_policy',
          risk: 'high',
          timestamp
        };
      }
    }

    // Layer 3: Target Protection Check
    // Protect critical targets from automated actions
    if (op.target) {
      const protectedTargets = await db.collection('ops_policies').doc('protected_targets').get();
      
      if (protectedTargets.exists) {
        const protected = (protectedTargets.data()?.targets as string[]) || [];
        
        if (protected.includes(op.target)) {
          console.warn(`[Guardian] Target is protected: ${op.target}`);
          return {
            allow: false,
            reason: 'target_protected',
            risk: 'medium',
            timestamp
          };
        }
      }
    }

    // Layer 4: Rate Limiting
    // Prevent too many actions in short time
    const recentActionsSnap = await db
      .collection('ops_commands')
      .where('by', '==', op.actorUid)
      .where('ts', '>', timestamp - (5 * 60 * 1000)) // Last 5 minutes
      .get();

    if (recentActionsSnap.size > 10) {
      console.warn(`[Guardian] Rate limit exceeded for actor: ${op.actorUid}`);
      return {
        allow: false,
        reason: 'rate_limit_exceeded',
        risk: 'medium',
        timestamp
      };
    }

    // Layer 5: Risk Assessment
    // Assess risk level based on action type
    const risk = assessRiskLevel(op.action, op.target);

    // High-risk actions require explicit approval
    if (risk === 'high' && !actorData?.highRiskApproved) {
      console.warn(`[Guardian] High-risk action requires approval: ${op.action}`);
      return {
        allow: false,
        reason: 'high_risk_requires_approval',
        risk: 'high',
        timestamp
      };
    }

    // All checks passed
    console.log(`[Guardian] Action approved: ${op.action} by ${op.actorUid}`);
    return {
      allow: true,
      risk,
      timestamp
    };

  } catch (error) {
    console.error('[Guardian] Error during check:', error);
    // Fail closed - deny on error
    return {
      allow: false,
      reason: 'guardian_error',
      risk: 'high',
      timestamp
    };
  }
}

/**
 * Assess risk level based on action and target
 */
function assessRiskLevel(action: string, target?: string): 'low' | 'medium' | 'high' {
  // High risk actions
  const highRiskActions = [
    'restart_function',
    'delete_endpoint',
    'modify_database',
    'change_auth'
  ];

  // Medium risk actions
  const mediumRiskActions = [
    'disable_endpoint',
    'reduce_rate',
    'clear_cache'
  ];

  // Check if action matches high risk
  if (highRiskActions.some(a => action.includes(a))) {
    return 'high';
  }

  // Check if action matches medium risk
  if (mediumRiskActions.some(a => action.includes(a))) {
    return 'medium';
  }

  // Check if target is production
  if (target && (target.includes('prod') || target.includes('production'))) {
    return 'high';
  }

  // Default to low risk
  return 'low';
}

/**
 * Log guardian decision to audit trail
 */
export async function logGuardianDecision(
  op: GuardCheckInput,
  decision: GuardDecision
): Promise<void> {
  try {
    const db = getFirestore();
    
    await db.collection('admin_audit').add({
      ts: Date.now(),
      action: 'guardian_check',
      actorUid: op.actorUid,
      meta: {
        operation: op.action,
        target: op.target,
        decision: decision.allow ? 'allowed' : 'denied',
        reason: decision.reason,
        risk: decision.risk
      }
    });
  } catch (error) {
    console.error('[Guardian] Failed to log decision:', error);
  }
}
