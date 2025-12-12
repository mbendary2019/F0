// desktop/src/lib/cleanup/cleanupOrchestrator.ts
// Phase 129.2: Cleanup Session Orchestrator

import type {
  CleanupSession,
  CleanupStep,
  SessionHealthSnapshot,
} from './cleanupTypes';
import { saveSession, addToHistory } from './cleanupStorage';

/**
 * Step executor function type
 */
export type StepExecutor = (
  step: CleanupStep,
  session: CleanupSession,
) => Promise<{
  success: boolean;
  itemsProcessed?: number;
  itemsFixed?: number;
  errors?: string[];
}>;

/**
 * Orchestrator callbacks
 */
export interface OrchestratorCallbacks {
  /** Called when a step starts */
  onStepStart?: (step: CleanupStep, session: CleanupSession) => void;
  /** Called when a step completes */
  onStepComplete?: (step: CleanupStep, session: CleanupSession) => void;
  /** Called on progress updates */
  onProgress?: (session: CleanupSession, progress: number) => void;
  /** Called when session completes */
  onComplete?: (session: CleanupSession) => void;
  /** Called on error */
  onError?: (error: string, session: CleanupSession) => void;
}

/**
 * Create a step executor from app callbacks
 */
export function createStepExecutors(callbacks: {
  scanProject: () => Promise<{ filesScanned: number; totalIssues: number }>;
  fixSafe: () => Promise<{ fixedCount: number }>;
  fixTypes: () => Promise<{ fixedCount: number }>;
  runAcePhase: (phaseId: string) => Promise<{ success: boolean }>;
  getHealthSnapshot: () => SessionHealthSnapshot;
  createSnapshot: () => Promise<string>;
}): Map<CleanupStep['type'], StepExecutor> {
  const executors = new Map<CleanupStep['type'], StepExecutor>();

  // Scan executor
  executors.set('scan', async (step, session) => {
    console.log('[CleanupOrchestrator] Running scan step');
    const result = await callbacks.scanProject();
    return {
      success: true,
      itemsProcessed: result.filesScanned,
      itemsFixed: 0,
    };
  });

  // Fix safe executor
  executors.set('fix_safe', async (step, session) => {
    console.log('[CleanupOrchestrator] Running fix_safe step');
    const result = await callbacks.fixSafe();
    return {
      success: true,
      itemsProcessed: result.fixedCount,
      itemsFixed: result.fixedCount,
    };
  });

  // Fix types executor
  executors.set('fix_types', async (step, session) => {
    console.log('[CleanupOrchestrator] Running fix_types step');
    const result = await callbacks.fixTypes();
    return {
      success: true,
      itemsProcessed: result.fixedCount,
      itemsFixed: result.fixedCount,
    };
  });

  // ACE phase executor
  executors.set('ace_phase', async (step, session) => {
    console.log('[CleanupOrchestrator] Running ace_phase step:', step.id);
    // Determine phase ID from step ID
    const phaseId = step.id.includes('phase1') ? 'phase-1-critical' : 'phase-4-cleanup';
    const result = await callbacks.runAcePhase(phaseId);
    return {
      success: result.success,
      itemsProcessed: 0,
      itemsFixed: 0,
    };
  });

  // Recompute executor
  executors.set('recompute', async (step, session) => {
    console.log('[CleanupOrchestrator] Running recompute step');
    // Just trigger a scan to recompute
    await callbacks.scanProject();
    return {
      success: true,
      itemsProcessed: 0,
      itemsFixed: 0,
    };
  });

  return executors;
}

/**
 * Run a cleanup session
 */
