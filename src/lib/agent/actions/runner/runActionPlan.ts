// src/lib/agent/actions/runner/runActionPlan.ts

import {
  ActionPlan,
  AnyAction,
  PlannedAction,
  ActionStatus,
  ActionExecutionResult,
} from '@/lib/agent/actions/actionTypes';

import { runFileSystemAction } from './executors/fileSystem';
import { runFirestoreAction } from './executors/firestore';
import { runEnvAction } from './executors/env';
import { runDeployAction } from './executors/deploy';
import { runMemoryAction } from './executors/memory';
import { runToolAction } from './executors/tool';

import { logRunnerEvent } from './utils/logger';

/* -------------------------------------------------------------------------- */
/*                               Main Executor                                 */
/* -------------------------------------------------------------------------- */

/**
 * Runs the entire ActionPlan step-by-step.
 * Produces updated plan with execution results filled in.
 *
 * Flow:
 * 1. Loop through each step in order
 * 2. Dispatch action to appropriate executor
 * 3. Capture result and update step status
 * 4. Stop if error and skipOnError is false
 * 5. Return updated plan with all results
 */
export async function runActionPlan(
  plan: ActionPlan
): Promise<ActionPlan> {
  const startTs = Date.now();

  logRunnerEvent(`▶️ Starting ActionPlan execution: ${plan.id}`);

  for (const step of plan.steps) {
    const { action, index } = step;

    logRunnerEvent(
      `🟦 [Step ${index}] Executing action: ${action.action}`
    );

    step.status = 'RUNNING';

    let result: ActionExecutionResult;

    try {
      result = await dispatchAction(action);
    } catch (err: any) {
      result = {
        status: 'ERROR',
        startedAt: Date.now(),
        finishedAt: Date.now(),
        logs: [
          '❌ Execution error caught by runActionPlan dispatcher',
          String(err?.message || err),
        ],
        error: {
          message: String(err?.message || 'Unknown error'),
          details: err,
        },
      };
    }

    // Save result in the step
    step.result = result;
    step.status = result.status;

    // Logging result
    logRunnerEvent(
      `📝 [Step ${index}] Status: ${result.status}${
        result.error?.message ? ` – ${result.error.message}` : ''
      }`
    );

    // If an error happened and we're NOT allowed to continue
    if (result.status === 'ERROR' && !action.skipOnError) {
      logRunnerEvent(
        `⛔ Stopping plan execution due to error at step ${index}`
      );
      break;
    }
  }

  const endTs = Date.now();
  logRunnerEvent(
    `🏁 Finished ActionPlan execution: ${plan.id} (in ${
      endTs - startTs
    } ms)`
  );

  return plan;
}

/* -------------------------------------------------------------------------- */
/*                                Dispatcher                                  */
/* -------------------------------------------------------------------------- */

/**
 * Dispatches an action to the correct executor based on action.action.
 * Returns ActionExecutionResult.
 */
async function dispatchAction(
  action: AnyAction
): Promise<ActionExecutionResult> {
  const start = Date.now();

  try {
    switch (action.action) {
      /* ---------------------------- FILE SYSTEM ---------------------------- */
      case 'WRITE_FILE':
      case 'UPDATE_FILE':
      case 'DELETE_FILE':
      case 'MKDIR':
        return await runFileSystemAction(action);

      /* ----------------------------- FIRESTORE ----------------------------- */
      case 'CREATE_FIRESTORE_DOC':
      case 'UPDATE_FIRESTORE_DOC':
      case 'DELETE_FIRESTORE_DOC':
        return await runFirestoreAction(action);

      /* ------------------------------ ENV ---------------------------------- */
      case 'UPDATE_ENV':
        return await runEnvAction(action);

      /* ----------------------------- DEPLOY -------------------------------- */
      case 'RUN_DEPLOY':
        return await runDeployAction(action);

      /* ----------------------------- MEMORY -------------------------------- */
      case 'APPEND_MEMORY_NOTE':
      case 'SET_MEMORY_SECTION':
        return await runMemoryAction(action);

      /* ------------------------------ TOOL --------------------------------- */
      case 'CALL_TOOL':
        return await runToolAction(action);

      /* --------------------------- UNKNOWN CASE ---------------------------- */
      default:
        return {
          status: 'ERROR',
          startedAt: start,
          finishedAt: Date.now(),
          logs: [
            `❌ Unknown action type: "${(action as any).action}"`,
          ],
          error: {
            message: `Unknown action type: ${(action as any).action}`,
          },
        };
    }
  } catch (err: any) {
    return {
      status: 'ERROR',
      startedAt: start,
      finishedAt: Date.now(),
      logs: [
        '❌ Exception caught inside dispatcher',
        String(err?.message || err),
      ],
      error: {
        message: String(err?.message || 'Unknown dispatcher error'),
        details: err,
      },
    };
  }
}
