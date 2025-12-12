// desktop/src/lib/quality/codeEvolutionCopy.ts
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 149.5: Official UI Copy for Auto-Fix Engine & Code Evolution (EN/AR)
// Centralized translations for consistent messaging across components

export type Locale = 'en' | 'ar';

/**
 * Get text based on locale
 */
export function t(locale: Locale, en: string, ar: string): string {
  return locale === 'ar' ? ar : en;
}

/**
 * Auto-Fix Engine Panel Copy
 */
export const autoFixEngineCopy = {
  // Section Header
  title: {
    en: 'Auto-Fix Engine',
    ar: 'محرك الإصلاح التلقائي',
  },
  description: {
    en: 'ACE tries to apply safe fixes based on AI-powered analysis of your code.',
    ar: 'يستخدم ACE تحليلاً مدعوماً بالذكاء الاصطناعي لمحاولة تطبيق إصلاحات آمنة على الكود.',
  },

  // Metric Labels
  labels: {
    runs: { en: 'Runs', ar: 'مرّات التشغيل' },
    fixes: { en: 'Fixes', ar: 'الإصلاحات المطبَّقة' },
    files: { en: 'Files', ar: 'الملفات' },
    errors: { en: 'Errors', ar: 'الأخطاء' },
    targeted: { en: 'Targeted', ar: 'مستهدفة' },
    estReduction: { en: 'Est. ↓', ar: 'تقليل' },
    patches: { en: 'Patches', ar: 'باتشات' },
  },

  // Success State (IMPROVED)
  improved: {
    title: { en: 'Improvements applied', ar: 'تم تطبيق تحسينات' },
    body: {
      en: (fixes: number, files: number) =>
        `ACE applied ${fixes} safe change${fixes !== 1 ? 's' : ''} across ${files} file${files !== 1 ? 's' : ''} in the last run.`,
      ar: (fixes: number, files: number) =>
        `قام ACE بتطبيق ${fixes} تغيير${fixes !== 1 ? 'اً' : ''} آمن${fixes !== 1 ? 'اً' : ''} عبر ${files} ملف في آخر تشغيل.`,
    },
  },

  // No Change State
  noChange: {
    badge: { en: 'No safe changes found', ar: 'لا توجد تغييرات آمنة مناسبة' },
    body: {
      en: "ACE reviewed the selected files but didn't find any changes that would safely improve quality under the current risk profile.",
      ar: 'قام ACE بمراجعة الملفات المحددة لكنه لم يجد أي تغييرات يمكن أن تحسّن الجودة بأمان تحت إعدادات مستوى الخطورة الحالية.',
    },
    tooltip: {
      en: 'This is normal once the most obvious issues are fixed. You can adjust the risk level or target different files for more aggressive cleanup.',
      ar: 'هذا سلوك طبيعي بعد إصلاح أغلب المشكلات الواضحة. يمكنك تعديل مستوى الخطورة أو استهداف ملفات مختلفة للحصول على تنظيف أكثر جرأة.',
    },
  },

  // Phase 149.8: Explicit 0 patches label for zero-patch runs
  noSafeChanges: {
    title: {
      en: 'No safe changes found',
      ar: 'لم يجد ACE تغييرات آمنة للتطبيق في هذا التشغيل (0 تصحيحات).',
    },
    description: {
      en: 'ACE reviewed the selected files but did not find any changes that would safely improve quality under the current risk profile.',
      ar: 'قام ACE بمراجعة الملفات المحددة لكنه لم يجد أي تعديلات يمكن تطبيقها بأمان لتحسين الجودة وفقًا لملف المخاطر الحالي.',
    },
  },

  // Error State
  error: {
    badge: { en: 'Run completed with errors', ar: 'انتهى التشغيل مع وجود أخطاء' },
    body: {
      en: "ACE couldn't safely apply fixes to some files. Check the logs for details or try again with a smaller selection of files.",
      ar: 'تعذّر على ACE تطبيق إصلاحات آمنة على بعض الملفات. راجع السجلات لمزيد من التفاصيل أو أعد المحاولة مع مجموعة أصغر من الملفات.',
    },
  },

  // Last Run Summary
  lastRun: {
    title: { en: 'Last ACE Run', ar: 'آخر تشغيل ACE' },
    noRuns: { en: 'No runs yet', ar: 'لا يوجد تشغيل' },
    noRunsHint: {
      en: 'Run ACE Auto-Fix or Auto-Improve to see summary here',
      ar: 'شغّل ACE Auto-Fix أو Auto-Improve عشان تشوف ملخّص هنا',
    },
    lastRunSummary: { en: 'Last Run Summary', ar: 'ملخص آخر تشغيل' },
    currentIssues: { en: 'Current issues', ar: 'المشاكل الحالية' },
    beforeRun: { en: 'Before run', ar: 'قبل التشغيل' },
  },

  // Evolution Button
  openEvolution: {
    label: { en: 'Code Evolution', ar: 'محرك تطور الكود' },
    fullLabel: { en: 'Open Code Evolution', ar: 'عرض تطوّر الكود' },
    tooltip: {
      en: 'See how recent ACE runs affected your overall code quality.',
      ar: 'اطّلع على تأثير تشغيلات ACE الأخيرة على جودة الكود بشكل عام.',
    },
  },
};

