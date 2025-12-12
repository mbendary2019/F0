/**
 * Phase 112.2: Runner Error Classifier
 *
 * Classifies runner output (failed builds, tests, lint errors) into categories
 * and provides structured insights for the Agent and UI
 */

// ============================================
// Types
// ============================================

export type RunnerErrorCategory =
  | 'missing_test_script'
  | 'missing_build_script'
  | 'missing_script'
  | 'jest_not_configured'
  | 'typescript_compile_error'
  | 'eslint_error'
  | 'dependency_missing'
  | 'pnpm_workspace_root'
  | 'node_version'
  | 'firebase_emulator'
  | 'permission_denied'
  | 'port_in_use'
  | 'memory_limit'
  | 'timeout'
  | 'unknown';

export interface RunnerErrorInsight {
  category: RunnerErrorCategory;
  title: string;
  titleAr: string;
  summary: string;
  summaryAr: string;
  suggestions: string[];
  suggestionsAr: string[];
  severity: 'error' | 'warning' | 'info';
  matchedPattern?: string;
}

export interface RunnerContextInput {
  command: string;
  exitCode: number | null;
  logs: string; // Combined stdout + stderr
  status: 'success' | 'failed' | 'killed';
}

/**
 * Phase 112.3: Auto-Fix Action
 * One-click fix command suggested based on error classification
 */
export interface RunnerAutoFixAction {
  id: string;
  label: string;           // Button label (English)
  labelAr: string;         // Button label (Arabic)
  description?: string;    // Tooltip description
  descriptionAr?: string;  // Tooltip in Arabic
  command: string;         // Command to run in Runner
}

// ============================================
// Pattern Definitions
// ============================================

