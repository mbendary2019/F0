// desktop/src/lib/deploy/deployQualityTypes.ts
// Phase 134.0: Deploy Quality Gate Types

/**
 * Deploy quality level - determines if deploy should proceed
 */
export type DeployQualityLevel = 'clean' | 'risky' | 'blocked';

/**
 * Reason codes for quality issues
 */
export type DeployQualityReasonCode =
  | 'no_recent_scan'
  | 'low_health_score'
  | 'tests_failing'
  | 'tests_not_run'
  | 'security_alerts_present'
  | 'no_quality_baseline'
  | 'high_issue_count';

/**
 * A single quality concern/reason
 */
export interface DeployQualityReason {
  /** Unique code for this reason */
  code: DeployQualityReasonCode;
  /** Human-readable label for display */
  label: string;
  /** Arabic label for RTL display */
  labelAr: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Full quality snapshot for deploy decision
 */
export interface DeployQualitySnapshot {
  // From Quality Monitor
  /** Current health score (0-100) */
  healthScore: number | null;
  /** Last scan timestamp (ISO) */
  lastScanAt: string | null;
  /** Last ACE run timestamp (ISO) */
  lastAceRunAt: string | null;
  /** Last cleanup session timestamp (ISO) */
  lastCleanupAt: string | null;
  /** Current tests status */
  testsStatus: 'passing' | 'failing' | 'not_run';

  // From TestLab
  /** Total test suites discovered */
  totalSuites: number;
  /** Number of failing test suites */
  failingSuites: number;
  /** Test pass rate percentage */
  testPassRate: number | null;

  // From Health Alerts
  /** Whether there are security-related alerts */
  hasSecurityAlerts: boolean;
  /** Count of critical alerts */
  criticalAlertCount: number;

  // From CodeHealth
  /** Total issues from last scan */
  totalIssues: number | null;

  // Computed
  /** Overall quality level */
  level: DeployQualityLevel;
  /** List of quality concerns */
  reasons: DeployQualityReason[];
  /** When this snapshot was generated */
  generatedAt: string;
}

/**
 * Context value type
 */
export interface DeployQualityContextValue {
  /** Current quality snapshot */
  snapshot: DeployQualitySnapshot | null;
  /** Whether snapshot is being computed */
  isLoading: boolean;
  /** Refresh/recompute the snapshot */
  refresh: () => void;
  /** Check if deploy is allowed */
  canDeploy: () => boolean;
  /** Get deploy button color based on level */
  getDeployButtonStyle: () => {
    bgColor: string;
    hoverColor: string;
    icon: string;
  };
}

/**
 * Thresholds for quality checks
 */
export const DEPLOY_QUALITY_THRESHOLDS = {
  /** Health score below this is critical */
  criticalHealthScore: 50,
  /** Health score below this is warning */
  warningHealthScore: 70,
  /** Scan older than this (hours) triggers warning */
  staleScanthreshold: 24,
  /** Issue count above this is warning */
  highIssueCount: 100,
} as const;

/**
 * Get color scheme for deploy quality level
 */
export function getDeployLevelColors(level: DeployQualityLevel): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (level) {
    case 'clean':
      return {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/40',
        text: 'text-emerald-100',
        icon: '✅',
      };
    case 'risky':
      return {
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/40',
        text: 'text-amber-100',
        icon: '⚠️',
      };
    case 'blocked':
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/40',
        text: 'text-red-100',
        icon: '🚫',
      };
  }
}

/**
 * Get label for deploy quality level
 */
export function getDeployLevelLabel(
  level: DeployQualityLevel,
  locale: 'en' | 'ar' = 'en'
): string {
  const labels: Record<DeployQualityLevel, { en: string; ar: string }> = {
    clean: { en: 'Ready to Deploy', ar: 'جاهز للنشر' },
    risky: { en: 'Deploy with Caution', ar: 'انشر بحذر' },
    blocked: { en: 'Deploy Blocked', ar: 'النشر محظور' },
  };
  return labels[level][locale];
}
