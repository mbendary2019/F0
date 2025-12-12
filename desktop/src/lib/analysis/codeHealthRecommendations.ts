// desktop/src/lib/analysis/codeHealthRecommendations.ts
// Phase 126.1: Intelligent Recommendations Engine

import type { CodeHealthSnapshot, CodeHealthRun } from './codeHealthTypes';

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export type RecommendationId =
  | 'run_safe_mix_fix'
  | 'run_logging_cleanup'
  | 'run_style_cleanup'
  | 'review_security_issues'
  | 'open_top_offender_file'
  | 'reduce_warning_noise'
  | 'run_full_scan'
  | 'health_score_low';

export type RecommendationSeverity = 'low' | 'medium' | 'high';

export type RecommendationActionType =
  | 'open_project_issues_panel'
  | 'run_project_fix_profile'
  | 'open_file_in_editor'
  | 'open_dashboard'
  | 'scan_project'
  | 'noop';

export type RecommendationActionPayload = {
  profileId?: string;
  maxFiles?: number;
  filePath?: string;
  filterCategory?: string;
  sortBy?: string;
};

export type CodeHealthRecommendation = {
  id: RecommendationId;
  severity: RecommendationSeverity;
  /** English title */
  title: string;
  /** Arabic title */
  titleAr: string;
  /** English description */
  description: string;
  /** Arabic description */
  descriptionAr: string;
  actionType: RecommendationActionType;
  actionPayload?: RecommendationActionPayload;
  /** Icon/emoji for the recommendation */
  icon: string;
};

/**
 * Lightweight file issues summary for recommendations engine
 */
export type FileIssuesSummaryLite = {
  filePath: string;
  relativePath?: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
};

// ---------------------------------------------------------
// Input for building recommendations
// ---------------------------------------------------------

export type BuildRecommendationsInput = {
  latestSnapshot: CodeHealthSnapshot | null;
  lastRun: CodeHealthRun | null;
  fileSummaries: FileIssuesSummaryLite[];
  healthScore?: number;
};

// ---------------------------------------------------------
// Recommendation Builder
// ---------------------------------------------------------

/**
 * Build intelligent recommendations based on current code health state
 * Uses rule-based logic on existing data (no LLM calls)
 */
