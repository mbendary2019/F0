// desktop/src/lib/quality/policyEngine.ts
// Phase 135.2: Quality Policy Engine
// Evaluates project quality against user-defined policy thresholds

import type { QualityPolicyThresholds } from '../../state/qualityPolicyTypes';

/**
 * Policy evaluation status
 */
export type PolicyStatus = 'OK' | 'CAUTION' | 'BLOCK';

/**
 * Reason code for policy violation
 * Phase 136.4: Added granular security codes
 */
export type PolicyReasonCode =
  | 'no_quality_baseline'
  | 'no_recent_scan'
  | 'low_health_score'
  | 'tests_failing'
  | 'tests_not_run'
  | 'security_alerts_present'
  | 'security_critical_present'
  | 'security_too_many_alerts'
  | 'high_issue_count';

/**
 * Severity level for policy reasons
 */
export type PolicySeverity = 'info' | 'warning' | 'critical';

/**
 * A single reason for policy evaluation result
 */
export interface PolicyReason {
  code: PolicyReasonCode;
  label: string;
  labelAr: string;
  severity: PolicySeverity;
  /** Files that contributed to this reason (optional) */
  affectedFiles?: string[];
}

/**
 * Input data for policy evaluation
 * Phase 136.4: Added granular security alert counts
 */
export interface PolicyScanInput {
  /** Project health score (0-100, or null if not scanned) */
  healthScore: number | null;
  /** ISO timestamp of last scan, or null */
  lastScanAt: string | null;
  /** Current test status */
  testsStatus: 'passing' | 'failing' | 'not_run';
  /** Number of failing test suites */
  failingSuites: number;
  /** Whether security alerts are present (legacy - use securityAlertCount) */
  hasSecurityAlerts: boolean;
  /** Number of critical alerts (legacy - use securityCriticalCount) */
  criticalAlertCount: number;
  /** Total number of issues detected */
  totalIssues: number | null;
  /** Files with issues (for affected files tracking) */
  filesWithIssues?: string[];
  /** Files with failing tests */
  filesWithFailingTests?: string[];
  /** Files with security alerts */
  filesWithSecurityAlerts?: string[];

  // --- Phase 136.4: Granular security counts ---
  /** Total security alerts count */
  securityAlertCount?: number;
  /** Critical severity security alerts count */
  securityCriticalCount?: number;
  /** High severity security alerts count */
  securityHighCount?: number;

  // --- Phase 137.0: Test policy fields (foundation only, no logic yet) ---
  /** ISO timestamp of last test run, or null if never run */
  testsLastRunAt?: string | null;
  /** Test coverage percentage (0-100), or null if unknown */
  testCoverage?: number | null;
  /** Number of failing individual tests (not suites) */
  failingTestsCount?: number;
  /** Phase 137.1: Total number of tests */
  totalTestsCount?: number;
}

/**
 * Result of policy evaluation
 */
export interface PolicyEvaluationResult {
  /** Overall status */
  status: PolicyStatus;
  /** List of reasons for the status */
  reasons: PolicyReason[];
  /** All affected files across all reasons */
  affectedFiles: string[];
  /** Summary message */
  summary: string;
  summaryAr: string;
  /** Timestamp of evaluation */
  evaluatedAt: string;
}

/**
 * Compute hours since a given ISO timestamp
 */
function hoursSince(isoTimestamp: string): number {
  const then = new Date(isoTimestamp).getTime();
  return (Date.now() - then) / (1000 * 60 * 60);
}

/**
 * Main policy evaluation function
 *
 * Takes scan results and policy thresholds, returns evaluation result
 * with status (OK/CAUTION/BLOCK), reasons, and affected files.
 */