/**
 * Code Evolution Modal Copy
 */
export const codeEvolutionCopy = {
  // Modal Header
  title: { en: 'Code Evolution Engine', ar: 'محرك تطوّر الكود' },
  subtitle: {
    en: 'Track how your code quality changes over time with ACE runs and quality scans.',
    ar: 'تابِع كيف تتغير جودة الكود مع مرور الوقت من خلال تشغيلات ACE وفحوصات الجودة.',
  },

  // Tabs
  tabs: {
    overview: { en: 'Overview', ar: 'نظرة عامة' },
    plan: { en: 'Evolution Plan', ar: 'خطة التطوّر' },
    suggestions: { en: 'Suggestions', ar: 'اقتراحات' },
  },

  // Summary Metrics
  metrics: {
    runsAnalyzed: { en: 'Runs analyzed', ar: 'عدد التشغيلات' },
    improvedRuns: { en: 'Improved runs', ar: 'تشغيلات محسّنة' },
    totalResolved: { en: 'Total issues resolved', ar: 'إجمالي المشكلات التي تم حلّها' },
    evolutionTrend: { en: 'Evolution trend', ar: 'اتجاه التطوّر' },
    currentHealth: { en: 'Current Health', ar: 'الصحة الحالية' },
    deltaEvolution: { en: 'Delta Evolution', ar: 'تطور الدلتا' },
    last10Runs: { en: 'Last 10 runs', ar: 'آخر 10 تشغيلات' },
    recentRuns: { en: 'Recent Runs', ar: 'التشغيلات الأخيرة' },
  },

  // Run Status Labels
  status: {
    IMPROVED: { en: 'Improved', ar: 'تحسُّن' },
    NO_CHANGE: { en: 'No change', ar: 'بدون تغيير' },
    REGRESSION: { en: 'Regression', ar: 'تراجع' },
    INCOMPLETE: { en: 'Incomplete', ar: 'غير مكتمل' },
  },

  // Trend Labels
  trend: {
    UP: { en: 'Improving', ar: 'تحسّن', full: { en: 'Upward', ar: 'اتجاه صاعد' } },
    DOWN: { en: 'Regressing', ar: 'تراجع', full: { en: 'Downward', ar: 'اتجاه هابط' } },
    FLAT: { en: 'Stable', ar: 'مستقر', full: { en: 'Stable', ar: 'مستقر' } },
  },

  // Empty State
  empty: {
    title: { en: 'No ACE runs yet', ar: 'لا توجد تشغيلات ACE بعد' },
    body: {
      en: 'No evolution data yet. Run ACE Auto-Fix and quality scans to start tracking how your code improves over time.',
      ar: 'لا توجد بيانات تطوّر حتى الآن. قم بتشغيل ACE للإصلاح التلقائي وفحوصات الجودة لبدء تتبّع تحسّن الكود مع مرور الوقت.',
    },
    hint: {
      en: 'Run ACE Auto-Fix or Auto-Improve to start tracking code evolution',
      ar: 'شغّل ACE Auto-Fix أو Auto-Improve عشان تبدأ تتبع تطور الكود',
    },
  },

  // Sparkline Labels
  sparkline: {
    oldest: { en: 'Oldest', ar: 'أقدم' },
    latest: { en: 'Latest', ar: 'أحدث' },
    notEnoughData: { en: 'Not enough data', ar: 'بيانات غير كافية' },
  },

  // Buttons
  buttons: {
    recompute: { en: 'Recompute', ar: 'إعادة حساب' },
    computing: { en: 'Computing...', ar: 'جاري الحساب...' },
    close: { en: 'Close', ar: 'إغلاق' },
  },

  // Narrative Text (for trend summary)
  narrative: {
    UP: {
      en: (improved: number, total: number) =>
        `🎉 Your code is improving! ${improved} of ${total} runs improved quality.`,
      ar: (improved: number, total: number) =>
        `🎉 كودك بيتحسن! ${improved} من ${total} تشغيلات حسّنت الجودة.`,
    },
    DOWN: {
      en: '⚠️ Quality is regressing. Review recent changes.',
      ar: '⚠️ فيه تراجع في الجودة. راجع التغييرات الأخيرة.',
    },
    FLAT: {
      en: '➡️ Quality is stable. Run ACE to improve.',
      ar: '➡️ الجودة مستقرة. شغّل ACE عشان تحسّنها.',
    },
  },
};