export function buildCodeHealthRecommendations(
  input: BuildRecommendationsInput
): CodeHealthRecommendation[] {
  const { latestSnapshot, lastRun, fileSummaries, healthScore } = input;
  const recs: CodeHealthRecommendation[] = [];

  // No snapshot yet - suggest running a scan
  if (!latestSnapshot) {
    recs.push({
      id: 'run_full_scan',
      severity: 'medium',
      title: 'Run a project scan',
      titleAr: 'قم بفحص المشروع',
      description: 'No scan data available. Run a project scan to generate recommendations.',
      descriptionAr: 'لا توجد بيانات فحص. قم بفحص المشروع للحصول على توصيات.',
      actionType: 'scan_project',
      icon: '🔍',
    });
    return recs;
  }

  const { totalIssues, severity, categories } = latestSnapshot;
  const warnings = severity.warnings;
  // errors used for logging/future features
  const loggingIssues = categories.logging ?? 0;
  const styleIssues = categories.style ?? 0;
  const securityIssues = categories.security ?? 0;
  const deadCodeIssues = categories.deadCode ?? 0;

  // 1) Security issues - highest priority
  if (securityIssues > 0) {
    recs.push({
      id: 'review_security_issues',
      severity: 'high',
      title: 'Review security issues',
      titleAr: 'راجع مشاكل الأمان',
      description: `There are ${securityIssues} security-related issues detected. Review and fix them as a priority.`,
      descriptionAr: `تم اكتشاف ${securityIssues} مشكلة أمنية. راجعها وأصلحها كأولوية.`,
      actionType: 'open_project_issues_panel',
      actionPayload: { filterCategory: 'security' },
      icon: '🔒',
    });
  }

  // 2) Health score is low - suggest safe_mix fix
  if (healthScore !== undefined && healthScore < 50) {
    recs.push({
      id: 'health_score_low',
      severity: 'high',
      title: 'Improve code health score',
      titleAr: 'حسّن نتيجة صحة الكود',
      description: `Health score is ${healthScore}/100. Run a safe-mix cleanup to improve it significantly.`,
      descriptionAr: `نتيجة صحة الكود هي ${healthScore}/100. شغّل إصلاح آمن لتحسينها بشكل ملحوظ.`,
      actionType: 'run_project_fix_profile',
      actionPayload: { profileId: 'safe_mix', maxFiles: 50 },
      icon: '📈',
    });
  }

  // 3) Logging issues are high - suggest logging cleanup
  if (loggingIssues > 30) {
    recs.push({
      id: 'run_logging_cleanup',
      severity: 'medium',
      title: 'Clean up logging statements',
      titleAr: 'نظّف جمل الـ console.log',
      description: `There are ${loggingIssues} logging/console issues. Run a logging-only cleanup on top files.`,
      descriptionAr: `يوجد ${loggingIssues} مشكلة logging. شغّل تنظيف logging على أهم الملفات.`,
      actionType: 'run_project_fix_profile',
      actionPayload: { profileId: 'logging_only', maxFiles: 30 },
      icon: '📝',
    });
  }

  // 4) Style issues are high - suggest style cleanup
  if (styleIssues > 80) {
    recs.push({
      id: 'run_style_cleanup',
      severity: 'low',
      title: 'Clean up code style',
      titleAr: 'نظّف أسلوب الكود',
      description: `There are ${styleIssues} style/formatting issues. A style-only cleanup can improve readability.`,
      descriptionAr: `يوجد ${styleIssues} مشكلة أسلوب. تنظيف الأسلوب يحسّن قابلية القراءة.`,
      actionType: 'run_project_fix_profile',
      actionPayload: { profileId: 'style_only', maxFiles: 40 },
      icon: '🎨',
    });
  }

  // 5) Last run improved a lot but still many issues - suggest another round
  if (lastRun && lastRun.after && lastRun.before) {
    const diff = lastRun.before.totalIssues - lastRun.after.totalIssues;
    if (diff > 50 && totalIssues > 200) {
      recs.push({
        id: 'run_safe_mix_fix',
        severity: 'medium',
        title: 'Run another safe-mix cleanup',
        titleAr: 'شغّل جولة إصلاح آمن أخرى',
        description: `Last fix removed ${diff} issues. Running again could reduce the remaining ${totalIssues} issues further.`,
        descriptionAr: `آخر إصلاح أزال ${diff} مشكلة. جولة أخرى ستقلل الـ ${totalIssues} المتبقية.`,
        actionType: 'run_project_fix_profile',
        actionPayload: { profileId: 'safe_mix', maxFiles: 50 },
        icon: '🔄',
      });
    }
  }

  // 6) Too many warnings - reduce noise
  if (warnings > 500 && totalIssues > 800) {
    recs.push({
      id: 'reduce_warning_noise',
      severity: 'low',
      title: 'Reduce warning noise',
      titleAr: 'قلل ضوضاء التحذيرات',
      description: `There are ${warnings} warnings. Fixing top warning-heavy files will make important errors stand out.`,
      descriptionAr: `يوجد ${warnings} تحذير. إصلاح أهم الملفات سيجعل الأخطاء المهمة تبرز.`,
      actionType: 'open_project_issues_panel',
      actionPayload: { sortBy: 'warnings' },
      icon: '🔔',
    });
  }

  // 7) Top offender file - most issues
  const topFile = [...fileSummaries]
    .filter((s) => s.issueCount > 0)
    .sort((a, b) => b.issueCount - a.issueCount)[0];

  if (topFile && topFile.issueCount > 10) {
    const displayPath = topFile.relativePath || topFile.filePath.split('/').slice(-2).join('/');
    recs.push({
      id: 'open_top_offender_file',
      severity: topFile.errors > 5 ? 'medium' : 'low',
      title: 'Inspect top offender file',
      titleAr: 'افحص الملف الأكثر مشاكل',
      description: `"${displayPath}" has ${topFile.issueCount} issues (${topFile.errors} errors). Inspect and fix it.`,
      descriptionAr: `"${displayPath}" به ${topFile.issueCount} مشكلة (${topFile.errors} أخطاء). افحصه وأصلحه.`,
      actionType: 'open_file_in_editor',
      actionPayload: { filePath: topFile.filePath },
      icon: '📁',
    });
  }

  // 8) Dead code cleanup suggestion
  if (deadCodeIssues > 50) {
    recs.push({
      id: 'run_safe_mix_fix',
      severity: 'low',
      title: 'Remove dead code',
      titleAr: 'احذف الكود الميت',
      description: `There are ${deadCodeIssues} unused variables/imports. Cleaning them up will reduce bundle size.`,
      descriptionAr: `يوجد ${deadCodeIssues} متغير/import غير مستخدم. حذفها سيقلل حجم الـ bundle.`,
      actionType: 'run_project_fix_profile',
      actionPayload: { profileId: 'safe_mix', maxFiles: 30 },
      icon: '🗑️',
    });
  }

  // Sort by severity (high first) and limit to 5
  const severityOrder: Record<RecommendationSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return recs
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5);
}

/**
 * Get localized title for a recommendation
 */
export function getRecommendationTitle(
  rec: CodeHealthRecommendation,
  locale: 'ar' | 'en'
): string {
  return locale === 'ar' ? rec.titleAr : rec.title;
}

/**
 * Get localized description for a recommendation
 */
export function getRecommendationDescription(
  rec: CodeHealthRecommendation,
  locale: 'ar' | 'en'
): string {
  return locale === 'ar' ? rec.descriptionAr : rec.description;
}

export default {
  buildCodeHealthRecommendations,
  getRecommendationTitle,
  getRecommendationDescription,
};
