// desktop/src/lib/ace/aceAlerts.ts
// Phase 128.7: ACE Alerts & Thresholds System
// Phase 130.8: Added test-related alerts

import type { AceMetricsState, AceActivityStatus } from './aceMetricsTypes';
import type { TestStatus, TestRunSummary } from '../tests/testTypes';

/**
 * Alert severity levels
 */
export type AceAlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert types for ACE system
 * Phase 130.8: Added tests_failing and tests_passing
 */
export type AceAlertType =
  | 'health_low'         // Health score dropped below threshold
  | 'health_declining'   // Health score trending down
  | 'suggestions_high'   // Too many suggestions piling up
  | 'stale_scan'         // No recent scan
  | 'phase_stuck'        // A phase has been in_progress too long
  | 'health_improved'    // Positive: health score improved
  | 'tests_failing'      // Phase 130.8: Tests are failing
  | 'tests_passing';     // Phase 130.8: Tests passed after failing

/**
 * ACE Alert structure
 */
export type AceAlert = {
  id: string;
  type: AceAlertType;
  severity: AceAlertSeverity;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  createdAt: string;
  dismissed?: boolean;
  actionLabel?: string;
  actionLabelAr?: string;
  action?: 'open_ace' | 'run_scan' | 'view_suggestions';
};

/**
 * Alert thresholds configuration
 */
export type AceAlertThresholds = {
  /** Health score below this triggers warning (0-100) */
  healthWarning: number;
  /** Health score below this triggers critical (0-100) */
  healthCritical: number;
  /** Score drop by this amount triggers declining alert */
  healthDecline: number;
  /** Suggestions count above this triggers warning */
  suggestionsWarning: number;
  /** Hours since last scan to trigger stale alert */
  staleHours: number;
  /** Hours a phase can be in_progress before stuck alert */
  phaseStuckHours: number;
};

/**
 * Default thresholds
 */
export const defaultAceThresholds: AceAlertThresholds = {
  healthWarning: 50,
  healthCritical: 30,
  healthDecline: 10,
  suggestionsWarning: 15,
  staleHours: 24,
  phaseStuckHours: 48,
};

/**
 * Generate alerts based on current ACE state
 */
export function generateAceAlerts(
  metrics: AceMetricsState,
  currentScore: number,
  suggestionsCount: number,
  isScanning: boolean,
  thresholds: AceAlertThresholds = defaultAceThresholds
): AceAlert[] {
  const alerts: AceAlert[] = [];
  const now = new Date();

  // Skip if currently scanning
  if (isScanning) return alerts;

  // 1. Check health score thresholds
  if (currentScore < thresholds.healthCritical) {
    alerts.push({
      id: `alert-health-critical-${Date.now()}`,
      type: 'health_low',
      severity: 'critical',
      title: 'Critical Health Score',
      titleAr: 'نقاط صحة حرجة',
      message: `Code health is at ${Math.round(currentScore)}%. Immediate action recommended.`,
      messageAr: `صحة الكود عند ${Math.round(currentScore)}%. يُنصح بإجراء فوري.`,
      createdAt: now.toISOString(),
      actionLabel: 'View Suggestions',
      actionLabelAr: 'عرض الاقتراحات',
      action: 'view_suggestions',
    });
  } else if (currentScore < thresholds.healthWarning) {
    alerts.push({
      id: `alert-health-warning-${Date.now()}`,
      type: 'health_low',
      severity: 'warning',
      title: 'Low Health Score',
      titleAr: 'نقاط صحة منخفضة',
      message: `Code health is at ${Math.round(currentScore)}%. Consider addressing suggestions.`,
      messageAr: `صحة الكود عند ${Math.round(currentScore)}%. فكر في معالجة الاقتراحات.`,
      createdAt: now.toISOString(),
      actionLabel: 'Open ACE',
      actionLabelAr: 'فتح ACE',
      action: 'open_ace',
    });
  }

  // 2. Check for health decline
  if (metrics.recomputeHistory.length >= 2) {
    const latest = metrics.recomputeHistory[0];
    const previous = metrics.recomputeHistory[1];
    const decline = previous.overallDebtScore - latest.overallDebtScore;

    if (decline >= thresholds.healthDecline) {
      alerts.push({
        id: `alert-decline-${Date.now()}`,
        type: 'health_declining',
        severity: 'warning',
        title: 'Health Score Declining',
        titleAr: 'نقاط الصحة تتراجع',
        message: `Health dropped by ${Math.round(decline)}% since last scan.`,
        messageAr: `انخفضت الصحة بمقدار ${Math.round(decline)}% منذ آخر فحص.`,
        createdAt: now.toISOString(),
        actionLabel: 'Investigate',
        actionLabelAr: 'فحص',
        action: 'open_ace',
      });
    } else if (decline < 0) {
      // Positive improvement
      const improvement = Math.abs(decline);
      if (improvement >= 5) {
        alerts.push({
          id: `alert-improved-${Date.now()}`,
          type: 'health_improved',
          severity: 'info',
          title: 'Health Improved!',
          titleAr: 'تحسنت الصحة!',
          message: `Health improved by ${Math.round(improvement)}%. Keep it up!`,
          messageAr: `تحسنت الصحة بمقدار ${Math.round(improvement)}%. واصل العمل الجيد!`,
          createdAt: now.toISOString(),
        });
      }
    }
  }

  // 3. Check for too many suggestions
  if (suggestionsCount >= thresholds.suggestionsWarning) {
    alerts.push({
      id: `alert-suggestions-${Date.now()}`,
      type: 'suggestions_high',
      severity: 'warning',
      title: 'Many Pending Suggestions',
      titleAr: 'اقتراحات كثيرة معلقة',
      message: `${suggestionsCount} suggestions waiting. Review and apply some.`,
      messageAr: `${suggestionsCount} اقتراح بانتظار المراجعة. راجعها وطبق بعضها.`,
      createdAt: now.toISOString(),
      actionLabel: 'View Suggestions',
      actionLabelAr: 'عرض الاقتراحات',
      action: 'view_suggestions',
    });
  }

  // 4. Check for stale scan
  const lastRun = metrics.recomputeHistory[0];
  if (lastRun) {
    const lastRunTime = new Date(lastRun.timestamp).getTime();
    const staleMs = thresholds.staleHours * 60 * 60 * 1000;
    if (now.getTime() - lastRunTime > staleMs) {
      alerts.push({
        id: `alert-stale-${Date.now()}`,
        type: 'stale_scan',
        severity: 'info',
        title: 'Scan Outdated',
        titleAr: 'الفحص قديم',
        message: `Last scan was over ${thresholds.staleHours} hours ago. Run a new scan.`,
        messageAr: `آخر فحص كان منذ أكثر من ${thresholds.staleHours} ساعة. قم بفحص جديد.`,
        createdAt: now.toISOString(),
        actionLabel: 'Run Scan',
        actionLabelAr: 'تشغيل الفحص',
        action: 'run_scan',
      });
    }
  } else {
    // No scan ever
    alerts.push({
      id: `alert-no-scan-${Date.now()}`,
      type: 'stale_scan',
      severity: 'info',
      title: 'No Scan Data',
      titleAr: 'لا توجد بيانات فحص',
      message: 'Run your first ACE scan to analyze code health.',
      messageAr: 'قم بتشغيل أول فحص ACE لتحليل صحة الكود.',
      createdAt: now.toISOString(),
      actionLabel: 'Run Scan',
      actionLabelAr: 'تشغيل الفحص',
      action: 'run_scan',
    });
  }

  return alerts;
}

