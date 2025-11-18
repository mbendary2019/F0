/**
 * Phase 41 - Cognitive Federation & Cross-Instance Learning Types
 * Federated learning and policy sharing across F0 instances
 */

export type FedRole = 'publisher' | 'subscriber' | 'both';

export interface FederationPeer {
  id: string; // peer slug, e.g., 'fz-kuwait'
  url: string; // base URL for peer federation API
  pubKey: string; // peer public key (Ed25519)
  role: FedRole; // publisher/subscriber/both
  scopes: string[]; // ['stats','policies','risk']
  allow: boolean; // allowlisted
  createdAt: number;
  lastSeenAt?: number;
}

export interface TelemetryBundle {
  id: string; // tb_{uuid}
  ts: number;
  from: string; // our instance id
  schema: 'v1';
  windows: Array<'1h' | '24h' | '7d'>;
  components: Array<{
    id: string; // e.g., 'Router'
    window: '1h' | '24h' | '7d';
    n: number;
    successRate: number;
    p95Latency: number;
    avgReward: number;
    avgCostUsd: number;
  }>;
  confidence?: Array<{ key: string; score: number; sampleSize: number }>;
  risk?: Array<{ target: string; score: number }>;
  signature: string; // Ed25519 over body
}

export interface PolicyProposal {
  id: string; // pp_{uuid}
  ts: number;
  from: string; // peer id
  policyId: string; // e.g., 'router-core'
  baseVersion: string; // peer source version
  params: Record<string, any>; // e.g., modelWeights deltas
  evidence: {
    // anonymized evidence
    rewardDelta?: number; // +0.03
    latencyDeltaMs?: number; // -250
    sampleSize?: number;
  };
  provenance: { peer: string; signature: string }; // signed by peer key
}

export interface GlobalRiskRecord {
  id: string; // gr_{yyyymmdd}:{policyId}
  ts: number;
  policyId: string;
  aggregates: { mean: number; p95: number; n: number };
  sources: Array<{ peer: string; score: number; weight: number }>;
}
