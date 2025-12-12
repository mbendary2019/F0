// desktop/src/lib/tests/testRecipes.ts
// Phase 137.2: Test Recipes - Centralized prompt builder for test actions
// Similar to securityRecipes.ts but for test-related agent prompts

/**
 * Available test recipe IDs
 */
export type TestRecipeId =
  | 'GENERATE_FILE_TESTS'
  | 'FIX_FAILING_TESTS'
  | 'AUDIT_TEST_SUITE'
  | 'GENERATE_SMOKE_TESTS'
  | 'EXPLAIN_TEST_FAILURES'
  | 'IMPROVE_TEST_COVERAGE';

/**
 * Supported locales
 */
export type Locale = 'en' | 'ar';

/**
 * Failing test info for context
 */
export interface FailingTestInfo {
  file: string;
  name: string;
  errorMessage?: string;
}

/**
 * Context input for building test prompts
 */
export interface TestContextInput {
  locale: Locale;
  targetFiles?: string[];
  failingTests?: FailingTestInfo[];
  suiteName?: string | null;
  totalTests?: number;
  passedTests?: number;
  failedCount?: number;
}

/**
 * Recipe metadata
 */
interface RecipeMeta {
  id: TestRecipeId;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
}

/**
 * All available recipes with metadata
 */
const RECIPES: Record<TestRecipeId, RecipeMeta> = {
  GENERATE_FILE_TESTS: {
    id: 'GENERATE_FILE_TESTS',
    title: {
      en: 'Generate tests for source files',
      ar: 'توليد اختبارات لملفات الكود',
    },
    description: {
      en: 'Create unit / integration tests for the following source files.',
      ar: 'أنشئ اختبارات وحدات / تكامل للملفات التالية.',
    },
  },
  FIX_FAILING_TESTS: {
    id: 'FIX_FAILING_TESTS',
    title: {
      en: 'Fix failing tests',
      ar: 'إصلاح الاختبارات الفاشلة',
    },
    description: {
      en: 'Debug and fix failing tests, keeping intent and structure.',
      ar: 'قم بتتبع الأخطاء وإصلاح الاختبارات الفاشلة مع الحفاظ على النية والبنية.',
    },
  },
  AUDIT_TEST_SUITE: {
    id: 'AUDIT_TEST_SUITE',
    title: {
      en: 'Full test suite audit',
      ar: 'مراجعة شاملة لمنظومة الاختبارات',
    },
    description: {
      en: 'Review test structure, flakiness, and coverage, and propose improvements.',
      ar: 'راجع بنية الاختبارات، والاستقرار، والتغطية واقترح تحسينات.',
    },
  },
  GENERATE_SMOKE_TESTS: {
    id: 'GENERATE_SMOKE_TESTS',
    title: {
      en: 'Generate smoke tests',
      ar: 'توليد اختبارات Smoke',
    },
    description: {
      en: 'Create high-level smoke tests that validate main user flows.',
      ar: 'أنشئ اختبارات Smoke عالية المستوى تتحقق من أهم مسارات المستخدم.',
    },
  },
  EXPLAIN_TEST_FAILURES: {
    id: 'EXPLAIN_TEST_FAILURES',
    title: {
      en: 'Explain test failures',
      ar: 'شرح أسباب فشل الاختبارات',
    },
    description: {
      en: 'Explain why these tests are failing and suggest fixes.',
      ar: 'اشرح لماذا تفشل هذه الاختبارات واقترح إصلاحات.',
    },
  },
  IMPROVE_TEST_COVERAGE: {
    id: 'IMPROVE_TEST_COVERAGE',
    title: {
      en: 'Improve test coverage',
      ar: 'تحسين تغطية الاختبارات',
    },
    description: {
      en: 'Identify missing scenarios and generate additional tests.',
      ar: 'حدّد السيناريوهات الناقصة وأنشئ اختبارات إضافية.',
    },
  },
};

/**
 * Format file list for prompts
 */
function formatFileList(files: string[] | undefined, locale: Locale): string {
  if (!files?.length) return locale === 'ar' ? 'غير محددة' : 'Not specified';

  const label = locale === 'ar' ? 'الملفات المستهدفة:' : 'Target files:';
  return `${label}\n${files.map((f) => `- ${f}`).join('\n')}`;
}

