/**
 * Self-Evolving Ops - Types
 * Auto-tuning & meta-learning types
 */

export type Tuning = {
  alpha: number; // Exploration parameter (0.1-1.5)
  lr: number; // Learning rate (0.005-0.2)
  weights?: Record<string, number>; // Optional feature weights
  updatedAt: number;
  updatedBy?: string; // 'system' or uid
  reason?: string;
};

export type WindowStats = {
  avgReward: number;
  decisions: number;
  avgMttrMin: number; // Mean Time To Resolve in minutes
  successRate: number; // % of positive outcomes
  autoApprovedRate: number; // % of auto-approved decisions
};

export type PolicyVersion = {
  version: string;
  tuning: Tuning;
  since: number;
  until?: number;
  avgReward: number;
  avgRisk: number;
  decisions: number;
  performance: WindowStats;
  isChampion?: boolean;
};

export type GuardrailAdaptation = {
  targets: string[];
  lastAdapt: number;
  reason: string;
  highRiskRate: number;
  adaptationCount: number;
};

export type AutoDocEntry = {
  timestamp: string;
  policy: Partial<Tuning>;
  guardrails: Partial<GuardrailAdaptation>;
  performance: Partial<WindowStats>;
  changes: string[];
};


