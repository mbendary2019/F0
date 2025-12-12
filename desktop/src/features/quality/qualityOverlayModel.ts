// desktop/src/features/quality/qualityOverlayModel.ts
// Phase 138.6.0: Quality Overlay Model
// Type definitions for the global quality overlay bar

/**
 * Risk level for quality overlay
 */
export type QualityRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * ACE trigger level for overlay display
 */
export type QualityAceLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Tests status for overlay display
 */
export type QualityTestsStatus = 'not_run' | 'passing' | 'failing' | 'running' | 'unknown';

/**
 * Snapshot of quality data for the overlay bar
 */
export type QualityOverlaySnapshot = {
  /** Overall health score 0-100 */
  health: number | null;
  /** Total issues count from project analysis */
  issuesCount: number | null;
  /** Current tests status */
  testsStatus: QualityTestsStatus;
  /** Last tests run timestamp (ISO string) */
  lastTestsAt: string | null;
  /** Security alerts summary */
  securityAlerts: {
    total: number;
    blocking: number;
  };
  /** ACE trigger level */
  aceLevel: QualityAceLevel;
  /** Overall risk level */
  riskLevel: QualityRiskLevel;
  /** Last quality snapshot timestamp (ISO string) */
  lastSnapshotAt: string | null;
  /** True if snapshot is older than 48 hours */
  isStale: boolean;
};

/**
 * State for the quality overlay hook
 */
export type QualityOverlayState = {
  /** Current project ID/path */
  projectId: string | null;
  /** True if any quality data is loading */
  loading: boolean;
  /** Aggregated quality snapshot */
  snapshot: QualityOverlaySnapshot | null;
};