/**
 * Format failing tests for prompts
 */
function formatFailingTests(
  failing: FailingTestInfo[] | undefined,
  locale: Locale
): string {
  if (!failing?.length) return '';

  const header =
    locale === 'ar'
      ? 'الاختبارات الفاشلة:\n'
      : 'Failing tests:\n';

  const lines = failing.map((t) => {
    const base = `- ${t.name} (${t.file})`;
    if (!t.errorMessage) return base;
    return `${base}\n  ${locale === 'ar' ? 'الخطأ:' : 'Error:'} ${t.errorMessage}`;
  });

  return `${header}${lines.join('\n')}\n`;
}

/**
 * Build a test prompt using a recipe
 *
 * @param recipeId - Recipe ID to use
 * @param ctx - Context input for the recipe
 * @returns Formatted prompt string
 *
 * @example
 * ```ts
 * const prompt = buildTestRecipePrompt('GENERATE_FILE_TESTS', {
 *   locale: 'en',
 *   targetFiles: ['src/utils/math.ts'],
 * });
 * sendToAgent(prompt);
 * ```
 */
export function buildTestRecipePrompt(
  recipeId: TestRecipeId,
  ctx: TestContextInput
): string {
  const meta = RECIPES[recipeId];
  const { locale } = ctx;
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  const filesBlock = formatFileList(ctx.targetFiles, locale);
  const failingBlock = formatFailingTests(ctx.failingTests, locale);

  switch (recipeId) {
    case 'GENERATE_FILE_TESTS':
      return t(
        [
          `🧪 **${meta.title.en}**`,
          '',
          meta.description.en,
          '',
          filesBlock,
          '',
          'Please:',
          '1) Propose a test strategy (unit vs integration).',
          '2) Generate Jest/Vitest-compatible tests.',
          '3) Use clear descriptions and avoid brittle assertions.',
        ].join('\n'),
        [
          `🧪 **${meta.title.ar}**`,
          '',
          meta.description.ar,
          '',
          filesBlock,
          '',
          'المطلوب:',
          '1) اقتراح استراتيجية للاختبارات (وحدات / تكامل).',
          '2) إنشاء اختبارات متوافقة مع Jest/Vitest.',
          '3) استخدام أوصاف واضحة وتجنب التأكيدات الهشة.',
        ].join('\n')
      );

    case 'FIX_FAILING_TESTS':
      return t(
        [
          `🔧 **${meta.title.en}**`,
          '',
          meta.description.en,
          '',
          failingBlock || 'No explicit failing tests provided; infer from context.',
          '',
          'Focus on:',
          '- Preserving the intended behavior.',
          '- Avoiding changes to production code that are not necessary.',
          '- Making failures easier to understand in the future.',
        ].join('\n'),
        [
          `🔧 **${meta.title.ar}**`,
          '',
          meta.description.ar,
          '',
          failingBlock || 'لم يتم تمرير تفاصيل للاختبارات الفاشلة، اعتمد على السياق.',
          '',
          'ركّز على:',
          '- الحفاظ على السلوك المقصود.',
          '- تجنب تعديل كود الإنتاج بدون حاجة حقيقية.',
          '- جعل الأخطاء أسهل في الفهم مستقبلاً.',
        ].join('\n')
      );

    case 'AUDIT_TEST_SUITE':
      return t(
        [
          `🔍 **${meta.title.en}**`,
          '',
          meta.description.en,
          '',
          `Suite: ${ctx.suiteName ?? 'All suites'}`,
          '',
          `Tests: ${ctx.passedTests ?? 0}/${ctx.totalTests ?? 0} passing`,
          '',
          'Please:',
          '- Identify structural problems in test files.',
          '- Suggest how to group tests logically.',
          '- Propose improvements for speed, reliability, and readability.',
        ].join('\n'),
        [
          `🔍 **${meta.title.ar}**`,
          '',
          meta.description.ar,
          '',
          `مجموعة الاختبارات: ${ctx.suiteName ?? 'كل المجموعات'}`,
          '',
          `النتيجة: ${ctx.passedTests ?? 0}/${ctx.totalTests ?? 0} نجحت`,
          '',
          'المطلوب:',
          '- تحديد المشاكل الهيكلية في ملفات الاختبار.',
          '- اقتراح طريقة أفضل لتنظيم الاختبارات.',
          '- اقتراح تحسينات للسرعة والثبات وسهولة القراءة.',
        ].join('\n')
      );

    case 'GENERATE_SMOKE_TESTS':
      return t(
        [
          `💨 **${meta.title.en}**`,
          '',
          meta.description.en,
          '',
          filesBlock,
          '',
          'Focus on:',
          '- Main user journeys.',
          '- Critical business logic.',
          '- Simple, fast checks.',
        ].join('\n'),
        [
          `💨 **${meta.title.ar}**`,
          '',
          meta.description.ar,
          '',
          filesBlock,
          '',
          'ركّز على:',
          '- أهم مسارات المستخدم.',
          '- منطق الأعمال الحرج.',
          '- اختبارات بسيطة وسريعة.',
        ].join('\n')
      );

    case 'EXPLAIN_TEST_FAILURES':
      return t(
        [
          `📚 **${meta.title.en}**`,
          '',
          meta.description.en,
          '',
          failingBlock,
          '',
          'Explain root causes and propose minimal code changes in both tests and source files.',
        ].join('\n'),
        [
          `📚 **${meta.title.ar}**`,
          '',
          meta.description.ar,
          '',
          failingBlock,
          '',
          'اشرح الأسباب الجذرية واقترح أقل تعديلات ممكنة في الاختبارات وكود المصدر.',
        ].join('\n')
      );

    case 'IMPROVE_TEST_COVERAGE':
      return t(
        [
          `📈 **${meta.title.en}**`,
          '',
          meta.description.en,
          '',
          filesBlock,
          '',
          'Identify missing edge-cases and generate additional tests to cover them.',
        ].join('\n'),
        [
          `📈 **${meta.title.ar}**`,
          '',
          meta.description.ar,
          '',
          filesBlock,
          '',
          'حدّد الحالات الطرفية الناقصة وأنشئ اختبارات إضافية لتغطيتها.',
        ].join('\n')
      );
  }
}

