// src/types/ace.ts
// =============================================================================
// Phase 150.3 – ACE (Auto Code Evolution) Types for Web
// Phase 150.3.5 – Added Job types for Web-Desktop bridge
// =============================================================================

export type AceRunSource = 'guided' | 'auto' | 'manual' | 'web';

export type AceRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AceJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AceJobEnvironment = 'desktop' | 'cloud';

/**
 * ACE Job - Created by Web, executed by Desktop
 * Stored in: projects/{projectId}/aceJobs/{jobId}
 */
export interface AceJob {
  id: string;
  type: 'guided' | 'auto';
  source: 'web' | 'desktop';
  status: AceJobStatus;
  createdAt: string;
  createdBy?: string;
  environment: AceJobEnvironment;
  notes?: string;
  runId?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

/**
 * ACE Run - Result of executing an ACE job
 * Stored in: projects/{projectId}/aceRuns/{runId}
 */
export interface AceRun {
  id: string;
  projectId: string;
  source: AceRunSource;
  status: AceRunStatus;
  startedAt: string;
  finishedAt: string;
  filesProcessed: number;
  totalApplied: number;
  totalErrors: number;
  targetedIssues?: number;
  totalSkipped?: number;
  issuesBefore?: number;
  issuesAfter?: number;
  debtDelta?: number;
  createdBy?: string;
  createdFrom?: 'web' | 'desktop';
  jobId?: string;
}

export interface AceRunSummary {
  lastRun: AceRun | null;
  totalRuns: number;
  totalPatches: number;
  totalIssuesFixed: number;
}

export interface TriggerAceRunRequest {
  mode?: 'guided' | 'auto';
  targetFiles?: string[];
}

export interface TriggerAceJobResponse {
  jobId: string;
  status: AceJobStatus;
}

export interface TriggerAceRunResponse {
  run: AceRun;
  message: string;
}
