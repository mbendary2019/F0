// desktop/src/lib/ace/aceActions.ts
// Phase 129.1: ACE Action Mapping Layer
// Maps ACE suggestions to executable actions

import type { AceSuggestion, AceSuggestionId } from './aceTypes';
import type { FixProfileId } from '../analysis/fixProfiles';

/**
 * Types of actions that ACE can execute
 */
export type AceActionType =
  | 'run_fix_profile'        // Run a fix profile on specified files
  | 'open_files_in_editor'   // Open files for manual review
  | 'run_project_scan'       // Trigger a project scan
  | 'delete_files'           // Delete legacy/backup files
  | 'noop';                  // No operation (manual action required)

/**
 * A planned action that ACE can execute
 */
export type AcePlannedAction = {
  /** Unique action ID */
  id: string;
  /** Action type */
  type: AceActionType;
  /** Files to operate on */
  files?: string[];
  /** Fix profile to use (for run_fix_profile) */
  profileId?: FixProfileId;
  /** Human-readable description */
  description: string;
  /** Arabic description */
  descriptionAr: string;
  /** Is this action safe to auto-execute? */
  isSafeAuto: boolean;
  /** Requires user confirmation? */
  requiresConfirmation: boolean;
  /** Estimated time in seconds */
  estimatedTimeSeconds?: number;
};

/**
 * Action mapping result for a suggestion
 */
export type SuggestionActionMapping = {
  /** Original suggestion ID */
  suggestionId: string;
  /** Mapped actions */
  actions: AcePlannedAction[];
  /** Total files affected */
  totalFilesAffected: number;
  /** Can be fully automated? */
  canAutomate: boolean;
  /** Warning message if any */
  warning?: string;
  /** Arabic warning */
  warningAr?: string;
};

/**
 * Map a suggestion type to a fix profile
 */
function getSuggestionFixProfile(type: AceSuggestionId): FixProfileId | null {
  switch (type) {
    case 'cleanup_logging_heavy_file':
      return 'logging_only';
    case 'reduce_any_types':
      return 'types_only';
    case 'cleanup_dead_code':
      return 'safe_mix';
    case 'reduce_file_complexity':
      return 'safe_mix';
    case 'improve_security_rules':
      return 'all'; // Security needs all categories
    default:
      return null;
  }
}

/**
 * Map a single suggestion to executable actions
 */
