/**
 * Phase 37 - Meta-Learning & Adaptive Policies
 * Type definitions for confidence estimation and adaptive decisions
 */

export type ConfidenceReason =
  | 'low_sample_size'
  | 'high_latency_variance'
  | 'reward_instability'
  | 'model_drift'
  | 'cost_spike'
  | 'slo_violations'
  | 'ok';

export interface Confidence {
  component: string;        // e.g., 'router', 'AutoScaler'
  subject?: string;         // e.g., 'gpt-5' or policy id
  window: '1h' | '24h' | '7d';
  score: number;            // 0..1
  reasons: ConfidenceReason[];
  sampleSize: number;
  metrics: {
    rewardAvg: number;
    rewardStd: number;
    latencyP95: number;
    latencyStd: number;
    costAvg: number;
    costStd: number;
    successRate: number;
  };
  ts: number;
}

export interface DecisionRecord {
  id: string;               // uuid
  ts: number;
  actor: 'adaptive-router' | 'self-tuning-scheduler' | 'admin';
  component: string;        // router|AutoScaler|CanaryManager
  before: Record<string, any> | null; // previous params/policy
  after: Record<string, any> | null;  // new params/policy
  confidence: number;       // 0..1
  reasons: ConfidenceReason[];
  guardrail: 'passed' | 'failed';
  abBucket?: 'adaptive' | 'control' | 'prod';
  effect?: {
    expectedRewardDelta?: number;
    expectedLatencyDeltaMs?: number;
  };
}
