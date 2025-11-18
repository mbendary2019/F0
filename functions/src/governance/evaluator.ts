/**
 * Phase 39 - Governance Evaluator
 * Evaluates policy activation requests against governance rules
 */

import { loadActivePolicies } from './policyLoader';
import { hasEdge, getConfidence } from './graphQuery';
import { EvaluationDecision } from '../types/governance';

export interface EvaluationRequest {
  policyId: string;
  version: string;
  diff?: {
    modelWeights?: Record<string, number>;
    [key: string]: any;
  };
}

/**
 * Evaluate a policy activation request against all active governance policies
 */
export async function evaluateActivation(
  candidate: EvaluationRequest
): Promise<EvaluationDecision> {
  const pols = await loadActivePolicies();
  const ctx = candidate;
  const reasons: string[] = [];
  let allow = true;
  let hold = false;

  for (const p of pols) {
    for (const r of p.rules || []) {
      // Rule: deny-activate-if-violates-7d
      if (r.id === 'deny-activate-if-violates-7d') {
        const src = `policy_version:${ctx.policyId}@${ctx.version}`;
        const dst = 'metric_window:Router:7d';
        const bad = await hasEdge('VIOLATES', src, dst, r.where?.weight_gt ?? 0.6);
        if (bad) {
          allow = false;
          reasons.push(r.message || 'violates-7d');
        }
      }

      // Rule: require-confidence
      if (r.id === 'require-confidence') {
        const score = await getConfidence('router:24h');
        if (score != null && score < (r.where?.score_lt ?? 0.6)) {
          hold = true;
          reasons.push(r.message || 'low-confidence');
        }
      }

      // Rule: cap-weight-shift
      if (r.id === 'cap-weight-shift' && ctx.diff?.modelWeights) {
        const delta = Math.max(
          ...Object.values(ctx.diff.modelWeights).map((v: any) =>
            Math.abs(Number(v) || 0)
          )
        );
        if (delta > (r.where?.max_delta ?? 0.1)) {
          allow = false;
          reasons.push(r.message || 'exceeds-weight-cap');
        }
      }
    }
  }

  return { allow, hold, reasons };
}
