// desktop/src/lib/agent/runtimeContext.ts
// Phase 118: Agent-Aware Runtime Debugging
// Builds runtime debug context from preview logs for the agent

import { getRuntimeErrorSummary } from '../../state/previewLogsState';

/**
 * Build runtime debug context for the code agent.
 * Returns null if no errors/warnings exist.
 *
 * This context is injected as a system message before the user's prompt
 * so the agent is aware of current runtime issues in the preview.
 */
export function buildRuntimeDebugContext(): string | null {
  const summary = getRuntimeErrorSummary(5);
  if (!summary) return null;

  return [
    'RUNTIME_DEBUG_CONTEXT:',
    'The following errors/warnings were observed in the live preview (Electron webview console):',
    '',
    summary,
    '',
    'When fixing code, prioritize resolving these runtime issues. ' +
      'Explain briefly which error you are addressing.',
  ].join('\n');
}

/**
 * Check if there are any runtime issues to display in the UI
 */
export function hasRuntimeIssues(): boolean {
  const summary = getRuntimeErrorSummary(1);
  return summary !== null;
}
