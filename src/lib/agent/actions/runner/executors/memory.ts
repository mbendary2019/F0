// src/lib/agent/actions/runner/executors/memory.ts

import {
  AnyAction,
  ActionExecutionResult,
} from '@/lib/agent/actions/actionTypes';
import {
  upsertMemorySection,
} from '@/lib/agent/projectMemory';

/**
 * Executes memory actions (APPEND_MEMORY_NOTE, SET_MEMORY_SECTION).
 *
 * MVP: Implements SET_MEMORY_SECTION with real Phase 94 integration.
 * APPEND_MEMORY_NOTE is placeholder for now.
 */
export async function runMemoryAction(
  action: AnyAction
): Promise<ActionExecutionResult> {
  const start = Date.now();

  try {
    // SET_MEMORY_SECTION: Real implementation
    if (action.action === 'SET_MEMORY_SECTION') {
      await upsertMemorySection({
        projectId: action.projectId,
        sectionId: (action as any).sectionId,
        updater: () => ({
          id: (action as any).sectionId,
          title: (action as any).sectionId,
          content: (action as any).content || '',
          updatedAt: Date.now(),
        }),
      });

      return {
        status: 'SUCCESS',
        startedAt: start,
        finishedAt: Date.now(),
        logs: [
          '🧠 MEMORY executor',
          `Action: ${action.action}`,
          `Section: ${(action as any).sectionId}`,
          '✅ Memory section updated successfully',
        ],
        output: { done: true },
      };
    }

    // APPEND_MEMORY_NOTE: Placeholder
    if (action.action === 'APPEND_MEMORY_NOTE') {
      // TODO: Implement append logic in Phase 95.3.5
      return {
        status: 'SUCCESS',
        startedAt: start,
        finishedAt: Date.now(),
        logs: [
          '🧠 MEMORY executor (placeholder)',
          `Action: ${action.action}`,
          '📝 APPEND_MEMORY_NOTE coming soon...',
        ],
        output: { mock: true },
      };
    }

    // Unknown memory action
    return {
      status: 'ERROR',
      startedAt: start,
      finishedAt: Date.now(),
      logs: [`❌ Unknown memory action: ${action.action}`],
      error: {
        message: `Unknown memory action: ${action.action}`,
      },
    };
  } catch (err: any) {
    return {
      status: 'ERROR',
      startedAt: start,
      finishedAt: Date.now(),
      logs: [
        '❌ Memory action failed',
        String(err?.message || err),
      ],
      error: {
        message: String(err?.message || 'Unknown error'),
        details: err,
      },
    };
  }
}
