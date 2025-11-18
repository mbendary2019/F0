// src/lib/agents/patch/usePatchMode.ts
// Phase 78: Patch-Based Code Editing - Task Classification Integration

import { TaskKind } from '@/types/taskKind';

/**
 * Determine if patch mode should be used for a given task kind
 */
export function shouldUsePatchMode(taskKind: TaskKind): boolean {
  const patchTaskKinds: TaskKind[] = ['bug_fix', 'code_edit', 'refactor'];
  return patchTaskKinds.includes(taskKind);
}

/**
 * Get patch mode preference level
 * - 'required': Must use patches (bug_fix)
 * - 'preferred': Should use patches when possible (code_edit, refactor)
 * - 'optional': Can use patches if helpful (other tasks)
 * - 'disabled': Do not use patches (code_gen, ui_gen)
 */
export function getPatchModePreference(
  taskKind: TaskKind
): 'required' | 'preferred' | 'optional' | 'disabled' {
  switch (taskKind) {
    case 'bug_fix':
      return 'required';

    case 'code_edit':
    case 'refactor':
      return 'preferred';

    case 'code_gen':
    case 'ui_gen':
      return 'disabled';

    case 'doc_explain':
    case 'summary':
    case 'parse':
    case 'config_update':
    case 'questions':
    case 'chat':
    case 'agent_plan':
    case 'unknown':
    default:
      return 'optional';
  }
}

/**
 * Get human-readable explanation for patch mode usage
 */
export function getPatchModeExplanation(taskKind: TaskKind, locale: 'ar' | 'en' = 'en'): string {
  const preference = getPatchModePreference(taskKind);

  if (locale === 'ar') {
    switch (preference) {
      case 'required':
        return 'يجب استخدام وضع الباتش لهذا النوع من المهام - تعديلات دقيقة فقط';
      case 'preferred':
        return 'يُفضّل استخدام وضع الباتش لهذا النوع من المهام - تعديلات محدودة';
      case 'optional':
        return 'يمكن استخدام وضع الباتش إذا كان مناسباً';
      case 'disabled':
        return 'لا تستخدم وضع الباتش - إنشاء ملفات كاملة';
    }
  } else {
    switch (preference) {
      case 'required':
        return 'Patch mode required for this task - surgical edits only';
      case 'preferred':
        return 'Patch mode preferred for this task - minimal changes';
      case 'optional':
        return 'Patch mode can be used if appropriate';
      case 'disabled':
        return 'Do not use patch mode - generate complete files';
    }
  }
}

/**
 * Estimate cost savings from using patches vs full files
 * Based on average file size and change size
 */
export function estimatePatchSavings(params: {
  averageFileSize: number; // lines
  changedLines: number; // lines
  contextLines?: number; // default 3
}): {
  fullFileCost: number; // estimated tokens
  patchCost: number; // estimated tokens
  savings: number; // percentage
} {
  const contextLines = params.contextLines ?? 3;
  const tokensPerLine = 15; // rough estimate

  // Full file rewrite cost
  const fullFileCost = params.averageFileSize * tokensPerLine;

  // Patch cost: changed lines + context (before + after)
  const patchLines = params.changedLines + contextLines * 2;
  const patchCost = patchLines * tokensPerLine;

  // Savings percentage
  const savings = ((fullFileCost - patchCost) / fullFileCost) * 100;

  return {
    fullFileCost,
    patchCost,
    savings: Math.max(0, savings),
  };
}
