// desktop/src/lib/ace/aceExecutor.ts
// Phase 129.2: ACE Phase Runner Orchestrator
// Executes ACE evolution phases with safety and progress tracking

import type { AcePlanPhase, AceSuggestion } from './aceTypes';
import type { AcePlannedAction, AceActionType } from './aceActions';
import { getPhaseActions, mapSuggestionToActions } from './aceActions';

/**
 * Execution status for a phase
 */
export type AcePhaseExecutionStatus =
  | 'idle'
  | 'preparing'     // Creating snapshot, gathering actions
  | 'running'       // Executing actions
  | 'completed'     // All actions completed
  | 'failed'        // Error occurred
  | 'cancelled'     // User cancelled
  | 'paused';       // User paused execution

/**
 * Result of a single action execution
 */
export type AceActionResult = {
  actionId: string;
  success: boolean;
  error?: string;
  filesFixed?: number;
  filesOpened?: number;
  filesDeleted?: number;
  durationMs?: number;
  /** Phase 133.3: Additional metadata like filePath for changed files */
  metadata?: {
    filePath?: string;
    [key: string]: unknown;
  };
};

/**
 * State of a phase execution
 */
export type AcePhaseExecutionState = {
  /** Phase being executed */
  phaseId: string;
  /** Current status */
  status: AcePhaseExecutionStatus;
  /** Index of current action (0-based) */
  currentActionIndex: number;
  /** Total number of actions */
  totalActions: number;
  /** Actions to execute */
  actions: AcePlannedAction[];
  /** Results of completed actions */
  results: AceActionResult[];
  /** Errors encountered */
  errors: string[];
  /** Snapshot ID for rollback */
  snapshotId?: string;
  /** Start timestamp */
  startedAt?: string;
  /** End timestamp */
  completedAt?: string;
  /** Progress percentage (0-100) */
  progress: number;
};

/**
 * Options for phase execution
 */
export type AceExecutionOptions = {
  /** Create a snapshot before executing (safe mode) */
  createSnapshot?: boolean;
  /** Skip actions that require confirmation */
  skipConfirmationActions?: boolean;
  /** Continue on error */
  continueOnError?: boolean;
  /** Callback for progress updates */
  onProgress?: (state: AcePhaseExecutionState) => void;
  /** Callback for action completion */
  onActionComplete?: (result: AceActionResult, state: AcePhaseExecutionState) => void;
};

/**
 * Action executor interface - provided by the app
 */
export type ActionExecutorFn = (
  action: AcePlannedAction,
) => Promise<AceActionResult>;

/**
 * Snapshot creator interface - provided by the app
 */
export type SnapshotCreatorFn = (
  reason: string,
) => Promise<string>; // Returns snapshot ID

/**
 * Create initial execution state
 */
export function createInitialExecutionState(
  phaseId: string,
  actions: AcePlannedAction[],
): AcePhaseExecutionState {
  return {
    phaseId,
    status: 'idle',
    currentActionIndex: 0,
    totalActions: actions.length,
    actions,
    results: [],
    errors: [],
    progress: 0,
  };
}

/**
 * Calculate progress percentage
 */
function calculateProgress(
  completedActions: number,
  totalActions: number,
): number {
  if (totalActions === 0) return 100;
  return Math.round((completedActions / totalActions) * 100);
}

/**
 * Execute a single action
 */
