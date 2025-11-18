/**
 * Phase 42 - Federated Consensus & Collective Optimization
 * Type definitions for consensus protocol and federated economic optimization
 */

export type Vote = 'accept' | 'reject' | 'abstain';
export type ProposalStatus = 'open' | 'approved' | 'rejected' | 'expired' | 'applied';

export interface ConsensusProposal {
  id: string;
  ts: number;
  policyId: string;
  baseVersion: string;
  params: Record<string, any>;
  from: string; // peer id
  quorum: number; // e.g., 0.67 for ⅔
  ttlMs: number; // e.g., 3600000 (1 hour)
  votes: Array<{
    peer: string;
    vote: Vote;
    reason?: string;
    ts: number;
    sig?: string;
  }>;
  status: ProposalStatus;
  evidence?: {
    rewardDelta?: number;
    latencyDeltaMs?: number;
    sampleSize?: number;
  };
}

export interface FederatedEconomics {
  id: string;
  ts: number;
  objective: 'maximize_reward' | 'minimize_cost' | 'minimize_latency' | 'multi_objective';
  weights?: { reward?: number; cost?: number; latency?: number; risk?: number };
  constraints?: Array<{ param: string; min?: number; max?: number }>;
  candidates: Array<{
    policyId: string;
    version: string;
    params: Record<string, any>;
    score: number;
    from: string;
  }>;
  winner?: string;
  appliedAt?: number;
}

export interface IncentiveCredit {
  id: string;
  ts: number;
  peer: string;
  action: 'telemetry_publish' | 'policy_proposal' | 'vote_cast' | 'consensus_reached' | 'improvement_validated';
  credits: number;
  meta?: Record<string, any>;
}

export interface TrustScore {
  peer: string;
  ts: number;
  score: number; // 0..1
  factors: {
    uptimeRatio?: number;
    goodProposalsRatio?: number;
    votingAccuracy?: number;
    contributionFrequency?: number;
  };
}