/**
 * Get all available recipes with their metadata
 */
export function getAvailableTestRecipes(locale: Locale): Array<{
  id: TestRecipeId;
  label: string;
  description: string;
  icon: string;
}> {
  return [
    {
      id: 'GENERATE_FILE_TESTS',
      label: locale === 'ar' ? 'توليد اختبارات' : 'Generate Tests',
      description: locale === 'ar' ? 'إنشاء اختبارات لملفات معينة' : 'Create tests for specific files',
      icon: '🧪',
    },
    {
      id: 'FIX_FAILING_TESTS',
      label: locale === 'ar' ? 'إصلاح الفاشلة' : 'Fix Failing',
      description: locale === 'ar' ? 'إصلاح الاختبارات الفاشلة' : 'Fix failing tests',
      icon: '🔧',
    },
    {
      id: 'AUDIT_TEST_SUITE',
      label: locale === 'ar' ? 'مراجعة شاملة' : 'Full Audit',
      description: locale === 'ar' ? 'مراجعة منظومة الاختبارات بالكامل' : 'Full test suite audit',
      icon: '🔍',
    },
    {
      id: 'GENERATE_SMOKE_TESTS',
      label: locale === 'ar' ? 'اختبارات Smoke' : 'Smoke Tests',
      description: locale === 'ar' ? 'اختبارات سريعة للتحقق' : 'Quick validation tests',
      icon: '💨',
    },
    {
      id: 'EXPLAIN_TEST_FAILURES',
      label: locale === 'ar' ? 'شرح الفشل' : 'Explain Failures',
      description: locale === 'ar' ? 'شرح أسباب فشل الاختبارات' : 'Explain why tests fail',
      icon: '📚',
    },
    {
      id: 'IMPROVE_TEST_COVERAGE',
      label: locale === 'ar' ? 'تحسين التغطية' : 'Improve Coverage',
      description: locale === 'ar' ? 'تحسين تغطية الاختبارات' : 'Improve test coverage',
      icon: '📈',
    },
  ];
}

export default buildTestRecipePrompt;