interface ErrorPattern {
  category: RunnerErrorCategory;
  patterns: RegExp[];
  title: string;
  titleAr: string;
  summary: string;
  summaryAr: string;
  suggestions: string[];
  suggestionsAr: string[];
  severity: 'error' | 'warning' | 'info';
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Missing test script
  {
    category: 'missing_test_script',
    patterns: [
      /missing script[:\s]*["']?test["']?/i,
      /npm err.*missing script.*test/i,
      /no test specified/i,
    ],
    title: 'Missing Test Script',
    titleAr: 'سكريبت الاختبار غير موجود',
    summary: 'The project does not have a test script defined in package.json',
    summaryAr: 'المشروع لا يحتوي على سكريبت اختبار في package.json',
    suggestions: [
      'Add a "test" script to package.json',
      'Example: "test": "jest" or "test": "vitest"',
      'If no tests exist yet, use: "test": "echo \\"No tests yet\\""',
    ],
    suggestionsAr: [
      'أضف سكريبت "test" في package.json',
      'مثال: "test": "jest" أو "test": "vitest"',
      'إذا لم توجد اختبارات: "test": "echo \\"No tests yet\\""',
    ],
    severity: 'warning',
  },

  // Missing build script
  {
    category: 'missing_build_script',
    patterns: [
      /missing script[:\s]*["']?build["']?/i,
      /npm err.*missing script.*build/i,
    ],
    title: 'Missing Build Script',
    titleAr: 'سكريبت البناء غير موجود',
    summary: 'The project does not have a build script defined in package.json',
    summaryAr: 'المشروع لا يحتوي على سكريبت بناء في package.json',
    suggestions: [
      'Add a "build" script to package.json',
      'For TypeScript: "build": "tsc"',
      'For Next.js: "build": "next build"',
    ],
    suggestionsAr: [
      'أضف سكريبت "build" في package.json',
      'لـ TypeScript: "build": "tsc"',
      'لـ Next.js: "build": "next build"',
    ],
    severity: 'warning',
  },

  // Generic missing script
  {
    category: 'missing_script',
    patterns: [
      /missing script[:\s]*["']?(\w+)["']?/i,
      /npm err.*missing script/i,
      /ERR_PNPM_NO_SCRIPT/i,
    ],
    title: 'Missing Script',
    titleAr: 'السكريبت غير موجود',
    summary: 'The requested script is not defined in package.json',
    summaryAr: 'السكريبت المطلوب غير موجود في package.json',
    suggestions: [
      'Check package.json for available scripts',
      'Run "npm run" or "pnpm run" to see all scripts',
      'Add the missing script to package.json',
    ],
    suggestionsAr: [
      'تحقق من السكريبتات المتاحة في package.json',
      'شغّل "npm run" أو "pnpm run" لرؤية كل السكريبتات',
      'أضف السكريبت المطلوب في package.json',
    ],
    severity: 'warning',
  },

  // Jest not configured
  {
    category: 'jest_not_configured',
    patterns: [
      /no tests found/i,
      /jest.*configuration/i,
      /cannot find module.*jest/i,
      /testMatch.*didn't match/i,
    ],
    title: 'Jest Not Configured',
    titleAr: 'Jest غير مُعَدّ',
    summary: 'Jest testing framework is not properly configured',
    summaryAr: 'إطار الاختبار Jest غير مُعَدّ بشكل صحيح',
    suggestions: [
      'Create jest.config.js or jest.config.ts',
      'Install Jest: pnpm add -D jest @types/jest',
      'Check testMatch patterns in config',
    ],
    suggestionsAr: [
      'أنشئ ملف jest.config.js أو jest.config.ts',
      'ثبّت Jest: pnpm add -D jest @types/jest',
      'تحقق من testMatch في الإعدادات',
    ],
    severity: 'error',
  },

  // TypeScript compile errors
  {
    category: 'typescript_compile_error',
    patterns: [
      /error TS\d+:/i,
      /typescript.*error/i,
      /type.*is not assignable/i,
      /cannot find name/i,
      /property.*does not exist on type/i,
      /argument of type.*is not assignable/i,
      /tsc.*exited with code/i,
    ],
    title: 'TypeScript Error',
    titleAr: 'خطأ TypeScript',
    summary: 'TypeScript compilation failed with type errors',
    summaryAr: 'فشل تجميع TypeScript بسبب أخطاء في الأنواع',
    suggestions: [
      'Check the error location and fix type mismatches',
      'Run "npx tsc --noEmit" for detailed errors',
      'Consider adding type assertions or fixing imports',
    ],
    suggestionsAr: [
      'تحقق من موقع الخطأ وصلّح عدم تطابق الأنواع',
      'شغّل "npx tsc --noEmit" لتفاصيل أكثر',
      'فكر في إضافة type assertions أو إصلاح الـ imports',
    ],
    severity: 'error',
  },

  // ESLint errors
  {
    category: 'eslint_error',
    patterns: [
      /eslint.*error/i,
      /\d+ errors? found/i,
      /✖ \d+ problems?/i,
      /error.*eslint/i,
      /@typescript-eslint/i,
    ],
    title: 'Lint Errors',
    titleAr: 'أخطاء Lint',
    summary: 'ESLint found code quality or style issues',
    summaryAr: 'ESLint وجد مشاكل في جودة الكود أو الأسلوب',
    suggestions: [
      'Run "pnpm lint --fix" to auto-fix some issues',
      'Check .eslintrc for rule configurations',
      'Fix remaining issues manually',
    ],
    suggestionsAr: [
      'شغّل "pnpm lint --fix" لإصلاح بعض المشاكل تلقائياً',
      'تحقق من إعدادات القواعد في .eslintrc',
      'صلّح المشاكل المتبقية يدوياً',
    ],
    severity: 'error',
  },

  // Dependency missing
  {
    category: 'dependency_missing',
    patterns: [
      /cannot find module/i,
      /module not found/i,
      /ERR_MODULE_NOT_FOUND/i,
      /ENOENT.*node_modules/i,
      /peer dep missing/i,
    ],
    title: 'Missing Dependency',
    titleAr: 'حزمة مفقودة',
    summary: 'A required npm package is not installed',
    summaryAr: 'حزمة npm مطلوبة غير مُثبَّتة',
    suggestions: [
      'Run "pnpm install" to install dependencies',
      'Check if the package is in package.json',
      'Try deleting node_modules and reinstalling',
    ],
    suggestionsAr: [
      'شغّل "pnpm install" لتثبيت الحزم',
      'تحقق إذا الحزمة موجودة في package.json',
      'جرب حذف node_modules وأعد التثبيت',
    ],
    severity: 'error',
  },

  // PNPM workspace root issue
  {
    category: 'pnpm_workspace_root',
    patterns: [
      /ERR_PNPM_ADDING_TO_ROOT/i,
      /running this command in the root of a workspace/i,
      /use -w flag/i,
    ],
    title: 'PNPM Workspace Root',
    titleAr: 'مشكلة PNPM Workspace',
    summary: 'Cannot run this command in workspace root without -w flag',
    summaryAr: 'لا يمكن تشغيل هذا الأمر في جذر الـ workspace بدون -w',
    suggestions: [
      'Add -w flag: pnpm add -w <package>',
      'Or cd into a specific workspace package',
      'Use --filter to target specific package',
    ],
    suggestionsAr: [
      'أضف -w: pnpm add -w <package>',
      'أو انتقل لمجلد package معين',
      'استخدم --filter لاستهداف package معين',
    ],
    severity: 'warning',
  },

  // Node version issues
  {
    category: 'node_version',
    patterns: [
      /unsupported engine/i,
      /node version/i,
      /requires node/i,
      /engines.*node/i,
    ],
    title: 'Node Version Mismatch',
    titleAr: 'إصدار Node غير متوافق',
    summary: 'The Node.js version does not meet requirements',
    summaryAr: 'إصدار Node.js لا يلبي المتطلبات',
    suggestions: [
      'Check required Node version in package.json engines',
      'Use nvm to switch: nvm use <version>',
      'Update Node.js to a compatible version',
    ],
    suggestionsAr: [
      'تحقق من الإصدار المطلوب في package.json engines',
      'استخدم nvm للتبديل: nvm use <version>',
      'حدّث Node.js لإصدار متوافق',
    ],
    severity: 'error',
  },

  // Firebase emulator issues
  {
    category: 'firebase_emulator',
    patterns: [
      /firebase.*emulator/i,
      /FIRESTORE_EMULATOR/i,
      /emulator.*not.*running/i,
      /Could not reach Cloud Firestore/i,
    ],
    title: 'Firebase Emulator Issue',
    titleAr: 'مشكلة Firebase Emulator',
    summary: 'Firebase emulator is not running or misconfigured',
    summaryAr: 'Firebase emulator غير شغال أو إعداداته خاطئة',
    suggestions: [
      'Start emulators: firebase emulators:start',
      'Check FIRESTORE_EMULATOR_HOST env var',
      'Verify firebase.json emulator config',
    ],
    suggestionsAr: [
      'شغّل الـ emulators: firebase emulators:start',
      'تحقق من متغير FIRESTORE_EMULATOR_HOST',
      'تأكد من إعدادات الـ emulator في firebase.json',
    ],
    severity: 'error',
  },

  // Permission denied
  {
    category: 'permission_denied',
    patterns: [
      /permission denied/i,
      /EACCES/i,
      /access denied/i,
    ],
    title: 'Permission Denied',
    titleAr: 'الصلاحية مرفوضة',
    summary: 'The operation was blocked due to insufficient permissions',
    summaryAr: 'تم رفض العملية بسبب عدم كفاية الصلاحيات',
    suggestions: [
      'Check file/folder permissions',
      'Try running with appropriate permissions',
      'Avoid using sudo with npm/pnpm',
    ],
    suggestionsAr: [
      'تحقق من صلاحيات الملف/المجلد',
      'جرب التشغيل بالصلاحيات المناسبة',
      'تجنب استخدام sudo مع npm/pnpm',
    ],
    severity: 'error',
  },

  // Port in use
  {
    category: 'port_in_use',
    patterns: [
      /EADDRINUSE/i,
      /port.*already in use/i,
      /address already in use/i,
    ],
    title: 'Port Already In Use',
    titleAr: 'المنفذ مستخدم',
    summary: 'The requested port is already being used by another process',
    summaryAr: 'المنفذ المطلوب مستخدم من عملية أخرى',
    suggestions: [
      'Kill the process using the port: lsof -i :<port>',
      'Use a different port with -p or --port flag',
      'Restart your terminal/IDE',
    ],
    suggestionsAr: [
      'أوقف العملية التي تستخدم المنفذ: lsof -i :<port>',
      'استخدم منفذ مختلف مع -p أو --port',
      'أعد تشغيل الـ terminal/IDE',
    ],
    severity: 'error',
  },

  // Memory limit
  {
    category: 'memory_limit',
    patterns: [
      /JavaScript heap out of memory/i,
      /FATAL ERROR.*heap/i,
      /allocation failed/i,
    ],
    title: 'Memory Limit Exceeded',
    titleAr: 'تجاوز حد الذاكرة',
    summary: 'Node.js ran out of memory during execution',
    summaryAr: 'نفدت ذاكرة Node.js أثناء التنفيذ',
    suggestions: [
      'Increase memory: NODE_OPTIONS="--max-old-space-size=4096"',
      'Check for memory leaks in your code',
      'Split large operations into smaller chunks',
    ],
    suggestionsAr: [
      'زوّد الذاكرة: NODE_OPTIONS="--max-old-space-size=4096"',
      'ابحث عن memory leaks في الكود',
      'قسّم العمليات الكبيرة لأجزاء أصغر',
    ],
    severity: 'error',
  },

  // Timeout
  {
    category: 'timeout',
    patterns: [
      /timeout/i,
      /timed out/i,
      /ETIMEDOUT/i,
    ],
    title: 'Operation Timed Out',
    titleAr: 'انتهت المهلة',
    summary: 'The operation took too long and was terminated',
    summaryAr: 'استغرقت العملية وقتاً طويلاً وتم إنهاؤها',
    suggestions: [
      'Check network connectivity',
      'Increase timeout if configurable',
      'Check for infinite loops or blocking operations',
    ],
    suggestionsAr: [
      'تحقق من الاتصال بالشبكة',
      'زوّد الـ timeout إذا كان قابل للتعديل',
      'ابحث عن infinite loops أو عمليات blocking',
    ],
    severity: 'error',
  },
];

// ============================================
// Classifier Function
// ============================================

/**
 * Classify runner error output and return structured insight
 */
export function classifyRunnerError(input: RunnerContextInput): RunnerErrorInsight | null {
  // Only classify failed runs
  if (input.status === 'success') {
    return null;
  }

  const logsLower = input.logs.toLowerCase();
  const commandLower = input.command.toLowerCase();

  // Try each pattern
  for (const errorPattern of ERROR_PATTERNS) {
    for (const regex of errorPattern.patterns) {
      const match = input.logs.match(regex) || input.command.match(regex);
      if (match) {
        return {
          category: errorPattern.category,
          title: errorPattern.title,
          titleAr: errorPattern.titleAr,
          summary: errorPattern.summary,
          summaryAr: errorPattern.summaryAr,
          suggestions: errorPattern.suggestions,
          suggestionsAr: errorPattern.suggestionsAr,
          severity: errorPattern.severity,
          matchedPattern: match[0],
        };
      }
    }
  }

  // Unknown error fallback
  return {
    category: 'unknown',
    title: 'Command Failed',
    titleAr: 'فشل الأمر',
    summary: `The command "${input.command}" exited with code ${input.exitCode}`,
    summaryAr: `فشل الأمر "${input.command}" بكود خروج ${input.exitCode}`,
    suggestions: [
      'Check the output logs for more details',
      'Try running the command manually in terminal',
      'Search the error message online',
    ],
    suggestionsAr: [
      'تحقق من سجلات المخرجات لمزيد من التفاصيل',
      'جرب تشغيل الأمر يدوياً في الـ terminal',
      'ابحث عن رسالة الخطأ على الإنترنت',
    ],
    severity: 'error',
  };
}

/**
 * Format insight for inclusion in Agent system prompt
 */
export function formatInsightForPrompt(
  insight: RunnerErrorInsight,
  locale: 'ar' | 'en' = 'ar'
): string {
  const isArabic = locale === 'ar';
  const title = isArabic ? insight.titleAr : insight.title;
  const summary = isArabic ? insight.summaryAr : insight.summary;
  const suggestions = isArabic ? insight.suggestionsAr : insight.suggestions;

  const parts = [
    `🔍 **${isArabic ? 'تحليل الخطأ' : 'Error Analysis'}:** ${title}`,
    summary,
    '',
    `💡 **${isArabic ? 'اقتراحات' : 'Suggestions'}:**`,
    ...suggestions.map((s, i) => `${i + 1}. ${s}`),
  ];

  return parts.join('\n');
}

// ============================================
// Phase 112.3: Auto-Fix Actions Generator
// ============================================

/**
 * Get auto-fix actions based on error insight category
 */
export function getAutoFixActionsForInsight(
  insight: RunnerErrorInsight,
): RunnerAutoFixAction[] {
  switch (insight.category) {
    case 'missing_test_script':
      return [
        {
          id: 'add_jest_deps',
          label: 'Install Jest + ts-jest',
          labelAr: 'تثبيت Jest + ts-jest',
          description: 'Install Jest testing framework with TypeScript support',
          descriptionAr: 'تثبيت إطار الاختبار Jest مع دعم TypeScript',
          command: 'pnpm add -D jest ts-jest @types/jest',
        },
        {
          id: 'add_vitest',
          label: 'Install Vitest',
          labelAr: 'تثبيت Vitest',
          description: 'Install Vitest (faster, Vite-native test runner)',
          descriptionAr: 'تثبيت Vitest (أسرع، يعمل مع Vite)',
          command: 'pnpm add -D vitest',
        },
      ];

    case 'missing_build_script':
      return [
        {
          id: 'run_tsc',
          label: 'Run TypeScript Compiler',
          labelAr: 'تشغيل مترجم TypeScript',
          description: 'Compile TypeScript directly',
          descriptionAr: 'ترجمة TypeScript مباشرة',
          command: 'npx tsc',
        },
      ];

    case 'missing_script':
      return [
        {
          id: 'list_scripts',
          label: 'List Available Scripts',
          labelAr: 'عرض السكريبتات المتاحة',
          description: 'Show all available npm scripts',
          descriptionAr: 'عرض كل السكريبتات المتاحة',
          command: 'pnpm run',
        },
      ];

    case 'jest_not_configured':
      return [
        {
          id: 'init_jest',
          label: 'Initialize Jest Config',
          labelAr: 'إعداد Jest',
          description: 'Create Jest configuration file',
          descriptionAr: 'إنشاء ملف إعدادات Jest',
          command: 'npx jest --init',
        },
        {
          id: 'add_jest_deps',
          label: 'Install Jest Dependencies',
          labelAr: 'تثبيت حزم Jest',
          description: 'Install Jest with TypeScript support',
          descriptionAr: 'تثبيت Jest مع دعم TypeScript',
          command: 'pnpm add -D jest ts-jest @types/jest',
        },
      ];

    case 'typescript_compile_error':
      return [
        {
          id: 'tsc_no_emit',
          label: 'Check Types Only',
          labelAr: 'فحص الأنواع فقط',
          description: 'Run TypeScript type checking without emitting files',
          descriptionAr: 'فحص الأنواع بدون إنشاء ملفات',
          command: 'npx tsc --noEmit',
        },
      ];

    case 'eslint_error':
      return [
        {
          id: 'lint_fix',
          label: 'Auto-fix Lint Issues',
          labelAr: 'إصلاح تلقائي لـ Lint',
          description: 'Automatically fix fixable lint issues',
          descriptionAr: 'إصلاح مشاكل Lint القابلة للإصلاح تلقائياً',
          command: 'pnpm lint --fix',
        },
      ];

    case 'dependency_missing':
      return [
        {
          id: 'install_deps',
          label: 'Install Dependencies',
          labelAr: 'تثبيت الحزم',
          description: 'Install all project dependencies',
          descriptionAr: 'تثبيت كل حزم المشروع',
          command: 'pnpm install',
        },
        {
          id: 'clean_install',
          label: 'Clean Install',
          labelAr: 'تثبيت نظيف',
          description: 'Delete node_modules and reinstall',
          descriptionAr: 'حذف node_modules وإعادة التثبيت',
          command: 'rm -rf node_modules && pnpm install',
        },
      ];

    case 'pnpm_workspace_root':
      return [
        {
          id: 'add_workspace_flag',
          label: 'Add with -w flag',
          labelAr: 'إضافة مع -w',
          description: 'Install package at workspace root',
          descriptionAr: 'تثبيت الحزمة في جذر الـ workspace',
          command: 'pnpm add -w',
        },
      ];

    case 'node_version':
      return [
        {
          id: 'check_node_version',
          label: 'Check Node Version',
          labelAr: 'فحص إصدار Node',
          description: 'Show current Node.js version',
          descriptionAr: 'عرض إصدار Node.js الحالي',
          command: 'node --version',
        },
        {
          id: 'use_nvm',
          label: 'Switch Node (nvm)',
          labelAr: 'تبديل Node (nvm)',
          description: 'Use nvm to switch Node version',
          descriptionAr: 'استخدم nvm لتبديل إصدار Node',
          command: 'nvm use',
        },
      ];

    case 'firebase_emulator':
      return [
        {
          id: 'start_emulators',
          label: 'Start Firebase Emulators',
          labelAr: 'تشغيل Firebase Emulators',
          description: 'Start Firebase local emulators',
          descriptionAr: 'تشغيل محاكيات Firebase المحلية',
          command: 'firebase emulators:start',
        },
      ];

    case 'port_in_use':
      return [
        {
          id: 'kill_port_3000',
          label: 'Kill Port 3000',
          labelAr: 'إيقاف منفذ 3000',
          description: 'Kill process using port 3000',
          descriptionAr: 'إيقاف العملية على منفذ 3000',
          command: 'lsof -ti:3000 | xargs kill -9',
        },
        {
          id: 'kill_port_3030',
          label: 'Kill Port 3030',
          labelAr: 'إيقاف منفذ 3030',
          description: 'Kill process using port 3030',
          descriptionAr: 'إيقاف العملية على منفذ 3030',
          command: 'lsof -ti:3030 | xargs kill -9',
        },
      ];

    case 'memory_limit':
      return [
        {
          id: 'increase_memory',
          label: 'Increase Memory (4GB)',
          labelAr: 'زيادة الذاكرة (4GB)',
          description: 'Run with increased Node.js memory limit',
          descriptionAr: 'تشغيل مع زيادة حد ذاكرة Node.js',
          command: 'NODE_OPTIONS="--max-old-space-size=4096" pnpm build',
        },
      ];

    default:
      // No auto-fix actions for unknown errors
      return [];
  }
}
