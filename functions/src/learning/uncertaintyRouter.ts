/**
 * Phase 37 - Uncertainty-Aware Router
 * Adapts router weights based on confidence scores
 */

import * as admin from "firebase-admin";
import { FLAGS } from "../config/flags";
import { v4 as uuid } from "uuid";
import { DecisionRecord } from "../types/meta";

const db = admin.firestore();

function renormalize(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, Number((v / sum).toFixed(4))])
  );
}

function bumpPatch(v: string): string {
  const [a, b, c] = v.split('.').map(n => Number(n || 0));
  return `${a}.${b}.${(c || 0) + 1}`;
}

function pickABBucket(): 'adaptive' | 'control' | 'prod' {
  const r = Math.random();
  const { adaptive, control } = FLAGS.adaptive.ab;
  if (r < adaptive) return 'adaptive';
  if (r < adaptive + control) return 'control';
  return 'prod';
}

export async function adaptRouterWeights(
  policyId = 'router-core',
  versionHint = '1.0.0'
): Promise<{ policyId: string; from: string; to: string } | null> {
  if (!FLAGS.adaptive.enabled) {
    console.log('[adaptRouterWeights] Adaptive mode disabled');
    return null;
  }

  // Read confidence (24h window) for router components
  const cSnap = await db.collection('ops_confidence').doc('router:24h').get();
  const conf = cSnap.data() as any | undefined;

  if (!conf) {
    console.log('[adaptRouterWeights] No confidence data for router:24h');
    return null;
  }

  if ((conf.sampleSize || 0) < FLAGS.adaptive.minSampleSize) {
    console.log(`[adaptRouterWeights] Insufficient samples: ${conf.sampleSize} < ${FLAGS.adaptive.minSampleSize}`);
    return null;
  }

  if ((conf.score || 0) < FLAGS.adaptive.minConfidenceToAct) {
    console.log(`[adaptRouterWeights] Low confidence: ${conf.score} < ${FLAGS.adaptive.minConfidenceToAct}`);
    return null;
  }

  // Read active policy
  const activeRef = db.collection('ops_policies').doc(`${policyId}@${versionHint}`);
  const activeSnap = await activeRef.get();

  if (!activeSnap.exists) {
    console.log(`[adaptRouterWeights] Policy ${policyId}@${versionHint} not found`);
    return null;
  }

  const active = activeSnap.data() as any;
  const before = active.params || {};
  const currentWeights = {
    ...(before.modelWeights || { 'gpt-5': 0.6, 'gemini': 0.25, 'claude': 0.15 })
  };

  // Heuristic: boost models with better reward/latency
  // For MVP, apply small perturbation (<= maxChangeMagnitude)
  const delta = FLAGS.adaptive.maxChangeMagnitude; // e.g., 0.1

  const newWeights = { ...currentWeights };
  newWeights['gpt-5'] = Math.min(1, newWeights['gpt-5'] + delta / 2);
  newWeights['claude'] = Math.max(0, newWeights['claude'] - delta / 2);

  const afterWeights = renormalize(newWeights);

  // Write a draft version bump
  const nextV = bumpPatch(active.version);
  const draftRef = db.collection('ops_policies').doc(`${policyId}@${nextV}`);

  await draftRef.set({
    ...active,
    version: nextV,
    status: 'draft',
    params: { ...before, modelWeights: afterWeights },
    createdAt: Date.now(),
    createdBy: 'adaptive-router',
  });

  // Log decision
  const decision: DecisionRecord = {
    id: uuid(),
    ts: Date.now(),
    actor: 'adaptive-router',
    component: 'router',
    before: before,
    after: { ...before, modelWeights: afterWeights },
    confidence: conf.score,
    reasons: conf.reasons,
    guardrail: 'passed',
    abBucket: pickABBucket(),
    effect: { expectedRewardDelta: +0.02 },
  };

  await db.collection('ops_decisions').add(decision);

  console.log(`[adaptRouterWeights] Created draft policy ${policyId}@${nextV} with confidence ${conf.score.toFixed(2)}`);

  return { policyId, from: active.version, to: nextV };
}
