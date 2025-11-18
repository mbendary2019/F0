// src/types/taskKind.ts
// Phase 76: Task Classification System - Type Definitions

/**
 * Task kind classification for agent routing and prompt optimization
 */
export type TaskKind =
  | 'code_gen'      // Generate new code/files
  | 'code_edit'     // Edit existing code
  | 'bug_fix'       // Fix specific bugs/errors
  | 'refactor'      // Improve/reorganize code
  | 'ui_gen'        // UI components/pages generation
  | 'agent_plan'    // Planning phases/tasks/architecture
  | 'doc_explain'   // Code explanation/documentation
  | 'summary'       // Summarize/analyze code
  | 'parse'         // Extract/transform data
  | 'config_update' // Settings/env/build config changes
  | 'questions'     // General questions about project/tech
  | 'chat'          // General chat not related to code
  | 'unknown';      // Unable to classify

/**
 * Result of task classification with confidence score
 */
export interface TaskClassification {
  taskKind: TaskKind;
  confidence: number;   // 0-1 confidence score
  reasoning: string;    // Explanation for classification
  rawLabel?: string;    // Raw label from LLM if needed
}

/**
 * Human-readable labels for task kinds (bilingual)
 */
export const TASK_KIND_LABELS: Record<TaskKind, { en: string; ar: string }> = {
  code_gen: { en: 'Code Generation', ar: 'توليد كود' },
  code_edit: { en: 'Code Edit', ar: 'تعديل كود' },
  bug_fix: { en: 'Bug Fix', ar: 'إصلاح خطأ' },
  refactor: { en: 'Refactor', ar: 'إعادة هيكلة' },
  ui_gen: { en: 'UI Component', ar: 'إنشاء واجهة' },
  agent_plan: { en: 'Planning', ar: 'تخطيط' },
  doc_explain: { en: 'Documentation', ar: 'توثيق' },
  summary: { en: 'Summary', ar: 'ملخص' },
  parse: { en: 'Data Parse', ar: 'تحليل بيانات' },
  config_update: { en: 'Configuration', ar: 'إعدادات' },
  questions: { en: 'Question', ar: 'سؤال' },
  chat: { en: 'Chat', ar: 'دردشة' },
  unknown: { en: 'Unknown', ar: 'غير محدد' },
};

/**
 * Get human-readable label for task kind
 */
export function getTaskKindLabel(kind: TaskKind, locale: 'ar' | 'en' = 'en'): string {
  return TASK_KIND_LABELS[kind]?.[locale] || TASK_KIND_LABELS.unknown[locale];
}

/**
 * Determine if a task kind requires critical/high-quality model
 */
export function isCriticalTaskKind(kind: TaskKind): boolean {
  return ['bug_fix', 'code_edit', 'refactor', 'code_gen', 'ui_gen'].includes(kind);
}

/**
 * Map task kind to router task type (for existing router logic)
 */
export function mapTaskKindToRouterKind(kind: TaskKind): 'code' | 'text' | 'plan' {
  switch (kind) {
    case 'code_gen':
    case 'code_edit':
    case 'bug_fix':
    case 'refactor':
    case 'ui_gen':
      return 'code';

    case 'agent_plan':
      return 'plan';

    case 'doc_explain':
    case 'summary':
    case 'parse':
    case 'config_update':
    case 'questions':
    case 'chat':
    case 'unknown':
    default:
      return 'text';
  }
}