async function executeAction(
  action: AcePlannedAction,
  executor: ActionExecutorFn,
): Promise<AceActionResult> {
  const startTime = Date.now();

  try {
    const result = await executor(action);
    return {
      ...result,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      actionId: action.id,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Execute a phase with all its actions
 */
export async function executePhase(
  phase: AcePlanPhase,
  suggestions: AceSuggestion[],
  executor: ActionExecutorFn,
  snapshotCreator?: SnapshotCreatorFn,
  options: AceExecutionOptions = {},
): Promise<AcePhaseExecutionState> {
  const {
    createSnapshot = true,
    skipConfirmationActions = false,
    continueOnError = true,
    onProgress,
    onActionComplete,
  } = options;

  // Get actions for this phase
  const { actions: allActions } = getPhaseActions(
    phase.id,
    phase.suggestionIds,
    suggestions,
  );

  // Filter out confirmation actions if requested
  const actions = skipConfirmationActions
    ? allActions.filter(a => !a.requiresConfirmation)
    : allActions;

  // Initialize state
  let state = createInitialExecutionState(phase.id, actions);
  state.status = 'preparing';
  state.startedAt = new Date().toISOString();

  // Notify progress
  onProgress?.(state);

  // Create snapshot if requested
  if (createSnapshot && snapshotCreator) {
    try {
      const snapshotId = await snapshotCreator(`ACE_PHASE_START:${phase.id}`);
      state.snapshotId = snapshotId;
      console.log(`[ACE Executor] Created snapshot: ${snapshotId}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Snapshot creation failed';
      console.error('[ACE Executor] Snapshot creation failed:', errorMsg);
      state.errors.push(`Snapshot failed: ${errorMsg}`);
      // Continue without snapshot if it fails
    }
  }

  // Start execution
  state.status = 'running';
  onProgress?.(state);

  // Execute each action
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    state.currentActionIndex = i;
    state.progress = calculateProgress(i, actions.length);
    onProgress?.(state);

    console.log(`[ACE Executor] Executing action ${i + 1}/${actions.length}: ${action.type}`);

    // Execute the action
    const result = await executeAction(action, executor);
    state.results.push(result);

    // Notify action completion
    onActionComplete?.(result, state);

    // Handle errors
    if (!result.success) {
      state.errors.push(result.error || 'Action failed');
      console.error(`[ACE Executor] Action failed: ${result.error}`);

      if (!continueOnError) {
        state.status = 'failed';
        state.completedAt = new Date().toISOString();
        onProgress?.(state);
        return state;
      }
    }
  }

  // Mark as completed
  state.status = state.errors.length > 0 ? 'completed' : 'completed';
  state.completedAt = new Date().toISOString();
  state.progress = 100;
  state.currentActionIndex = actions.length;

  onProgress?.(state);

  console.log('[ACE Executor] Phase execution completed', {
    phaseId: phase.id,
    totalActions: actions.length,
    successfulActions: state.results.filter(r => r.success).length,
    failedActions: state.results.filter(r => !r.success).length,
    errors: state.errors.length,
  });

  return state;
}

/**
 * Execute a single suggestion (outside of a phase)
 */
export async function executeSuggestion(
  suggestion: AceSuggestion,
  executor: ActionExecutorFn,
  snapshotCreator?: SnapshotCreatorFn,
  options: AceExecutionOptions = {},
): Promise<AcePhaseExecutionState> {
  const { createSnapshot = true, onProgress } = options;

  // Map suggestion to actions
  const mapping = mapSuggestionToActions(suggestion);
  const actions = mapping.actions;

  // Initialize state
  let state = createInitialExecutionState(suggestion.id, actions);
  state.status = 'preparing';
  state.startedAt = new Date().toISOString();

  onProgress?.(state);

  // Create snapshot if requested
  if (createSnapshot && snapshotCreator) {
    try {
      const snapshotId = await snapshotCreator(`ACE_SUGGESTION:${suggestion.id}`);
      state.snapshotId = snapshotId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Snapshot creation failed';
      state.errors.push(`Snapshot failed: ${errorMsg}`);
    }
  }

  // Execute actions
  state.status = 'running';
  onProgress?.(state);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    state.currentActionIndex = i;
    state.progress = calculateProgress(i, actions.length);
    onProgress?.(state);

    const result = await executeAction(action, executor);
    state.results.push(result);

    if (!result.success) {
      state.errors.push(result.error || 'Action failed');
    }
  }

  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  state.progress = 100;
  onProgress?.(state);

  return state;
}

/**
 * Get execution summary for display
 */
export function getExecutionSummary(
  state: AcePhaseExecutionState,
  locale: 'ar' | 'en' = 'en',
): {
  title: string;
  status: string;
  progress: string;
  details: string[];
} {
  const isArabic = locale === 'ar';

  const statusLabels: Record<AcePhaseExecutionStatus, { en: string; ar: string }> = {
    idle: { en: 'Ready', ar: 'جاهز' },
    preparing: { en: 'Preparing...', ar: 'جاري التحضير...' },
    running: { en: 'Running...', ar: 'جاري التنفيذ...' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    failed: { en: 'Failed', ar: 'فشل' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
    paused: { en: 'Paused', ar: 'متوقف مؤقتاً' },
  };

  const successCount = state.results.filter(r => r.success).length;
  const failCount = state.results.filter(r => !r.success).length;

  const details: string[] = [];

  if (state.snapshotId) {
    details.push(isArabic ? `نقطة استعادة: ${state.snapshotId}` : `Snapshot: ${state.snapshotId}`);
  }

  if (state.results.length > 0) {
    const filesFixed = state.results.reduce((sum, r) => sum + (r.filesFixed || 0), 0);
    if (filesFixed > 0) {
      details.push(isArabic ? `${filesFixed} ملف تم إصلاحه` : `${filesFixed} file(s) fixed`);
    }
  }

  if (failCount > 0) {
    details.push(
      isArabic
        ? `${failCount} إجراء فشل`
        : `${failCount} action(s) failed`
    );
  }

  return {
    title: isArabic ? `Phase ${state.phaseId}` : `Phase ${state.phaseId}`,
    status: isArabic ? statusLabels[state.status].ar : statusLabels[state.status].en,
    progress: isArabic
      ? `${state.progress}% (${state.currentActionIndex}/${state.totalActions})`
      : `${state.progress}% (${state.currentActionIndex}/${state.totalActions})`,
    details,
  };
}

/**
 * Check if execution can be rolled back
 */
export function canRollback(state: AcePhaseExecutionState): boolean {
  return (
    !!state.snapshotId &&
    (state.status === 'completed' || state.status === 'failed')
  );
}

/**
 * Estimate total execution time
 */
export function estimateExecutionTime(actions: AcePlannedAction[]): number {
  return actions.reduce((sum, a) => sum + (a.estimatedTimeSeconds || 0), 0);
}

export default {
  executePhase,
  executeSuggestion,
  createInitialExecutionState,
  getExecutionSummary,
  canRollback,
  estimateExecutionTime,
};
