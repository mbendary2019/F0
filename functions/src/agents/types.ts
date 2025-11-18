/**
 * Agent System Types
 * Autonomous operations with LLM-powered decision making
 */

export type AgentKind = 'predict' | 'remediate' | 'report' | 'guard';

export type AgentStatus = 'queued' | 'running' | 'done' | 'rejected';

export type AgentJob = {
  id?: string;
  kind: AgentKind;
  payload: Record<string, unknown>;
  status?: AgentStatus;
  createdAt?: number;
  updatedAt?: number;
  requestedBy?: string; // uid
  result?: any;
  decision?: GuardDecision;
  error?: string;
};

export type GuardDecision = {
  allow: boolean;
  reason?: string;
  risk?: 'low' | 'medium' | 'high';
  timestamp?: number;
};

export type LLMInsight = {
  summary: string;
  confidence: number;
  suggestions: string[];
  analysis?: {
    anomalies?: number;
    trends?: string[];
    risks?: string[];
  };
};

export type Runbook = {
  id?: string;
  name: string;
  trigger: string;
  steps: string[];
  cooldown?: number;
  enabled: boolean;
  lastTriggered?: number;
  createdBy?: string;
  createdAt?: number;
};

export type OpsCommand = {
  ts: number;
  cmd: string;
  target?: string;
  by: string;
  status?: 'pending' | 'executed' | 'failed';
  result?: any;
};
