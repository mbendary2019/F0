/**
 * Phase 36 - Self-Learning Orchestrator
 * Type definitions for learning system
 */

export type Outcome = 'success' | 'degraded' | 'failure' | 'timeout';

export interface Observation {
  id: string;             // doc id
  ts: number;             // Date.now()
  jobId?: string;
  component: string;      // e.g., 'AutoScaler', 'router:gpt-5', 'deploy:edge'
  policyVersion?: string; // ops_policies/{id}@v
  inputHash?: string;     // sha256 of normalized input (optional)
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  outcome: Outcome;
  slaMs?: number;         // target latency
  errorCode?: string;
  meta?: Record<string, any>;
}

export interface RewardConfig {
  version: string;
  weights: {
    latency: number;
    cost: number;
    success: number;
    error: number;
  };
  bounds: {
    maxLatencyMs: number;
    maxCostUsd: number;
  };
  thresholds: {
    minAcceptable: number;
    retrain: number;
  };
}

export interface Reward {
  obsId: string;
  ts: number;
  component: string;
  score: number;          // 0..1
  details: {
    latencyPenalty: number;
    costPenalty: number;
    successBoost: number;
    errorPenalty: number;
  };
  configVersion: string;
}

export interface RollingStats {
  component: string;
  window: '1h' | '24h' | '7d';
  ts: number; // updated at
  n: number;
  successRate: number;  // 0..1
  p50Latency: number;
  p95Latency: number;
  avgCostUsd: number;
  avgReward: number;    // 0..1
  // Raw arrays for calculation (capped at 200)
  latencies?: number[];
  costs?: number[];
  rewards?: number[];
  successCount?: number;
}

export interface PolicyDoc {
  id: string;            // slug, e.g., 'router-core'
  version: string;       // semver
  status: 'draft' | 'active' | 'archived';
  createdAt: number;
  createdBy: string;     // uid/service
  notes?: string;
  flags?: Record<string, boolean>;
  params: Record<string, any>; // modelWeights, intervals, thresholds...
}

export interface AuditLog {
  ts: number;
  actor: string;
  action: 'propose' | 'activate' | 'archive' | 'rollback';
  id: string;
  from?: string;
  to?: string;
  note?: string;
}

export interface CandidatePolicyInput {
  id: string; // policy id (e.g. 'router-core')
  currentVersion: string;
  tweak: (params: Record<string, any>) => Record<string, any>;
  note?: string;
}