export function mapSuggestionToActions(
  suggestion: AceSuggestion,
): SuggestionActionMapping {
  const actions: AcePlannedAction[] = [];
  const baseId = `action-${suggestion.id}`;

  switch (suggestion.type) {
    // Logging cleanup - safe to auto-fix
    case 'cleanup_logging_heavy_file': {
      actions.push({
        id: `${baseId}-fix`,
        type: 'run_fix_profile',
        files: suggestion.targetFiles,
        profileId: 'logging_only',
        description: `Remove console.log statements from ${suggestion.targetFiles.length} file(s)`,
        descriptionAr: `إزالة console.log من ${suggestion.targetFiles.length} ملف(ات)`,
        isSafeAuto: true,
        requiresConfirmation: false,
        estimatedTimeSeconds: suggestion.targetFiles.length * 2,
      });
      break;
    }

    // Type safety - safe to auto-fix
    case 'reduce_any_types': {
      actions.push({
        id: `${baseId}-fix`,
        type: 'run_fix_profile',
        files: suggestion.targetFiles,
        profileId: 'types_only',
        description: `Fix TypeScript type issues in ${suggestion.targetFiles.length} file(s)`,
        descriptionAr: `إصلاح مشاكل الأنواع في ${suggestion.targetFiles.length} ملف(ات)`,
        isSafeAuto: true,
        requiresConfirmation: false,
        estimatedTimeSeconds: suggestion.targetFiles.length * 3,
      });
      break;
    }

    // Dead code cleanup - safe to auto-fix
    case 'cleanup_dead_code': {
      actions.push({
        id: `${baseId}-fix`,
        type: 'run_fix_profile',
        files: suggestion.targetFiles,
        profileId: 'safe_mix',
        description: `Remove dead code from ${suggestion.targetFiles.length} file(s)`,
        descriptionAr: `إزالة الكود الميت من ${suggestion.targetFiles.length} ملف(ات)`,
        isSafeAuto: true,
        requiresConfirmation: false,
        estimatedTimeSeconds: suggestion.targetFiles.length * 2,
      });
      break;
    }

    // Complexity reduction - needs review
    case 'reduce_file_complexity': {
      actions.push({
        id: `${baseId}-fix`,
        type: 'run_fix_profile',
        files: suggestion.targetFiles,
        profileId: 'safe_mix',
        description: `Apply safe fixes to ${suggestion.targetFiles.length} complex file(s)`,
        descriptionAr: `تطبيق إصلاحات آمنة على ${suggestion.targetFiles.length} ملف(ات) معقد`,
        isSafeAuto: true,
        requiresConfirmation: true,
        estimatedTimeSeconds: suggestion.targetFiles.length * 5,
      });
      // Also suggest manual review
      actions.push({
        id: `${baseId}-review`,
        type: 'open_files_in_editor',
        files: suggestion.targetFiles,
        description: 'Open files for manual complexity review',
        descriptionAr: 'فتح الملفات لمراجعة التعقيد يدوياً',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }

    // Security - requires confirmation
    case 'improve_security_rules': {
      actions.push({
        id: `${baseId}-fix`,
        type: 'run_fix_profile',
        files: suggestion.targetFiles,
        profileId: 'all',
        description: `Fix security issues in ${suggestion.targetFiles.length} file(s)`,
        descriptionAr: `إصلاح مشاكل الأمان في ${suggestion.targetFiles.length} ملف(ات)`,
        isSafeAuto: false, // Security changes need manual review
        requiresConfirmation: true,
        estimatedTimeSeconds: suggestion.targetFiles.length * 5,
      });
      break;
    }

    // Large file splitting - manual action
    case 'split_large_file': {
      actions.push({
        id: `${baseId}-review`,
        type: 'open_files_in_editor',
        files: suggestion.targetFiles,
        description: 'Open large file for manual splitting',
        descriptionAr: 'فتح الملف الكبير للتقسيم يدوياً',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }

    // JS to TS conversion - manual action
    case 'convert_js_to_ts': {
      actions.push({
        id: `${baseId}-review`,
        type: 'open_files_in_editor',
        files: suggestion.targetFiles,
        description: 'Open JavaScript files for TypeScript conversion',
        descriptionAr: 'فتح ملفات JavaScript للتحويل إلى TypeScript',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }

    // Legacy backups removal - requires confirmation
    case 'remove_legacy_backups': {
      actions.push({
        id: `${baseId}-delete`,
        type: 'delete_files',
        files: suggestion.targetFiles,
        description: `Delete ${suggestion.targetFiles.length} legacy backup file(s)`,
        descriptionAr: `حذف ${suggestion.targetFiles.length} ملف(ات) نسخ احتياطية قديمة`,
        isSafeAuto: false,
        requiresConfirmation: true,
        estimatedTimeSeconds: 1,
      });
      break;
    }

    // Extract shared utils - manual action
    case 'extract_shared_utils': {
      actions.push({
        id: `${baseId}-review`,
        type: 'open_files_in_editor',
        files: suggestion.targetFiles,
        description: 'Open files to extract shared utilities',
        descriptionAr: 'فتح الملفات لاستخراج الأدوات المشتركة',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }

    // TSConfig tightening - manual action
    case 'tighten_tsconfig': {
      actions.push({
        id: `${baseId}-review`,
        type: 'open_files_in_editor',
        files: suggestion.targetFiles,
        description: 'Open tsconfig.json for stricter settings',
        descriptionAr: 'فتح tsconfig.json لإعدادات أكثر صرامة',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }

    // Test coverage - manual action
    case 'improve_test_coverage': {
      actions.push({
        id: `${baseId}-review`,
        type: 'open_files_in_editor',
        files: suggestion.targetFiles,
        description: 'Open files to add test coverage',
        descriptionAr: 'فتح الملفات لإضافة اختبارات',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }

    // Default - noop
    default: {
      actions.push({
        id: `${baseId}-noop`,
        type: 'noop',
        description: 'Manual action required',
        descriptionAr: 'يتطلب إجراء يدوي',
        isSafeAuto: false,
        requiresConfirmation: false,
      });
      break;
    }
  }

  // Calculate if fully automatable
  const canAutomate = actions.every(a => a.isSafeAuto);
  const totalFilesAffected = suggestion.targetFiles.length;

  // Add warning for security or high-impact changes
  let warning: string | undefined;
  let warningAr: string | undefined;

  if (suggestion.type === 'improve_security_rules') {
    warning = 'Security changes require careful review before applying';
    warningAr = 'تغييرات الأمان تتطلب مراجعة دقيقة قبل التطبيق';
  } else if (suggestion.type === 'remove_legacy_backups') {
    warning = 'File deletion cannot be undone. Make sure these files are not needed.';
    warningAr = 'حذف الملفات لا يمكن التراجع عنه. تأكد من عدم الحاجة لهذه الملفات.';
  }

  return {
    suggestionId: suggestion.id,
    actions,
    totalFilesAffected,
    canAutomate,
    warning,
    warningAr,
  };
}

/**
 * Map multiple suggestions to actions
 */
export function mapSuggestionsToActions(
  suggestions: AceSuggestion[],
): SuggestionActionMapping[] {
  return suggestions.map(mapSuggestionToActions);
}

/**
 * Get all actions for a phase
 */
export function getPhaseActions(
  phaseId: string,
  phaseSuggestionIds: string[],
  allSuggestions: AceSuggestion[],
): {
  actions: AcePlannedAction[];
  totalFiles: number;
  canFullyAutomate: boolean;
  estimatedSeconds: number;
} {
  // Get suggestions for this phase
  const phaseSuggestions = allSuggestions.filter(s =>
    phaseSuggestionIds.includes(s.id)
  );

  // Map to actions
  const mappings = mapSuggestionsToActions(phaseSuggestions);

  // Flatten all actions
  const actions = mappings.flatMap(m => m.actions);

  // Calculate totals
  const totalFiles = new Set(
    mappings.flatMap(m =>
      m.actions.flatMap(a => a.files || [])
    )
  ).size;

  const canFullyAutomate = mappings.every(m => m.canAutomate);

  const estimatedSeconds = actions.reduce(
    (sum, a) => sum + (a.estimatedTimeSeconds || 0),
    0
  );

  return {
    actions,
    totalFiles,
    canFullyAutomate,
    estimatedSeconds,
  };
}

/**
 * Get a summary of actions for display
 */
export function getActionsSummary(
  actions: AcePlannedAction[],
  locale: 'ar' | 'en' = 'en',
): string[] {
  const isArabic = locale === 'ar';
  const summary: string[] = [];

  const fixActions = actions.filter(a => a.type === 'run_fix_profile');
  const reviewActions = actions.filter(a => a.type === 'open_files_in_editor');
  const deleteActions = actions.filter(a => a.type === 'delete_files');
  const scanActions = actions.filter(a => a.type === 'run_project_scan');

  if (fixActions.length > 0) {
    const totalFiles = new Set(fixActions.flatMap(a => a.files || [])).size;
    summary.push(
      isArabic
        ? `إصلاح تلقائي لـ ${totalFiles} ملف`
        : `Auto-fix ${totalFiles} file(s)`
    );
  }

  if (reviewActions.length > 0) {
    const totalFiles = new Set(reviewActions.flatMap(a => a.files || [])).size;
    summary.push(
      isArabic
        ? `مراجعة يدوية لـ ${totalFiles} ملف`
        : `Manual review ${totalFiles} file(s)`
    );
  }

  if (deleteActions.length > 0) {
    const totalFiles = new Set(deleteActions.flatMap(a => a.files || [])).size;
    summary.push(
      isArabic
        ? `حذف ${totalFiles} ملف`
        : `Delete ${totalFiles} file(s)`
    );
  }

  if (scanActions.length > 0) {
    summary.push(
      isArabic
        ? 'إعادة فحص المشروع'
        : 'Re-scan project'
    );
  }

  return summary;
}

export default {
  mapSuggestionToActions,
  mapSuggestionsToActions,
  getPhaseActions,
  getActionsSummary,
};
