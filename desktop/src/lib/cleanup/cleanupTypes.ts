// desktop/src/lib/cleanup/cleanupTypes.ts
// Phase 129.0: Guided Cleanup Session Types

/**
 * Cleanup session scope - what parts of the project to clean
 */
export type CleanupScope =
  | 'whole_project'   // Scan entire project
  | 'src_only'        // Only src/ directory
  | 'functions_only'  // Only functions/ directory
  | 'custom';         // Custom paths

/**
 * Cleanup intensity level
 */
export type CleanupIntensity =
  | 'safe'        // Only safe, non-breaking fixes (logging, style)
  | 'moderate'    // Safe + type improvements
  | 'aggressive'; // All auto-fixable issues

/**
 * Individual step in a cleanup session
 */
export interface CleanupStep {
  id: string;
  type: 'scan' | 'fix_safe' | 'fix_types' | 'ace_phase' | 'recompute';
  label: string;
  labelAr: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  startedAt?: string;
  completedAt?: string;
  result?: {
    itemsProcessed?: number;
    itemsFixed?: number;
    errors?: string[];
  };
}

/**
 * Session health snapshot
 */
export interface SessionHealthSnapshot {
  score: number;           // 0-100
  totalIssues: number;
  bySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  byCategory: {
    security: number;
    logic: number;
    performance: number;
    style: number;
    bestPractice: number;
  };
}

/**
 * Complete cleanup session
 */
export interface CleanupSession {
  id: string;
  projectId?: string;
  projectRoot: string;

  // Configuration
  scope: CleanupScope;
  customPaths?: string[];  // For 'custom' scope
  intensity: CleanupIntensity;

  // Timeline
  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  // Status
  status: 'draft' | 'running' | 'completed' | 'cancelled' | 'failed';
  currentStepIndex: number;

  // Steps
  steps: CleanupStep[];

  // Results
  healthBefore?: SessionHealthSnapshot;
  healthAfter?: SessionHealthSnapshot;

  // Summary stats
  summary?: {
    filesScanned: number;
    issuesFound: number;
    issuesFixed: number;
    issuesRemaining: number;
    durationMs: number;
    acePhasesRun: string[];
  };

  // Snapshot for rollback
  snapshotId?: string;
}

/**
 * Session history entry (for storage)
 */
export interface CleanupSessionHistoryEntry {
  id: string;
  projectRoot: string;
  completedAt: string;
  scope: CleanupScope;
  intensity: CleanupIntensity;
  healthBefore: number;  // score only
  healthAfter: number;
  issuesFixed: number;
  durationMs: number;
}

/**
 * Cleanup session storage format
 */
export interface CleanupSessionsStorage {
  version: 1;
  lastSessionId?: string;
  sessions: CleanupSession[];
  history: CleanupSessionHistoryEntry[];
}

/**
 * Default steps for a cleanup session based on intensity
 */
export function getDefaultSteps(intensity: CleanupIntensity): CleanupStep[] {
  const baseSteps: CleanupStep[] = [
    {
      id: 'step-scan',
      type: 'scan',
      label: 'Scan project for issues',
      labelAr: 'فحص المشروع',
      status: 'pending',
    },
    {
      id: 'step-fix-safe',
      type: 'fix_safe',
      label: 'Apply safe fixes (logging, style)',
      labelAr: 'تطبيق الإصلاحات الآمنة',
      status: 'pending',
    },
  ];

  if (intensity === 'moderate' || intensity === 'aggressive') {
    baseSteps.push({
      id: 'step-fix-types',
      type: 'fix_types',
      label: 'Fix type issues',
      labelAr: 'إصلاح مشاكل الأنواع',
      status: 'pending',
    });
  }

  if (intensity === 'aggressive') {
    baseSteps.push({
      id: 'step-ace-phase1',
      type: 'ace_phase',
      label: 'Run ACE Phase 1 (Critical)',
      labelAr: 'تشغيل ACE Phase 1',
      status: 'pending',
    });
    baseSteps.push({
      id: 'step-ace-phase4',
      type: 'ace_phase',
      label: 'Run ACE Phase 4 (Cleanup)',
      labelAr: 'تشغيل ACE Phase 4',
      status: 'pending',
    });
  }

  baseSteps.push({
    id: 'step-recompute',
    type: 'recompute',
    label: 'Recompute health score',
    labelAr: 'إعادة حساب النتيجة',
    status: 'pending',
  });

  return baseSteps;
}

/**
 * Create a new cleanup session
 */
export function createCleanupSession(
  projectRoot: string,
  scope: CleanupScope,
  intensity: CleanupIntensity,
  customPaths?: string[],
): CleanupSession {
  const id = `cleanup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    projectRoot,
    scope,
    customPaths,
    intensity,
    createdAt: new Date().toISOString(),
    status: 'draft',
    currentStepIndex: 0,
    steps: getDefaultSteps(intensity),
  };
}

/**
 * Estimate session duration based on project size and intensity
 */
export function estimateSessionDuration(
  fileCount: number,
  intensity: CleanupIntensity,
): { minMs: number; maxMs: number; display: string; displayAr: string } {
  // Base time per file (ms)
  const basePerFile = 50;

  // Multiplier based on intensity
  const multiplier = intensity === 'safe' ? 1 : intensity === 'moderate' ? 1.5 : 2;

  const minMs = fileCount * basePerFile * multiplier;
  const maxMs = minMs * 1.5;

  // Convert to display string
  const minSec = Math.ceil(minMs / 1000);
  const maxSec = Math.ceil(maxMs / 1000);

  let display: string;
  let displayAr: string;

  if (maxSec < 60) {
    display = `${minSec}-${maxSec} seconds`;
    displayAr = `${minSec}-${maxSec} ثانية`;
  } else {
    const minMin = Math.ceil(minSec / 60);
    const maxMin = Math.ceil(maxSec / 60);
    display = `${minMin}-${maxMin} minutes`;
    displayAr = `${minMin}-${maxMin} دقيقة`;
  }

  return { minMs, maxMs, display, displayAr };
}
