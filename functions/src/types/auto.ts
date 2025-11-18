/**
 * Phase 40 - Autonomous Ecosystem Types
 * Auto-Deploy, Self-Diagnostics, Economic Optimizer, AI-to-AI Bus
 */

export type DeployStage = 'plan'|'build'|'deploy'|'verify'|'rollback'|'done'|'error';
export type DeployResult = 'success'|'partial'|'failed'|'rolled_back';

export interface DeployPlan {
  id: string;                // dp_{uuid}
  ts: number;
  actor: 'auto-deploy'|'admin'|'canary';
  target: { kind:'policy'|'function'|'webapp'|'config'; id:string; version?:string };
  reason: string;            // why this change?
  diff: Record<string, any>; // params/weights/files changed
  guard: { evaluationId?: string; allow:boolean; hold?:boolean; reasons?:string[] };
  stages: Array<{ name: DeployStage; ts: number; status: 'pending'|'ok'|'fail'; log?: string }>;
  result?: DeployResult;
  prevVersion?: string;
}

export interface HealthProbe {
  id: string;
  ts: number;
  component: string;
  status: 'ok'|'warn'|'fail';
  metrics: { latencyMs?: number; errorRate?: number; reward?: number };
  reason?: string;
}

export interface EconTarget {
  component: string;
  objective: 'min_cost'|'max_reward'|'balanced';
  weights?: { cost:number; latency:number; reward:number; risk:number };
  lastScore?: number;
  ts?: number;
}

export interface AgentMessage {
  id: string;
  ts: number;
  from: string;
  to: string;
  type: 'intent'|'status'|'proposal'|'ack'|'nack';
  payload: Record<string, any>;
}
