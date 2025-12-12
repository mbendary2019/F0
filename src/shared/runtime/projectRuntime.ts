// src/shared/runtime/projectRuntime.ts
// =============================================================================
// Phase 150.5 – Shared runtime types (Desktop + Web)
// Single source of truth for Firestore schema
// =============================================================================
// 🔒 LOCK (Phase 150.7): This file is the single source of truth for runtime types.
//    DO NOT duplicate these types elsewhere. All Web & Desktop components must import from here.
// =============================================================================

/**
 * Quality status levels
 */
export type QualityStatus = 'good' | 'caution' | 'needs_work' | 'blocked';

/**
 * Quality snapshot source
 */
export type QualitySnapshotSource = 'scan' | 'auto_fix_after_scan';

/**
 * Quality snapshot document schema
 * Stored in: projects/{projectId}/qualitySnapshots/{snapshotId}
 */
export interface QualitySnapshotDoc {
  source: QualitySnapshotSource;
  filesScanned: number;
  totalIssues: number;
  score: number; // 0-100
  status: QualityStatus;
  recordedAt: string; // ISO string (converted from Timestamp)
}

/**
 * ACE run source types
 */
export type AceRunSource = 'guided' | 'auto' | 'manual' | 'web';

/**
 * ACE run document schema
 * Stored in: projects/{projectId}/aceRuns/{runId}
 */
export interface AceRunDoc {
  id: string;
  startedAt: string;
  finishedAt: string;
  filesProcessed: number;
  totalApplied: number;
  totalErrors: number;
  targetedIssues?: number;
  totalSkipped?: number;
  issuesBefore?: number;
  issuesAfter?: number;
  projectRoot?: string;
  source: AceRunSource;
  jobId?: string; // Reference to aceJobs if triggered from web
}

/**
 * Security severity levels
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security stats document schema
 * Stored in: projects/{projectId}/security/latest
 */
export interface SecurityStatsDoc {
  totalAlerts: number;
  hasBlocking: boolean;
  bySeverity?: {
    low?: number;
    medium?: number;
    high?: number;
    critical?: number;
  };
  updatedAt: string;
}

/**
 * Tests status types
 */
export type TestsStatus = 'ok' | 'not_run' | 'failing';

/**
 * Tests stats document schema
 * Stored in: projects/{projectId}/tests/latest
 */
export interface TestsStatsDoc {
  status: TestsStatus;
  coverage?: number | null;
  lastRunAt?: string | null;
  suites?: {
    passed?: number;
    failed?: number;
    skipped?: number;
  };
  updatedAt: string;
}

/**
 * Runtime error types for error handling
 */
export type RuntimeErrorType =
  | 'quality_listener'
  | 'ace_listener'
  | 'security_listener'
  | 'tests_listener';

/**
 * Runtime error info
 */
export interface RuntimeError {
  type: RuntimeErrorType;
  message: string;
  timestamp: string;
}

/**
 * Complete project runtime state
 */
export interface ProjectRuntimeState {
  latestQuality: QualitySnapshotDoc | null;
  latestAceRun: AceRunDoc | null;
  securityStats: SecurityStatsDoc | null;
  testsStats: TestsStatsDoc | null;
  loading: boolean;
  // Phase 150.6.1: Error handling
  errors: RuntimeError[];
}

/**
 * Initial runtime state
 */
export const initialRuntimeState: ProjectRuntimeState = {
  latestQuality: null,
  latestAceRun: null,
  securityStats: null,
  testsStats: null,
  loading: true,
  errors: [],
};

/**
 * Convert Firestore Timestamp to ISO string
 */
export function timestampToIso(timestamp: { toDate: () => Date } | null | undefined): string | null {
  if (!timestamp || typeof timestamp.toDate !== 'function') return null;
  return timestamp.toDate().toISOString();
}

/**
 * Convert ISO string to Date
 */
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(iso);
}

export default {
  initialRuntimeState,
  timestampToIso,
  isoToDate,
};
