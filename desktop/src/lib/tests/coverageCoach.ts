// desktop/src/lib/tests/coverageCoach.ts
// Phase 137.4.2: Coverage Coach Logic
// Analyzes coverage data from CoverageWatchdog and provides:
// - Overall status: NONE / LOW / MEDIUM / HIGH
// - Diagnostic messages
// - Recommendations with action buttons linked to testRecipes

import type { ExternalCoverageStats } from '../../state/deployQualityContext';
import type { CoverageSummary } from './coverageTypes';
import type { TestRecipeId } from './testRecipes';

/**
 * Coverage Coach status levels
 */
export type CoverageCoachStatus = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Coverage Coach summary with diagnostics and recommendations
 */
export interface CoverageCoachSummary {
  /** Current status */
  status: CoverageCoachStatus;
  /** EN label */
  label: string;
  /** AR label */
  labelAr: string;
  /** EN short subtitle */
  subtitle: string;
  /** AR subtitle */
  subtitleAr: string;
  /** EN detail bullets */
  details: string[];
  /** AR detail bullets */
  detailsAr: string[];
  /** Total source files */
  totalFiles: number;
  /** Files with any tests */
  filesWithTests: number;
  /** Estimated coverage percentage */
  coveragePercent: number;
  /** High-risk untested files count */
  highRiskCount: number;
  /** Recommended recipes from testRecipes.ts */
  recommendedRecipes: TestRecipeId[];
  /** Icon for the status */
  icon: string;
  /** Color class for the status */
  colorClass: string;
  /** Background color class */
  bgClass: string;
}

/**
 * Get status icon
 */
function getStatusIcon(status: CoverageCoachStatus): string {
  switch (status) {
    case 'NONE':
      return '⚫';
    case 'LOW':
      return '🔴';
    case 'MEDIUM':
      return '🟡';
    case 'HIGH':
      return '🟢';
  }
}

/**
 * Get status color class
 */
function getStatusColorClass(status: CoverageCoachStatus): string {
  switch (status) {
    case 'NONE':
      return 'text-slate-400';
    case 'LOW':
      return 'text-red-400';
    case 'MEDIUM':
      return 'text-amber-400';
    case 'HIGH':
      return 'text-emerald-400';
  }
}

/**
 * Get status background class
 */
function getStatusBgClass(status: CoverageCoachStatus): string {
  switch (status) {
    case 'NONE':
      return 'bg-slate-500/10';
    case 'LOW':
      return 'bg-red-500/10';
    case 'MEDIUM':
      return 'bg-amber-500/10';
    case 'HIGH':
      return 'bg-emerald-500/10';
  }
}

/**
 * Determine coverage status from summary
 */
