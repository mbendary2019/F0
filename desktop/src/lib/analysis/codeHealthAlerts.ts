// desktop/src/lib/analysis/codeHealthAlerts.ts
// Phase 127.1: Health Alert Types & Engine

import type { CodeHealthSnapshot, CodeHealthRun } from './codeHealthTypes';

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export type HealthAlertLevel = 'info' | 'warning' | 'critical';

export type HealthAlertId =
  | 'security_issues_present'
  | 'health_score_drop'
  | 'warnings_spike'
  | 'errors_increase'
  | 'no_recent_scan'
  | 'fix_success'
  | 'score_improved';

export type HealthAlert = {
  /** Unique ID per alert (e.g., "security_issues_present-<timestamp>") */
  id: string;
  /** Alert type identifier */
  type: HealthAlertId;
  /** Severity level */
  level: HealthAlertLevel;
  /** English title */
  title: string;
  /** Arabic title */
  titleAr: string;
  /** English message */
  message: string;
  /** Arabic message */
  messageAr: string;
  /** ISO timestamp when alert was created */
  createdAt: string;
  /** Snapshot ID that triggered this alert */
  snapshotId?: string;
  /** Run ID that triggered this alert */
  runId?: string;
  /** Icon/emoji for the alert */
  icon: string;
};

// ---------------------------------------------------------
// Input for building alerts
// ---------------------------------------------------------

export type BuildAlertsInput = {
  latestSnapshot: CodeHealthSnapshot | null;
  previousSnapshot: CodeHealthSnapshot | null;
  lastRun: CodeHealthRun | null;
};

// ---------------------------------------------------------
// Alert Builder
// ---------------------------------------------------------

/**
 * Build health alerts based on current code health state
 * Uses rule-based logic on existing data (no LLM calls)
 */
export function buildHealthAlerts(input: BuildAlertsInput): HealthAlert[] {
  const { latestSnapshot, previousSnapshot, lastRun } = input;
  const alerts: HealthAlert[] = [];
  const now = new Date().toISOString();

  // No snapshot yet - suggest running a scan
  if (!latestSnapshot) {
    alerts.push({
      id: `no_recent_scan-${now}`,
      type: 'no_recent_scan',
      level: 'info',
      title: 'Run a project scan',
      titleAr: 'قم بفحص المشروع',
      message: 'No recent scan was found. Run a project scan to get an up-to-date code health status.',
      messageAr: 'لم يتم العثور على فحص حديث. قم بفحص المشروع للحصول على حالة صحة الكود الحالية.',
      createdAt: now,
      icon: '🔍',
    });
    return alerts;
  }

  const securityIssues = latestSnapshot.categories.security ?? 0;
  const warnings = latestSnapshot.severity.warnings;
  // Note: errors can be used for future alert types
  void latestSnapshot.severity.errors;

  // 1) Security issues present → Critical
  if (securityIssues > 0) {
    alerts.push({
      id: `security_issues_present-${now}`,
      type: 'security_issues_present',
      level: 'critical',
      title: 'Security issues detected',
      titleAr: 'تم اكتشاف مشاكل أمنية',
      message: `There are ${securityIssues} security-related issues. Review and fix them as a top priority.`,
      messageAr: `يوجد ${securityIssues} مشكلة أمنية. راجعها وأصلحها كأولوية قصوى.`,
      createdAt: now,
      snapshotId: latestSnapshot.id,
      icon: '🔒',
    });
  }

  // 2) Drop in health score (issue count increased significantly)
  if (previousSnapshot) {
    const prevIssues = previousSnapshot.totalIssues;
    const currIssues = latestSnapshot.totalIssues;

    if (currIssues > prevIssues + 100) {
      alerts.push({
        id: `health_score_drop-${now}`,
        type: 'health_score_drop',
        level: 'warning',
        title: 'Issue count increased',
        titleAr: 'زاد عدد المشاكل',
        message: `Total issues increased from ${prevIssues} to ${currIssues}. Recent changes may have introduced new problems.`,
        messageAr: `إجمالي المشاكل زاد من ${prevIssues} إلى ${currIssues}. التغييرات الأخيرة قد أدخلت مشاكل جديدة.`,
        createdAt: now,
        snapshotId: latestSnapshot.id,
        icon: '📉',
      });
    }

    // Score improved significantly
    if (currIssues < prevIssues - 50) {
      const reduced = prevIssues - currIssues;
      alerts.push({
        id: `score_improved-${now}`,
        type: 'score_improved',
        level: 'info',
        title: 'Code health improved',
        titleAr: 'تحسنت صحة الكود',
        message: `Issues reduced by ${reduced}. Great progress on code quality!`,
        messageAr: `تم تقليل المشاكل بـ ${reduced}. تقدم رائع في جودة الكود!`,
        createdAt: now,
        snapshotId: latestSnapshot.id,
        icon: '📈',
      });
    }
  }

  // 3) Too many warnings
  if (warnings > 1500) {
    alerts.push({
      id: `warnings_spike-${now}`,
      type: 'warnings_spike',
      level: 'info',
      title: 'High warning volume',
      titleAr: 'حجم تحذيرات عالي',
      message: `There are ${warnings} warnings. Consider reducing warning noise to surface important errors.`,
      messageAr: `يوجد ${warnings} تحذير. فكر في تقليل ضوضاء التحذيرات لإبراز الأخطاء المهمة.`,
      createdAt: now,
      snapshotId: latestSnapshot.id,
      icon: '⚠️',
    });
  }

  // 4) Errors increased after last run
  if (lastRun && lastRun.before && lastRun.after) {
    const beforeErrors = lastRun.before.severity.errors;
    const afterErrors = lastRun.after.severity.errors;

    if (afterErrors > beforeErrors) {
      alerts.push({
        id: `errors_increase-${now}`,
        type: 'errors_increase',
        level: 'critical',
        title: 'Errors increased after last run',
        titleAr: 'زادت الأخطاء بعد آخر عملية',
        message: `Error count increased from ${beforeErrors} to ${afterErrors} after the last auto-fix run.`,
        messageAr: `عدد الأخطاء زاد من ${beforeErrors} إلى ${afterErrors} بعد آخر عملية إصلاح تلقائي.`,
        createdAt: now,
        runId: lastRun.id,
        icon: '🚨',
      });
    }

    // Fix was successful
    if (lastRun.after.totalIssues < lastRun.before.totalIssues) {
      const fixed = lastRun.before.totalIssues - lastRun.after.totalIssues;
      alerts.push({
        id: `fix_success-${now}`,
        type: 'fix_success',
        level: 'info',
        title: 'Auto-fix completed successfully',
        titleAr: 'اكتمل الإصلاح التلقائي بنجاح',
        message: `Fixed ${fixed} issues in ${lastRun.filesFixed} files.`,
        messageAr: `تم إصلاح ${fixed} مشكلة في ${lastRun.filesFixed} ملف.`,
        createdAt: now,
        runId: lastRun.id,
        icon: '✅',
      });
    }
  }

  // Sort by level (critical first)
  const levelOrder: Record<HealthAlertLevel, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
}

/**
 * Get localized title for an alert
 */
export function getAlertTitle(alert: HealthAlert, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? alert.titleAr : alert.title;
}

/**
 * Get localized message for an alert
 */
export function getAlertMessage(alert: HealthAlert, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? alert.messageAr : alert.message;
}

export default {
  buildHealthAlerts,
  getAlertTitle,
  getAlertMessage,
};