export async function runCleanupSession(
  session: CleanupSession,
  executors: Map<CleanupStep['type'], StepExecutor>,
  callbacks: OrchestratorCallbacks & {
    getHealthSnapshot: () => SessionHealthSnapshot;
    createSnapshot: () => Promise<string>;
  },
): Promise<CleanupSession> {
  const startTime = Date.now();

  console.log('[CleanupOrchestrator] Starting session:', session.id);

  // Update session status
  session.status = 'running';
  session.startedAt = new Date().toISOString();

  // Capture health before
  session.healthBefore = callbacks.getHealthSnapshot();
  console.log('[CleanupOrchestrator] Health before:', session.healthBefore.score);

  // Create snapshot for rollback
  try {
    session.snapshotId = await callbacks.createSnapshot();
    console.log('[CleanupOrchestrator] Created snapshot:', session.snapshotId);
  } catch (err) {
    console.warn('[CleanupOrchestrator] Could not create snapshot:', err);
  }

  // Save initial state
  await saveSession(session.projectRoot, session);

  // Track totals
  let totalFixed = 0;
  let filesScanned = 0;
  let issuesFound = 0;

  // Execute each step
  for (let i = 0; i < session.steps.length; i++) {
    const step = session.steps[i];
    session.currentStepIndex = i;

    // Check if cancelled
    if (session.status === 'cancelled') {
      console.log('[CleanupOrchestrator] Session cancelled');
      break;
    }

    // Get executor
    const executor = executors.get(step.type);
    if (!executor) {
      console.warn('[CleanupOrchestrator] No executor for step type:', step.type);
      step.status = 'skipped';
      continue;
    }

    // Start step
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    callbacks.onStepStart?.(step, session);

    // Calculate progress
    const progress = Math.round(((i + 0.5) / session.steps.length) * 100);
    callbacks.onProgress?.(session, progress);

    try {
      // Execute step
      const result = await executor(step, session);

      // Update step
      step.status = result.success ? 'completed' : 'failed';
      step.completedAt = new Date().toISOString();
      step.result = {
        itemsProcessed: result.itemsProcessed,
        itemsFixed: result.itemsFixed,
        errors: result.errors,
      };

      // Track totals
      if (result.itemsFixed) {
        totalFixed += result.itemsFixed;
      }
      if (step.type === 'scan' && result.itemsProcessed) {
        filesScanned = result.itemsProcessed;
        // Estimate issues from health snapshot
        issuesFound = session.healthBefore?.totalIssues || 0;
      }

      callbacks.onStepComplete?.(step, session);
    } catch (err) {
      console.error('[CleanupOrchestrator] Step failed:', step.id, err);
      step.status = 'failed';
      step.completedAt = new Date().toISOString();
      step.result = {
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      };

      callbacks.onError?.(
        `Step ${step.label} failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        session
      );

      // Continue with next step (don't abort entire session)
    }

    // Save progress
    await saveSession(session.projectRoot, session);

    // Update progress
    const finalProgress = Math.round(((i + 1) / session.steps.length) * 100);
    callbacks.onProgress?.(session, finalProgress);
  }

  // Capture health after
  session.healthAfter = callbacks.getHealthSnapshot();
  console.log('[CleanupOrchestrator] Health after:', session.healthAfter.score);

  // Finalize session
  const endTime = Date.now();
  session.status = session.status === 'cancelled' ? 'cancelled' : 'completed';
  session.completedAt = new Date().toISOString();

  // Build summary
  session.summary = {
    filesScanned,
    issuesFound,
    issuesFixed: totalFixed,
    issuesRemaining: session.healthAfter.totalIssues,
    durationMs: endTime - startTime,
    acePhasesRun: session.steps
      .filter(s => s.type === 'ace_phase' && s.status === 'completed')
      .map(s => s.id),
  };

  // Save final state
  await saveSession(session.projectRoot, session);

  // Add to history
  if (session.status === 'completed') {
    await addToHistory(session.projectRoot, session);
  }

  console.log('[CleanupOrchestrator] Session completed:', {
    id: session.id,
    healthBefore: session.healthBefore?.score,
    healthAfter: session.healthAfter?.score,
    issuesFixed: totalFixed,
    durationMs: endTime - startTime,
  });

  callbacks.onComplete?.(session);

  return session;
}

/**
 * Cancel a running session
 */
export function cancelSession(session: CleanupSession): CleanupSession {
  if (session.status === 'running') {
    session.status = 'cancelled';
    session.completedAt = new Date().toISOString();
  }
  return session;
}