/**
 * Get highest severity from alerts
 */
export function getHighestSeverity(alerts: AceAlert[]): AceAlertSeverity | null {
  if (alerts.some(a => a.severity === 'critical')) return 'critical';
  if (alerts.some(a => a.severity === 'warning')) return 'warning';
  if (alerts.some(a => a.severity === 'info')) return 'info';
  return null;
}

/**
 * Filter active (non-dismissed) alerts
 */
export function getActiveAlerts(alerts: AceAlert[]): AceAlert[] {
  return alerts.filter(a => !a.dismissed);
}

/**
 * Get alert badge color
 */
export function getAlertBadgeColor(severity: AceAlertSeverity): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
  }
}

/**
 * Phase 130.8: Generate test-related alerts
 */
export function generateTestAlerts(
  lastRun: TestRunSummary | null,
  previousRun: TestRunSummary | null
): AceAlert[] {
  const alerts: AceAlert[] = [];
  const now = new Date();

  if (!lastRun) return alerts;

  // Check if tests are failing
  if (lastRun.status === 'failed' || lastRun.status === 'error') {
    const failCount = lastRun.failureCount || lastRun.stats.failed || 0;
    alerts.push({
      id: `alert-tests-failing-${Date.now()}`,
      type: 'tests_failing',
      severity: failCount > 5 ? 'critical' : 'warning',
      title: 'Tests Failing',
      titleAr: 'الاختبارات تفشل',
      message: `${failCount} test(s) failed. Fix them before committing.`,
      messageAr: `فشل ${failCount} اختبار(ات). أصلحها قبل الحفظ.`,
      createdAt: now.toISOString(),
      actionLabel: 'View Tests',
      actionLabelAr: 'عرض الاختبارات',
      action: 'open_ace', // Will be handled to open tests panel
    });
  }

  // Check if tests passed after previously failing
  if (
    previousRun &&
    (previousRun.status === 'failed' || previousRun.status === 'error') &&
    lastRun.status === 'passed'
  ) {
    alerts.push({
      id: `alert-tests-passing-${Date.now()}`,
      type: 'tests_passing',
      severity: 'info',
      title: 'All Tests Passing!',
      titleAr: 'جميع الاختبارات ناجحة!',
      message: 'Great job! All tests are now passing.',
      messageAr: 'عمل رائع! جميع الاختبارات ناجحة الآن.',
      createdAt: now.toISOString(),
    });
  }

  return alerts;
}

export default {
  defaultAceThresholds,
  generateAceAlerts,
  generateTestAlerts,
  getHighestSeverity,
  getActiveAlerts,
  getAlertBadgeColor,
};
