// src/lib/agent/actions/runner/executors/tool.ts

import {
  AnyAction,
  ActionExecutionResult,
} from '@/lib/agent/actions/actionTypes';

/**
 * Executes tool actions (CALL_TOOL).
 *
 * MVP: Placeholder implementation that returns SUCCESS.
 * Phase 95.3.5 will implement tool framework for external integrations.
 */
export async function runToolAction(
  action: AnyAction
): Promise<ActionExecutionResult> {
  const start = Date.now();

  return {
    status: 'SUCCESS',
    startedAt: start,
    finishedAt: Date.now(),
    logs: [
      '📝 TOOL executor placeholder',
      `Tool: ${(action as any).toolName || 'unknown'}`,
      '🔧 Tool calls will be added in later phases.',
    ],
    output: { mock: true },
  };
}
