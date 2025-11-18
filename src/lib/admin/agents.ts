/**
 * Agents Utilities
 * Helper functions and types for autonomous agents
 */

export type AgentKind = 'predict' | 'remediate' | 'report' | 'guard';

export type AgentStatus = 'queued' | 'running' | 'done' | 'rejected';

export const AGENT_EVENTS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  REJECTED: 'rejected'
} as const;

export type AgentJob = {
  id?: string;
  kind: AgentKind;
  payload: Record<string, unknown>;
  status?: AgentStatus;
  createdAt?: number;
  updatedAt?: number;
  requestedBy?: string;
  result?: any;
  decision?: any;
  error?: string;
};

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: AgentStatus): string {
  const labels: Record<AgentStatus, string> = {
    queued: '⏳ Queued',
    running: '🔄 Running',
    done: '✅ Done',
    rejected: '❌ Rejected'
  };
  return labels[status] || status;
}

/**
 * Get status color class
 */
export function getStatusColor(status: AgentStatus): string {
  const colors: Record<AgentStatus, string> = {
    queued: 'bg-gray-100 text-gray-800',
    running: 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get kind icon
 */
export function getKindIcon(kind: AgentKind): string {
  const icons: Record<AgentKind, string> = {
    predict: '🔮',
    remediate: '🔧',
    report: '📊',
    guard: '🛡️'
  };
  return icons[kind] || '🤖';
}