/**
 * NO_CHANGE Specific Suggestions
 * Used when recent runs didn't apply any changes
 */
export const noChangeSuggestions = {
  lowerRisk: {
    id: 'lower-risk-level',
    type: 'adjust_settings' as const,
    title: {
      en: 'Adjust risk profile',
      ar: 'عدّل إعدادات الخطورة',
    },
    description: {
      en: "Most recent ACE runs didn't apply any changes. Consider lowering the risk level or targeting less critical files to allow bolder refactors.",
      ar: 'أغلب تشغيلات ACE الأخيرة لم تطبّق أي تغييرات. فكّر في خفض مستوى الخطورة أو استهداف ملفات أقل حساسية للسماح بإعادة هيكلة أكثر جرأة.',
    },
    priority: 'medium' as const,
  },
  focusHotspots: {
    id: 'focus-hotspots',
    type: 'target_files' as const,
    title: {
      en: 'Focus on Code Hotspots',
      ar: 'ركّز على مناطق السخونة',
    },
    description: {
      en: 'Use the Code Hotspots section to manually pick a few high-risk files and run ACE on them with a focused scope.',
      ar: 'استخدم قسم "مناطق السخونة" لاختيار عدد من الملفات عالية الخطورة وتشغيل ACE عليها بنطاق مركّز.',
    },
    priority: 'medium' as const,
  },
  combineWithTests: {
    id: 'combine-with-tests',
    type: 'run_ace' as const,
    title: {
      en: 'Combine with Tests & Security',
      ar: 'ادمج مع الاختبارات والأمان',
    },
    description: {
      en: 'Combine ACE runs with tests and security checks. New failing tests or alerts can reveal fresh improvement opportunities.',
      ar: 'ادمج تشغيلات ACE مع الاختبارات وفحوصات الأمان. ظهور اختبارات فاشلة أو تنبيهات جديدة قد يكشف فرص تحسين إضافية.',
    },
    priority: 'low' as const,
  },
};

/**
 * Evolution Plan Steps Copy
 */
export const evolutionPlanCopy = {
  steps: {
    initialScan: {
      title: { en: 'Initial Code Scan', ar: 'فحص الكود الأولي' },
      description: {
        en: 'Scan the codebase to identify all issues.',
        ar: 'افحص قاعدة الكود لتحديد جميع المشاكل.',
      },
    },
    firstFix: {
      title: { en: 'First Successful Fix', ar: 'أول إصلاح ناجح' },
      description: {
        en: 'Run ACE Auto-Fix to reduce issues.',
        ar: 'شغّل ACE Auto-Fix لتقليل المشاكل.',
      },
      metric: { en: 'Best improvement', ar: 'أفضل تحسن' },
    },
    reach70: {
      title: { en: 'Reach 70% Health', ar: 'الوصول لـ 70% صحة' },
      description: {
        en: 'Improve code health to 70% or above.',
        ar: 'حسّن صحة الكود إلى 70% أو أعلى.',
      },
      metric: { en: 'Current health', ar: 'الصحة الحالية' },
    },
    reachTarget: {
      title: (target: number) => ({
        en: `Reach ${target}% Health`,
        ar: `الوصول لـ ${target}% صحة`,
      }),
      description: (target: number) => ({
        en: `Achieve target health of ${target}%.`,
        ar: `حقق هدف الصحة ${target}%.`,
      }),
      metric: { en: 'Gap to target', ar: 'الفجوة للهدف' },
    },
    maintain: {
      title: { en: 'Maintain Quality', ar: 'حافظ على الجودة' },
      description: {
        en: 'Keep running ACE regularly to maintain code quality.',
        ar: 'استمر في تشغيل ACE بانتظام للحفاظ على جودة الكود.',
      },
      metric: { en: 'Total ACE runs', ar: 'إجمالي تشغيلات ACE' },
    },
  },
  estimatedRuns: {
    en: (runs: number) => `~${runs} more run${runs !== 1 ? 's' : ''} to target`,
    ar: (runs: number) => `~${runs} تشغيل إضافي للوصول للهدف`,
  },
};

/**
 * Helper to get localized copy
 */
export function getCopy<T extends Record<string, { en: string; ar: string }>>(
  copy: T,
  key: keyof T,
  locale: Locale
): string {
  const item = copy[key];
  return locale === 'ar' ? item.ar : item.en;
}
