// desktop/src/lib/tests/testCoach.ts
// Phase 137.3: Test Coach Logic
// Analyzes test data from TestWatchdog and provides:
// - Overall status: NOT_RUN / FAILING / UNSTABLE / HEALTHY
// - Diagnostic messages
// - Recommendations with action buttons linked to testRecipes

import type { ExternalTestStats } from '../../state/deployQualityContext';
import type { TestRecipeId } from './testRecipes';

/**
 * Test Coach status levels
 */
export type TestCoachStatus = 'NOT_RUN' | 'FAILING' | 'UNSTABLE' | 'HEALTHY';

/**
 * Test Coach summary with diagnostics and recommendations
 */
export interface TestCoachSummary {
  /** Current status */
  status: TestCoachStatus;
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
  /** Number of failed tests */
  failedCount: number;
  /** Number of passed tests */
  passedCount: number;
  /** Total number of tests */
  totalCount: number;
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
function getStatusIcon(status: TestCoachStatus): string {
  switch (status) {
    case 'NOT_RUN':
      return '⏸️';
    case 'FAILING':
      return '❌';
    case 'UNSTABLE':
      return '⚠️';
    case 'HEALTHY':
      return '✅';
  }
}

/**
 * Get status color class
 */
function getStatusColorClass(status: TestCoachStatus): string {
  switch (status) {
    case 'NOT_RUN':
      return 'text-slate-400';
    case 'FAILING':
      return 'text-red-400';
    case 'UNSTABLE':
      return 'text-amber-400';
    case 'HEALTHY':
      return 'text-emerald-400';
  }
}

/**
 * Get status background class
 */
function getStatusBgClass(status: TestCoachStatus): string {
  switch (status) {
    case 'NOT_RUN':
      return 'bg-slate-500/10';
    case 'FAILING':
      return 'bg-red-500/10';
    case 'UNSTABLE':
      return 'bg-amber-500/10';
    case 'HEALTHY':
      return 'bg-emerald-500/10';
  }
}

/**
 * Build Test Coach summary from test stats
 *
 * Analyzes ExternalTestStats from TestWatchdog and generates:
 * - Status assessment
 * - Diagnostic messages (EN/AR)
 * - Recommended actions via testRecipes
 *
 * @param stats - Test stats from TestWatchdog (can be null)
 * @param locale - Current locale ('en' | 'ar')
 * @returns TestCoachSummary with status, messages, and recommendations
 */
export function buildTestCoachSummary(
  stats: ExternalTestStats | null | undefined,
  locale: 'en' | 'ar' = 'en'
): TestCoachSummary {
  // No stats or no tests
  if (!stats || stats.totalTests === 0) {
    const status: TestCoachStatus = 'NOT_RUN';
    return {
      status,
      label: 'Tests not run',
      labelAr: 'لم يتم تشغيل الاختبارات',
      subtitle: 'Run tests to get a quality baseline.',
      subtitleAr: 'شغّل الاختبارات للحصول على خط أساس للجودة.',
      details: [
        'No test results available from TestLab.',
        'Run at least smoke tests before deploying.',
      ],
      detailsAr: [
        'لا توجد نتائج اختبارات متاحة من TestLab.',
        'شغّل على الأقل اختبارات smoke قبل النشر.',
      ],
      failedCount: 0,
      passedCount: 0,
      totalCount: 0,
      recommendedRecipes: ['GENERATE_FILE_TESTS', 'GENERATE_SMOKE_TESTS'],
      icon: getStatusIcon(status),
      colorClass: getStatusColorClass(status),
      bgClass: getStatusBgClass(status),
    };
  }

  const { totalTests, passedTests, failedTests } = stats;
  const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  // Failing tests present
  if (failedTests > 0) {
    const status: TestCoachStatus = 'FAILING';
    return {
      status,
      label: 'Tests failing',
      labelAr: 'اختبارات فاشلة',
      subtitle: `${failedTests} failing out of ${totalTests} tests.`,
      subtitleAr: `${failedTests} اختبار فاشل من ${totalTests}.`,
      details: [
        'Fix failing tests before deploying to avoid regressions.',
        'Prioritize critical and integration test failures first.',
      ],
      detailsAr: [
        'قم بإصلاح الاختبارات الفاشلة قبل النشر لتجنّب المشاكل.',
        'ابدأ بالاختبارات الحرجة والتكاملية أولاً.',
      ],
      failedCount: failedTests,
      passedCount: passedTests,
      totalCount: totalTests,
      recommendedRecipes: ['FIX_FAILING_TESTS', 'EXPLAIN_TEST_FAILURES'],
      icon: getStatusIcon(status),
      colorClass: getStatusColorClass(status),
      bgClass: getStatusBgClass(status),
    };
  }

  // Low pass rate (weak coverage)
  if (passRate < 80) {
    const status: TestCoachStatus = 'UNSTABLE';
    return {
      status,
      label: 'Test coverage is weak',
      labelAr: 'تغطية الاختبارات ضعيفة',
      subtitle: `Pass rate is ${passRate.toFixed(0)}%.`,
      subtitleAr: `نسبة نجاح الاختبارات ${passRate.toFixed(0)}٪.`,
      details: [
        'Increase test coverage for critical flows.',
        'Add smoke tests for deployment-critical paths.',
      ],
      detailsAr: [
        'ارفع تغطية الاختبارات للواجهات الحرجة.',
        'أضف اختبارات smoke للمسارات الحرجة للنشر.',
      ],
      failedCount: failedTests,
      passedCount: passedTests,
      totalCount: totalTests,
      recommendedRecipes: ['IMPROVE_TEST_COVERAGE', 'GENERATE_SMOKE_TESTS'],
      icon: getStatusIcon(status),
      colorClass: getStatusColorClass(status),
      bgClass: getStatusBgClass(status),
    };
  }

  // All tests passing - healthy
  const status: TestCoachStatus = 'HEALTHY';
  return {
    status,
    label: 'Tests are healthy',
    labelAr: 'الاختبارات بحالة جيدة',
    subtitle: `All ${totalTests} tests are passing.`,
    subtitleAr: `جميع ${totalTests} اختبارًا ناجحة.`,
    details: [
      'Keep running tests regularly to maintain confidence.',
      'Consider adding more coverage for new features.',
    ],
    detailsAr: [
      'استمر في تشغيل الاختبارات بانتظام للحفاظ على الثقة.',
      'فكّر في إضافة تغطية أكبر للميزات الجديدة.',
    ],
    failedCount: 0,
    passedCount: passedTests,
    totalCount: totalTests,
    recommendedRecipes: ['IMPROVE_TEST_COVERAGE'],
    icon: getStatusIcon(status),
    colorClass: getStatusColorClass(status),
    bgClass: getStatusBgClass(status),
  };
}

/**
 * Get localized label from TestCoachSummary
 */
export function getTestCoachLabel(
  summary: TestCoachSummary,
  locale: 'en' | 'ar'
): string {
  return locale === 'ar' ? summary.labelAr : summary.label;
}

/**
 * Get localized subtitle from TestCoachSummary
 */
export function getTestCoachSubtitle(
  summary: TestCoachSummary,
  locale: 'en' | 'ar'
): string {
  return locale === 'ar' ? summary.subtitleAr : summary.subtitle;
}

/**
 * Get localized details from TestCoachSummary
 */
export function getTestCoachDetails(
  summary: TestCoachSummary,
  locale: 'en' | 'ar'
): string[] {
  return locale === 'ar' ? summary.detailsAr : summary.details;
}

/**
 * Get the primary recommended recipe
 */
export function getPrimaryTestRecipe(summary: TestCoachSummary): TestRecipeId {
  return summary.recommendedRecipes[0] ?? 'IMPROVE_TEST_COVERAGE';
}

export default buildTestCoachSummary;
