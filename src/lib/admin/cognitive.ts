/**
 * Cognitive Ops Copilot - Client-side utilities
 */

export type Action =
  | 'do_nothing'
  | 'restart_fn'
  | 'reduce_rate'
  | 'disable_endpoint'
  | 'reroute'
  | 'scale_up'
  | 'clear_cache';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';

export type DecisionSummary = {
  id: string;
  timestamp: number;
  action: Action;
  target?: string;
  risk: RiskLevel;
  approval_status: ApprovalStatus;
  expected_gain: number;
  confidence: number;
  reward?: number;
  explanation: string;
  executed: boolean;
};

export type PolicyStats = {
  version: number;
  trained_samples: number;
  last_updated: number;
};

export type Performance = {
  avg_reward: number;
  positive_rate: number;
  avg_error_improvement: number;
  avg_latency_improvement: number;
};


