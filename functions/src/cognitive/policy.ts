/**
 * Cognitive Ops Copilot - RL Policy
 * LinUCB (Linear Upper Confidence Bound) Implementation
 */

import type { Context, Action, PolicyParams } from './types';

const ACTIONS: Action[] = [
  'do_nothing',
  'restart_fn',
  'reduce_rate',
  'disable_endpoint',
  'reroute',
  'scale_up',
  'clear_cache'
];

/**
 * Initialize policy parameters
 */
export function initPolicyParams(featureDim: number): PolicyParams {
  const zeros = () => Array(featureDim).fill(0);
  
  const weights: Record<Action, number[]> = {} as any;
  const confidence: Record<Action, number[]> = {} as any;
  
  for (const action of ACTIONS) {
    weights[action] = zeros();
    confidence[action] = zeros().map(() => 1.0); // Start with high uncertainty
  }
  
  return {
    weights,
    confidence,
    version: 1,
    trained_samples: 0,
    last_updated: Date.now()
  };
}

/**
 * Convert context to feature vector
 */
export function contextToFeatures(ctx: Context): number[] {
  return [
    ctx.error_rate,
    ctx.error_spike,
    ctx.p95_normalized,
    ctx.latency_spike,
    ctx.traffic_normalized,
    ctx.traffic_spike,
    ctx.anomaly_severity,
    ctx.anomaly_count / 10, // normalize
    ctx.hour_of_day / 24, // normalize
    ctx.day_of_week / 7, // normalize
    ctx.forecast_trend,
    1.0 // bias term
  ];
}

/**
 * Dot product
 */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Vector norm (L2)
 */
function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/**
 * Select best action using LinUCB
 * score = θᵀx + α * √(xᵀCx)
 * where θ = learned weights, x = features, C = confidence matrix (diagonal approx)
 */
export function selectAction(
  ctx: Context,
  params: PolicyParams,
  alpha = 0.5 // exploration parameter
): { action: Action; score: number; confidence: number; scores: Record<Action, number> } {
  const features = contextToFeatures(ctx);
  const scores: Record<Action, number> = {} as any;
  
  let bestAction: Action = 'do_nothing';
  let bestScore = -Infinity;
  
  for (const action of ACTIONS) {
    const theta = params.weights[action];
    const conf = params.confidence[action];
    
    // Expected reward: θᵀx
    const expectedReward = dot(theta, features);
    
    // Confidence bonus: α * √(xᵀCx) - using diagonal approximation
    const uncertaintyBonus = alpha * Math.sqrt(
      features.reduce((sum, x_i, i) => sum + (x_i * x_i * (conf[i] || 1)), 0)
    );
    
    // UCB score
    const score = expectedReward + uncertaintyBonus;
    scores[action] = score;
    
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  
  // Calculate confidence (0-1): higher when uncertainty is low
  const uncertaintyNorm = norm(params.confidence[bestAction]);
  const confidence = Math.max(0, Math.min(1, 1 - uncertaintyNorm / 10));
  
  return {
    action: bestAction,
    score: bestScore,
    confidence,
    scores
  };
}

/**
 * Update policy with observed outcome
 * Uses gradient descent update: θ ← θ + lr * reward * x
 * And reduces confidence: C ← C * decay
 */
export function updatePolicy(
  params: PolicyParams,
  action: Action,
  ctx: Context,
  reward: number,
  learningRate = 0.05,
  confidenceDecay = 0.95
): PolicyParams {
  const features = contextToFeatures(ctx);
  const theta = params.weights[action];
  const conf = params.confidence[action];
  
  // Update weights
  for (let i = 0; i < Math.min(theta.length, features.length); i++) {
    theta[i] += learningRate * reward * features[i];
    
    // Clip to reasonable bounds
    theta[i] = Math.max(-10, Math.min(10, theta[i]));
  }
  
  // Reduce confidence (we learned something)
  for (let i = 0; i < conf.length; i++) {
    conf[i] *= confidenceDecay;
    
    // Keep minimum uncertainty
    conf[i] = Math.max(0.1, conf[i]);
  }
  
  params.trained_samples += 1;
  params.last_updated = Date.now();
  
  return params;
}

/**
 * Explain why an action was chosen
 */
export function explainAction(
  ctx: Context,
  action: Action,
  params: PolicyParams
): { explanation: string; contributing_factors: string[] } {
  const features = contextToFeatures(ctx);
  const theta = params.weights[action];
  
  // Calculate feature contributions
  const contributions = features.map((f, i) => ({
    feature: getFeatureName(i),
    value: f,
    weight: theta[i],
    contribution: f * theta[i]
  }));
  
  // Sort by absolute contribution
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  
  // Top 3 contributing factors
  const topFactors = contributions.slice(0, 3);
  
  const explanation = `Selected '${action}' based on: ${topFactors
    .map(f => `${f.feature}=${f.value.toFixed(2)}`)
    .join(', ')}`;
  
  const contributing_factors = topFactors.map(
    f => `${f.feature}: ${f.contribution > 0 ? '+' : ''}${f.contribution.toFixed(3)}`
  );
  
  return { explanation, contributing_factors };
}

/**
 * Get human-readable feature name
 */
function getFeatureName(index: number): string {
  const names = [
    'error_rate',
    'error_spike',
    'p95_normalized',
    'latency_spike',
    'traffic_normalized',
    'traffic_spike',
    'anomaly_severity',
    'anomaly_count',
    'hour_of_day',
    'day_of_week',
    'forecast_trend',
    'bias'
  ];
  return names[index] || `feature_${index}`;
}

/**
 * Get feature dimension
 */
export function getFeatureDimension(): number {
  return 12; // Based on contextToFeatures
}