function getStatusFromSummary(summary: CoverageSummary | null): CoverageCoachStatus {
  if (!summary || summary.totalSourceFiles === 0) return 'NONE';

  const pct = summary.estimatedCoveragePercent ?? 0;

  if (pct < 5) return 'NONE';
  if (pct < 40) return 'LOW';
  if (pct < 75) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Build Coverage Coach summary from coverage stats
 *
 * Analyzes ExternalCoverageStats from CoverageWatchdog and generates:
 * - Status assessment
 * - Diagnostic messages (EN/AR)
 * - Recommended actions via testRecipes
 *
 * @param stats - Coverage stats from CoverageWatchdog (can be null)
 * @param locale - Current locale ('en' | 'ar')
 * @returns CoverageCoachSummary with status, messages, and recommendations
 */
export function buildCoverageCoachSummary(
  stats: ExternalCoverageStats | null | undefined,
  _locale: 'en' | 'ar' = 'en'
): CoverageCoachSummary {
  const summary = stats?.summary ?? null;
  const status = getStatusFromSummary(summary);

  const pct = summary?.estimatedCoveragePercent ?? 0;
  const total = summary?.totalSourceFiles ?? 0;
  const withTests = summary?.filesWithAnyTests ?? 0;
  const highRisk = summary?.highRiskUntestedCount ?? 0;
  // topHintsCount available for future use: stats?.topHints?.length ?? 0

  // NONE - No coverage at all
  if (status === 'NONE') {
    return {
      status,
      label: 'No test coverage',
      labelAr: 'لا توجد تغطية اختبارات',
      subtitle: 'Project has almost no automated tests.',
      subtitleAr: 'المشروع بدون اختبارات تلقائية تقريباً.',
      details: [
        'Critical flows are not covered by tests.',
        'Start by generating unit tests for high-risk files.',
        'Use ACE to bootstrap a basic test suite.',
      ],
      detailsAr: [
        'المسارات الحرجة غير مغطاة بالاختبارات.',
        'ابدأ بإنشاء اختبارات للملفات عالية المخاطر.',
        'استخدم ACE لإنشاء منظومة اختبارات أساسية.',
      ],
      totalFiles: total,
      filesWithTests: withTests,
      coveragePercent: pct,
      highRiskCount: highRisk,
      recommendedRecipes: ['GENERATE_FILE_TESTS', 'GENERATE_SMOKE_TESTS'],
      icon: getStatusIcon(status),
      colorClass: getStatusColorClass(status),
      bgClass: getStatusBgClass(status),
    };
  }

  // LOW - Coverage below 40%
  if (status === 'LOW') {
    return {
      status,
      label: 'Low coverage',
      labelAr: 'تغطية منخفضة',
      subtitle: `Only ~${pct.toFixed(0)}% of files are covered by tests.`,
      subtitleAr: `فقط ~${pct.toFixed(0)}٪ من الملفات مغطاة بالاختبارات.`,
      details: [
        `${withTests}/${total} source files have any tests.`,
        highRisk > 0
          ? `${highRisk} high-risk files have little or no coverage.`
          : 'Key flows might not be protected by tests.',
        'Focus on auth, payments, and deployment logic first.',
      ],
      detailsAr: [
        `${withTests}/${total} ملف مصدر لديه اختبارات.`,
        highRisk > 0
          ? `${highRisk} ملف عالي المخاطر بدون تغطية كافية.`
          : 'المسارات الرئيسية قد لا تكون محمية بالاختبارات.',
        'ركز على منطق المصادقة والدفع والنشر أولاً.',
      ],
      totalFiles: total,
      filesWithTests: withTests,
      coveragePercent: pct,
      highRiskCount: highRisk,
      recommendedRecipes: ['IMPROVE_TEST_COVERAGE', 'GENERATE_FILE_TESTS'],
      icon: getStatusIcon(status),
      colorClass: getStatusColorClass(status),
      bgClass: getStatusBgClass(status),
    };
  }

  // MEDIUM - Coverage 40-75%
  if (status === 'MEDIUM') {
    return {
      status,
      label: 'Medium coverage',
      labelAr: 'تغطية متوسطة',
      subtitle: `Coverage is decent (~${pct.toFixed(0)}%) but can be improved.`,
      subtitleAr: `التغطية جيدة (~${pct.toFixed(0)}٪) لكن يمكن تحسينها.`,
      details: [
        `${withTests}/${total} files are covered by tests.`,
        'Consider strengthening tests around critical business logic.',
        'Add integration / smoke tests for release confidence.',
      ],
      detailsAr: [
        `${withTests}/${total} ملف مغطى بالاختبارات.`,
        'فكر في تقوية الاختبارات حول منطق الأعمال الحرج.',
        'أضف اختبارات تكامل / smoke لزيادة الثقة قبل النشر.',
      ],
      totalFiles: total,
      filesWithTests: withTests,
      coveragePercent: pct,
      highRiskCount: highRisk,
      recommendedRecipes: ['AUDIT_TEST_SUITE', 'IMPROVE_TEST_COVERAGE'],
      icon: getStatusIcon(status),
      colorClass: getStatusColorClass(status),
      bgClass: getStatusBgClass(status),
    };
  }

  // HIGH - Coverage 75%+
  return {
    status,
    label: 'Healthy coverage',
    labelAr: 'تغطية جيدة',
    subtitle: `Good test coverage (~${pct.toFixed(0)}%).`,
    subtitleAr: `تغطية اختبارات جيدة (~${pct.toFixed(0)}٪).`,
    details: [
      'Most important flows appear to be covered.',
      'Keep tests updated as the codebase evolves.',
    ],
    detailsAr: [
      'معظم المسارات المهمة مغطاة على ما يبدو.',
      'حافظ على تحديث الاختبارات مع تطور الكود.',
    ],
    totalFiles: total,
    filesWithTests: withTests,
    coveragePercent: pct,
    highRiskCount: highRisk,
    recommendedRecipes: ['AUDIT_TEST_SUITE'],
    icon: getStatusIcon(status),
    colorClass: getStatusColorClass(status),
    bgClass: getStatusBgClass(status),
  };
}

/**
 * Get localized label from CoverageCoachSummary
 */
export function getCoverageCoachLabel(
  summary: CoverageCoachSummary,
  locale: 'en' | 'ar'
): string {
  return locale === 'ar' ? summary.labelAr : summary.label;
}

/**
 * Get localized subtitle from CoverageCoachSummary
 */
export function getCoverageCoachSubtitle(
  summary: CoverageCoachSummary,
  locale: 'en' | 'ar'
): string {
  return locale === 'ar' ? summary.subtitleAr : summary.subtitle;
}

/**
 * Get localized details from CoverageCoachSummary
 */
export function getCoverageCoachDetails(
  summary: CoverageCoachSummary,
  locale: 'en' | 'ar'
): string[] {
  return locale === 'ar' ? summary.detailsAr : summary.details;
}

/**
 * Get the primary recommended recipe for coverage improvement
 */
export function getPrimaryCoverageRecipe(summary: CoverageCoachSummary): TestRecipeId {
  return summary.recommendedRecipes[0] ?? 'IMPROVE_TEST_COVERAGE';
}

/**
 * Get status icon (exported helper for UI)
 */
export function getCoverageStatusIcon(status: CoverageCoachStatus): string {
  return getStatusIcon(status);
}

/**
 * Get status background class (exported helper for UI)
 */
export function getCoverageStatusBgClass(status: CoverageCoachStatus): string {
  return getStatusBgClass(status);
}

/**
 * Get status color class (exported helper for UI)
 */
export function getCoverageStatusColorClass(status: CoverageCoachStatus): string {
  return getStatusColorClass(status);
}

export default buildCoverageCoachSummary;
