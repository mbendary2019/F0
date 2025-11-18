// src/config/quickActions.ts
// Phase 80: AI Quick Actions - Pre-configured Agent Tasks

import { TaskKind } from '@/types/taskKind';

export type QuickActionId =
  | 'fix_all_errors'
  | 'improve_performance'
  | 'add_dark_mode'
  | 'scan_security'
  | 'cleanup_unused_code'
  | 'generate_docs'
  | 'add_tests'
  | 'refactor_legacy';

export interface QuickActionConfig {
  id: QuickActionId;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  defaultTaskKind: TaskKind;
  systemHint: string; // Additional instructions for the agent
  icon?: string; // Optional emoji or icon
  priority: number; // Display priority (1 = highest)
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: 'fix_all_errors',
    labelEn: 'Fix All Errors',
    labelAr: 'إصلاح كل الأخطاء',
    descriptionEn:
      'Scan the project for TypeScript, ESLint, and runtime errors and fix them with minimal patches.',
    descriptionAr:
      'افحص المشروع بحثًا عن أخطاء TypeScript وESLint والتشغيل، وأصلحها بتغييرات صغيرة وآمنة.',
    defaultTaskKind: 'bug_fix',
    systemHint: `Focus on scanning for existing errors and fix them using minimal diff patches.
Do NOT add new features. Only fix what is broken.
Prioritize:
1. TypeScript type errors
2. ESLint warnings
3. Runtime errors from logs
Use patch mode for all fixes.`,
    icon: '🔧',
    priority: 1,
  },
  {
    id: 'improve_performance',
    labelEn: 'Improve Performance',
    labelAr: 'تحسين الأداء',
    descriptionEn: 'Analyze and optimize performance bottlenecks (React renders, bundle size, etc.)',
    descriptionAr: 'تحليل وتحسين مشاكل الأداء (تصييرات React، حجم الحزمة، إلخ)',
    defaultTaskKind: 'refactor',
    systemHint: `Analyze the project for performance issues:
- Unnecessary re-renders in React components
- Missing React.memo, useMemo, useCallback
- Large bundle sizes
- Unoptimized images
- Slow API calls

Suggest optimizations using patch mode. Focus on high-impact changes.`,
    icon: '⚡',
    priority: 2,
  },
  {
    id: 'add_dark_mode',
    labelEn: 'Add Dark Mode',
    labelAr: 'إضافة الوضع الليلي',
    descriptionEn: 'Integrate dark mode using the existing UI stack (Tailwind/shadcn).',
    descriptionAr: 'أضِف وضع ليلي باستخدام نفس مكتبة الواجهة (Tailwind/shadcn) بدون تغيير الهيكلة الرئيسية.',
    defaultTaskKind: 'ui_gen',
    systemHint: `Add dark mode support to the existing UI using the current stack (Tailwind/shadcn).
Follow established design rules in projectMemory.
Steps:
1. Add dark mode toggle component
2. Implement theme switching logic
3. Update existing components with dark: variants
4. Test all pages for dark mode compatibility`,
    icon: '🌙',
    priority: 3,
  },
  {
    id: 'scan_security',
    labelEn: 'Security Scan',
    labelAr: 'فحص الأمان',
    descriptionEn: 'Scan for common security vulnerabilities (XSS, SQL injection, secrets in code).',
    descriptionAr: 'افحص عن ثغرات الأمان الشائعة (XSS، SQL injection، أسرار في الكود).',
    defaultTaskKind: 'bug_fix',
    systemHint: `Perform a security audit:
- Check for exposed secrets/API keys in code
- Identify XSS vulnerabilities
- Check for SQL injection risks
- Validate user input handling
- Review authentication/authorization

Report findings and suggest fixes using patches where applicable.`,
    icon: '🔒',
    priority: 4,
  },
  {
    id: 'cleanup_unused_code',
    labelEn: 'Cleanup Unused Code',
    labelAr: 'تنظيف الكود غير المستخدم',
    descriptionEn: 'Remove unused imports, variables, functions, and components.',
    descriptionAr: 'إزالة الـ imports والمتغيرات والدوال والمكونات غير المستخدمة.',
    defaultTaskKind: 'refactor',
    systemHint: `Identify and remove dead code:
- Unused imports
- Unused variables
- Unused functions
- Unused React components
- Commented-out code

Use patch mode to remove unused code safely. Be conservative - only remove what is definitely unused.`,
    icon: '🧹',
    priority: 5,
  },
  {
    id: 'generate_docs',
    labelEn: 'Generate Documentation',
    labelAr: 'إنشاء التوثيق',
    descriptionEn: 'Generate JSDoc comments, README sections, and API documentation.',
    descriptionAr: 'إنشاء تعليقات JSDoc وأقسام README وتوثيق API.',
    defaultTaskKind: 'doc_explain',
    systemHint: `Generate comprehensive documentation:
- Add JSDoc comments to functions/classes
- Update README.md with usage examples
- Document API endpoints
- Add inline comments for complex logic

Focus on clarity and completeness.`,
    icon: '📚',
    priority: 6,
  },
  {
    id: 'add_tests',
    labelEn: 'Add Tests',
    labelAr: 'إضافة الاختبارات',
    descriptionEn: 'Generate unit tests for uncovered components and functions.',
    descriptionAr: 'إنشاء اختبارات وحدة للمكونات والدوال غير المختبرة.',
    defaultTaskKind: 'code_gen',
    systemHint: `Generate test files for untested code:
- Use the existing test framework (Jest, Vitest, etc.)
- Follow existing test patterns
- Aim for >80% coverage
- Include edge cases and error scenarios

Create new test files as needed.`,
    icon: '✅',
    priority: 7,
  },
  {
    id: 'refactor_legacy',
    labelEn: 'Refactor Legacy Code',
    labelAr: 'إعادة هيكلة الكود القديم',
    descriptionEn: 'Modernize legacy code (class components → hooks, old patterns → new).',
    descriptionAr: 'تحديث الكود القديم (مكونات class → hooks، أنماط قديمة → جديدة).',
    defaultTaskKind: 'refactor',
    systemHint: `Refactor legacy code patterns:
- Convert class components to functional components with hooks
- Replace deprecated APIs
- Update to modern JavaScript/TypeScript patterns
- Improve code organization

Use patch mode. Ensure behavior remains unchanged.`,
    icon: '♻️',
    priority: 8,
  },
];

/**
 * Get quick action by ID
 */
export function getQuickAction(id: QuickActionId): QuickActionConfig | undefined {
  return QUICK_ACTIONS.find((action) => action.id === id);
}

/**
 * Get all quick actions sorted by priority
 */
export function getAllQuickActions(): QuickActionConfig[] {
  return [...QUICK_ACTIONS].sort((a, b) => a.priority - b.priority);
}

/**
 * Get top N quick actions
 */
export function getTopQuickActions(count: number = 4): QuickActionConfig[] {
  return getAllQuickActions().slice(0, count);
}

/**
 * Get quick actions by task kind
 */
export function getQuickActionsByTaskKind(taskKind: TaskKind): QuickActionConfig[] {
  return QUICK_ACTIONS.filter((action) => action.defaultTaskKind === taskKind);
}
