/**
 * Human-in-the-Loop (HITL) Review Types
 * Type definitions for HITL review system
 */

export type ReviewStatus = 'queued' | 'assigned' | 'in_review' | 'resolved';
export type ReviewSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReviewLabel =
  | 'toxicity'
  | 'pii'
  | 'bias'
  | 'hallucination'
  | 'factuality'
  | 'safety';
export type ReviewAction = 'regenerate' | 'redact' | 'approve' | 'reject';

export interface ReviewTimeline {
  ts: number;
  actor: string;
  event: string;
  diff?: Record<string, any>;
}

export interface ReviewOutcome {
  action: ReviewAction;
  notes: string;
  artifacts?: {
    safeTextUrl?: string;
    redactedText?: string;
  };
}

export interface AIReview {
  id?: string;
  uid: string;
  runId: string;
  model: string;
  createdAt: FirebaseFirestore.Timestamp;
  status: ReviewStatus;
  severity: ReviewSeverity;
  labels: ReviewLabel[];
  assignedTo?: string;
  slaDueAt?: FirebaseFirestore.Timestamp;
  outcome?: ReviewOutcome;
  timeline: ReviewTimeline[];

  // Evaluation metadata
  quality: number;
  bias: number;
  toxicity: number;
  piiLeak: boolean;

  // Hash references (privacy-first)
  promptHash: string;
  outputHash: string;

  // Optional preview (if AI_EVAL_STORE_PROMPTS=true)
  promptPreview?: string;
  outputPreview?: string;
}

export interface PolicyCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'in';
  value: any;
}

export interface PolicyAction {
  type: 'set_severity' | 'set_sla' | 'auto_assign' | 'escalate';
  params: Record<string, any>;
}

export interface AIPolicy {
  id?: string;
  name: string;
  enabled: boolean;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  thresholds?: Record<string, number>;
  priority: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

export interface RedTeamTest {
  id?: string;
  category: string;
  prompt: string;
  expected: 'reject' | 'safe_response' | 'no_pii' | 'factual';
  severity: ReviewSeverity;
  tags?: string[];
}

export interface RedTeamResult {
  testId: string;
  pass: boolean;
  actualOutput?: string;
  notes?: string;
  flagged?: boolean;
  quality?: number;
  toxicity?: number;
  bias?: number;
  piiLeak?: boolean;
}

export interface RedTeamRun {
  id?: string;
  startedAt: FirebaseFirestore.Timestamp;
  finishedAt?: FirebaseFirestore.Timestamp;
  pass: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: RedTeamResult[];
  metadata?: {
    model?: string;
    triggeredBy?: string;
  };
}
