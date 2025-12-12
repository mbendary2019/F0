// src/lib/agent/actions/runner/executors/env.ts

import {
  AnyAction,
  ActionExecutionResult,
} from '@/lib/agent/actions/actionTypes';

/**
 * Executes environment variable actions (UPDATE_ENV).
 *
 * MVP: Placeholder implementation that returns SUCCESS.
 * Phase 95.3.3 will implement actual env file modifications.
 */
export async function runEnvAction(
  action: AnyAction
): Promise<ActionExecutionResult> {
  const start = Date.now();

  return {
    status: 'SUCCESS',
    startedAt: start,
    finishedAt: Date.now(),
    logs: [
      '📝 ENV executor placeholder',
      `Action: ${action.action}`,
      '⚙️ Will modify .env.local / config soon...',
    ],
    output: { mock: true },
  };
}
