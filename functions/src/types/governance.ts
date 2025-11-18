/**
 * Phase 39 - Self-Governance & Ethical AI
 * Type definitions for governance policies, risk scores, and reports
 */

export type GovStatus = 'draft' | 'active' | 'disabled';

export interface GovernancePolicy {
  id: string;          // slug, e.g., 'router-safety-guard'
  version: string;     // semver
  status: GovStatus;
  createdAt: number;
  createdBy: string;   // uid/service
  format: 'yaml' | 'json';
  rules: Record<string, any>; // normalized rule AST
  raw?: string;        // source YAML/JSON for display
  notes?: string;
  tags?: string[];     // e.g., ['ethics','risk','latency']
}

export interface RiskScore {
  id: string;          // e.g., 'policy:router-core@1.0.3'
  target: string;      // node id in graph
  kind: 'policy' | 'component' | 'model';
  score: number;       // 0..1
  breakdown: Record<string, number>; // e.g., { violates7d:0.3, drift:0.2, costSpike:0.1 }
  window: '1d' | '7d' | '30d';
  ts: number;
}

export interface GovernanceViolation {
  policyId: string;
  ruleId: string;
  target: string;
  detail: string;
  severity: 'low' | 'med' | 'high';
}

export interface GovernanceReport {
  id: string;          // daily timestamp key
  ts: number;
  violations: GovernanceViolation[];
  summary: {
    total: number;
    high: number;
    med: number;
    low: number;
  };
  notes?: string;
}

export interface EvaluationDecision {
  allow: boolean;
  hold?: boolean;
  reasons: string[];
}

export interface EvaluationRequest {
  policyId: string;
  version: string;
  diff?: Record<string, any>;
}
