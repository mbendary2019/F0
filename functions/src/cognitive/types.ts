/**
 * Cognitive Ops Copilot - Types
 * Reinforcement Learning & Autonomous Decision Making
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

/**
 * Feature context for RL policy
 */
export type Context = {
  // Error metrics
  error_rate: number; // 0-1
  error_spike: number; // z-score
  
  // Latency metrics
  p95_normalized: number; // p95/1000
  latency_spike: number; // z-score
  
  // Traffic metrics
  traffic_normalized: number; // calls/100k
  traffic_spike: number; // z-score
  
  // Anomaly context
  anomaly_severity: number; // 0-1 (high=1, medium=0.5, low=0.2)
  anomaly_count: number; // recent count
  
  // Time context
  hour_of_day: number; // 0-23
  day_of_week: number; // 0-6
  
  // Prediction context
  forecast_trend: number; // -1 to 1 (negative=declining, positive=growing)
};

/**
 * RL Policy parameters (LinUCB)
 */
export type PolicyParams = {
  // For each action: learned weights (theta)
  weights: Record<Action, number[]>;
  
  // Confidence bounds (A matrix approximation)
  confidence: Record<Action, number[]>;
  
  // Metadata
  version: number;
  trained_samples: number;
  last_updated: number;
};

/**
 * Decision record
 */
export type Decision = {
  id?: string;
  
  // Context
  context: Context;
  timestamp: number;
  
  // Action selection
  action: Action;
  target?: string; // e.g., endpoint name, function name
  expected_gain: number; // UCB score
  confidence: number; // 0-1
  
  // Risk & approval
  risk: RiskLevel;
  approval_status: ApprovalStatus;
  approval_reason?: string;
  approved_by?: string; // uid
  approved_at?: number;
  
  // Execution
  executed: boolean;
  executed_at?: number;
  execution_result?: any;
  
  // Outcome
  reward?: number; // calculated after observation window
  pre_metrics?: MetricsSnapshot;
  post_metrics?: MetricsSnapshot;
  side_effects?: string[];
  
  // Explanation
  explanation: string;
  contributing_factors: string[];
};

/**
 * Metrics snapshot (before/after action)
 */
export type MetricsSnapshot = {
  timestamp: number;
  error_rate: number;
  p95: number;
  throughput: number;
  cpu?: number;
  memory?: number;
};

/**
 * Guardrail rule
 */
export type Guardrail = {
  id?: string;
  name: string;
  
  // Conditions
  action?: Action; // if specified, applies only to this action
  risk_level?: RiskLevel; // if specified, applies only to this risk level
  
  // Policy
  policy: 'deny' | 'require_approval' | 'allow_with_limit';
  
  // Limits (if policy = allow_with_limit)
  max_impact_percentage?: number; // e.g., throttle max 30%
  cooldown_minutes?: number; // min time between same actions
  
  // Protected targets
  protected_targets?: string[];
  
  enabled: boolean;
  priority: number; // higher = evaluated first
};

/**
 * Outcome evaluation result
 */
export type Outcome = {
  decision_id: string;
  
  // Measurements
  pre_metrics: MetricsSnapshot;
  post_metrics: MetricsSnapshot;
  
  // Improvements
  error_rate_improvement: number; // percentage
  latency_improvement: number; // percentage
  
  // Reward calculation
  reward: number;
  reward_breakdown: {
    error_reduction: number;
    latency_reduction: number;
    side_effect_penalty: number;
    risk_penalty: number;
  };
  
  // Side effects
  side_effects: string[];
  
  timestamp: number;
};

/**
 * Governor decision
 */
export type GovernorDecision = {
  allow: boolean;
  reason?: string;
  approval_required: boolean;
  risk_assessment: RiskLevel;
  matched_guardrails: string[];
};