export function evaluatePolicy(
  scan: PolicyScanInput,
  thresholds: QualityPolicyThresholds
): PolicyEvaluationResult {
  const reasons: PolicyReason[] = [];
  const allAffectedFiles = new Set<string>();

  // --- 1. No quality baseline ---
  if (scan.healthScore == null && !scan.lastScanAt) {
    reasons.push({
      code: 'no_quality_baseline',
      label: 'No Code Health scan baseline found. Run Scan + Tests before deploying.',
      labelAr: 'لا يوجد أساس لفحص صحة الكود. شغّل الفحص والاختبارات قبل النشر.',
      severity: 'warning',
    });
  }

  // --- 2. Stale scan check ---
  if (scan.lastScanAt) {
    const hoursAgo = hoursSince(scan.lastScanAt);
    if (hoursAgo > thresholds.staleScanHours) {
      reasons.push({
        code: 'no_recent_scan',
        label: `Last Code Health scan is older than ${thresholds.staleScanHours}h (${Math.round(hoursAgo)}h ago).`,
        labelAr: `آخر فحص لصحة الكود أقدم من ${thresholds.staleScanHours} ساعة (منذ ${Math.round(hoursAgo)} ساعة).`,
        severity: 'warning',
      });
    }
  } else if (scan.healthScore != null) {
    // Has score but no scan timestamp
    reasons.push({
      code: 'no_recent_scan',
      label: 'No recent Code Health scan found.',
      labelAr: 'لم يُعثر على فحص حديث لصحة الكود.',
      severity: 'warning',
    });
  }

  // --- 3. Health score thresholds ---
  if (typeof scan.healthScore === 'number') {
    // Below minHealthForCaution is CRITICAL → BLOCK
    if (scan.healthScore < thresholds.minHealthForCaution) {
      reasons.push({
        code: 'low_health_score',
        label: `Project health is critically low (${scan.healthScore}%). Minimum: ${thresholds.minHealthForCaution}%`,
        labelAr: `صحة المشروع منخفضة جداً (${scan.healthScore}%). الحد الأدنى: ${thresholds.minHealthForCaution}%`,
        severity: 'critical',
        affectedFiles: scan.filesWithIssues,
      });
      // Add affected files
      scan.filesWithIssues?.forEach((f) => allAffectedFiles.add(f));
    } else if (scan.healthScore < thresholds.minHealthForOk) {
      // Below minHealthForOk is WARNING → CAUTION
      reasons.push({
        code: 'low_health_score',
        label: `Project health is low (${scan.healthScore}%). Target: ${thresholds.minHealthForOk}%`,
        labelAr: `صحة المشروع منخفضة (${scan.healthScore}%). الهدف: ${thresholds.minHealthForOk}%`,
        severity: 'warning',
        affectedFiles: scan.filesWithIssues,
      });
      scan.filesWithIssues?.forEach((f) => allAffectedFiles.add(f));
    }
  }

  // --- 4. Tests status ---
  if (scan.testsStatus === 'failing' || scan.failingSuites > 0) {
    reasons.push({
      code: 'tests_failing',
      label: `There are failing test suites (${scan.failingSuites}).`,
      labelAr: `توجد مجموعات اختبار فاشلة (${scan.failingSuites}).`,
      severity: 'critical',
      affectedFiles: scan.filesWithFailingTests,
    });
    scan.filesWithFailingTests?.forEach((f) => allAffectedFiles.add(f));
  } else if (scan.testsStatus === 'not_run' && thresholds.requireRecentTests) {
    // Only warn if policy requires recent tests
    reasons.push({
      code: 'tests_not_run',
      label: 'Tests have not been run recently (required by policy).',
      labelAr: 'لم يتم تشغيل الاختبارات مؤخراً (مطلوب حسب السياسة).',
      severity: 'warning',
    });
  }

  // --- 5. Security alerts (Phase 136.4: Granular security policy) ---
  const totalSecurityAlerts = scan.securityAlertCount ?? (scan.hasSecurityAlerts ? 1 : 0);
  const criticalSecurityAlerts = scan.securityCriticalCount ?? scan.criticalAlertCount;
  const hasGranularThresholds =
    thresholds.maxSecurityAlertsForOK !== undefined &&
    thresholds.maxSecurityAlertsForDeploy !== undefined;

  if (hasGranularThresholds) {
    // Phase 136.4: Granular security logic
    // Check 1: Critical security alerts with alwaysBlockOnCriticalSecurity
    if (thresholds.alwaysBlockOnCriticalSecurity && criticalSecurityAlerts > 0) {
      reasons.push({
        code: 'security_critical_present',
        label: `Critical security vulnerabilities detected (${criticalSecurityAlerts}). Deployment blocked.`,
        labelAr: `تم اكتشاف ثغرات أمنية حرجة (${criticalSecurityAlerts}). النشر محظور.`,
        severity: 'critical',
        affectedFiles: scan.filesWithSecurityAlerts,
      });
      scan.filesWithSecurityAlerts?.forEach((f) => allAffectedFiles.add(f));
    }
    // Check 2: Too many security alerts → BLOCK
    else if (totalSecurityAlerts > thresholds.maxSecurityAlertsForDeploy) {
      reasons.push({
        code: 'security_too_many_alerts',
        label: `Too many security alerts (${totalSecurityAlerts}). Max for deploy: ${thresholds.maxSecurityAlertsForDeploy}`,
        labelAr: `عدد كبير جداً من التنبيهات الأمنية (${totalSecurityAlerts}). الحد الأقصى للنشر: ${thresholds.maxSecurityAlertsForDeploy}`,
        severity: 'critical',
        affectedFiles: scan.filesWithSecurityAlerts,
      });
      scan.filesWithSecurityAlerts?.forEach((f) => allAffectedFiles.add(f));
    }
    // Check 3: Security alerts above OK threshold → CAUTION
    else if (totalSecurityAlerts > thresholds.maxSecurityAlertsForOK) {
      reasons.push({
        code: 'security_alerts_present',
        label: `Security alerts detected (${totalSecurityAlerts}). Consider fixing before deploy.`,
        labelAr: `تم اكتشاف تنبيهات أمنية (${totalSecurityAlerts}). يُنصح بالإصلاح قبل النشر.`,
        severity: 'warning',
        affectedFiles: scan.filesWithSecurityAlerts,
      });
      scan.filesWithSecurityAlerts?.forEach((f) => allAffectedFiles.add(f));
    }
  } else {
    // Legacy behavior: treatSecurityAlertsAsBlock
    if (scan.hasSecurityAlerts || scan.criticalAlertCount > 0) {
      const severity: PolicySeverity = thresholds.treatSecurityAlertsAsBlock ? 'critical' : 'warning';
      reasons.push({
        code: 'security_alerts_present',
        label: `Security alerts detected (${scan.criticalAlertCount} critical).`,
        labelAr: `تم اكتشاف تنبيهات أمنية (${scan.criticalAlertCount} حرجة).`,
        severity,
        affectedFiles: scan.filesWithSecurityAlerts,
      });
      scan.filesWithSecurityAlerts?.forEach((f) => allAffectedFiles.add(f));
    }
  }

  // --- 6. Issue count threshold ---
  if (scan.totalIssues != null && scan.totalIssues > thresholds.maxIssuesForOk) {
    reasons.push({
      code: 'high_issue_count',
      label: `Too many issues (${scan.totalIssues}). Max allowed: ${thresholds.maxIssuesForOk}`,
      labelAr: `عدد كبير جداً من المشاكل (${scan.totalIssues}). الحد الأقصى: ${thresholds.maxIssuesForOk}`,
      severity: 'warning',
      affectedFiles: scan.filesWithIssues,
    });
    scan.filesWithIssues?.forEach((f) => allAffectedFiles.add(f));
  }

  // --- Determine final status ---
  const hasCritical = reasons.some((r) => r.severity === 'critical');
  const hasWarning = reasons.some((r) => r.severity === 'warning');

  let status: PolicyStatus = 'OK';
  if (hasCritical) {
    status = 'BLOCK';
  } else if (hasWarning) {
    status = 'CAUTION';
  }

  // --- Generate summary ---
  const { summary, summaryAr } = generateSummary(status, reasons);

  return {
    status,
    reasons,
    affectedFiles: Array.from(allAffectedFiles),
    summary,
    summaryAr,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  status: PolicyStatus,
  reasons: PolicyReason[]
): { summary: string; summaryAr: string } {
  switch (status) {
    case 'OK':
      return {
        summary: 'All quality checks passed. Ready to deploy.',
        summaryAr: 'جميع فحوصات الجودة ناجحة. جاهز للنشر.',
      };
    case 'CAUTION':
      return {
        summary: `${reasons.length} warning(s) detected. Review before deploying.`,
        summaryAr: `تم اكتشاف ${reasons.length} تحذير. راجع قبل النشر.`,
      };
    case 'BLOCK':
      const criticalCount = reasons.filter((r) => r.severity === 'critical').length;
      return {
        summary: `${criticalCount} critical issue(s) detected. Deployment blocked.`,
        summaryAr: `تم اكتشاف ${criticalCount} مشكلة حرجة. النشر محظور.`,
      };
  }
}

/**
 * Convert PolicyStatus to deploy level (for UI compatibility)
 */
export function statusToLevel(status: PolicyStatus): 'clean' | 'risky' | 'blocked' {
  switch (status) {
    case 'OK':
      return 'clean';
    case 'CAUTION':
      return 'risky';
    case 'BLOCK':
      return 'blocked';
  }
}

/**
 * Convert deploy level to PolicyStatus
 */
export function levelToStatus(level: 'clean' | 'risky' | 'blocked'): PolicyStatus {
  switch (level) {
    case 'clean':
      return 'OK';
    case 'risky':
      return 'CAUTION';
    case 'blocked':
      return 'BLOCK';
  }
}

/**
 * Check if deployment should be allowed
 */
export function canDeployWithStatus(status: PolicyStatus): boolean {
  return status !== 'BLOCK';
}

/**
 * Get icon for status
 */
export function getStatusIcon(status: PolicyStatus): string {
  switch (status) {
    case 'OK':
      return '✅';
    case 'CAUTION':
      return '⚠️';
    case 'BLOCK':
      return '🚫';
  }
}

/**
 * Get color class for status
 */
export function getStatusColorClass(status: PolicyStatus): string {
  switch (status) {
    case 'OK':
      return 'text-emerald-400';
    case 'CAUTION':
      return 'text-amber-400';
    case 'BLOCK':
      return 'text-red-400';
  }
}

/**
 * Get background color class for status
 */
export function getStatusBgClass(status: PolicyStatus): string {
  switch (status) {
    case 'OK':
      return 'bg-emerald-500/20';
    case 'CAUTION':
      return 'bg-amber-500/20';
    case 'BLOCK':
      return 'bg-red-500/20';
  }
}
