'use client';

/**
 * Phase 95.3: Actions Panel
 * Displays and manages project actions from ops_actions collection
 * Shows action queue with status, retry, cancel capabilities
 */

import { useState, useEffect, useCallback } from 'react';

// Types matching server schema
type ActionType =
  | 'execute_task'
  | 'run_tests'
  | 'deploy'
  | 'analyze_logs'
  | 'open_pr'
  | 'send_notification'
  | 'git_commit'
  | 'git_push';

type ActionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface F0Action {
  id: string;
  projectId: string;
  type: ActionType;
  status: ActionStatus;
  taskId?: string;
  phaseId?: string;
  source: string;
  createdBy?: string;
  payload?: Record<string, any>;
  resultSummary?: string;
  errorMessage?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface ActionStats {
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}

const ACTION_TYPE_CONFIG: Record<
  ActionType,
  { label: string; labelAr: string; icon: string; color: string }
> = {
  execute_task: {
    label: 'Execute Task',
    labelAr: 'تنفيذ مهمة',
    icon: '⚡',
    color: 'text-blue-400',
  },
  run_tests: {
    label: 'Run Tests',
    labelAr: 'تشغيل الاختبارات',
    icon: '🧪',
    color: 'text-green-400',
  },
  deploy: {
    label: 'Deploy',
    labelAr: 'نشر',
    icon: '🚀',
    color: 'text-purple-400',
  },
  analyze_logs: {
    label: 'Analyze Logs',
    labelAr: 'تحليل السجلات',
    icon: '📊',
    color: 'text-orange-400',
  },
  open_pr: {
    label: 'Open PR',
    labelAr: 'فتح PR',
    icon: '🔀',
    color: 'text-cyan-400',
  },
  send_notification: {
    label: 'Send Notification',
    labelAr: 'إرسال إشعار',
    icon: '🔔',
    color: 'text-yellow-400',
  },
  git_commit: {
    label: 'Git Commit',
    labelAr: 'Git Commit',
    icon: '📝',
    color: 'text-pink-400',
  },
  git_push: {
    label: 'Git Push',
    labelAr: 'Git Push',
    icon: '⬆️',
    color: 'text-indigo-400',
  },
};

const STATUS_CONFIG: Record<
  ActionStatus,
  { label: string; labelAr: string; color: string; bg: string }
> = {
  pending: {
    label: 'Pending',
    labelAr: 'في الانتظار',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
  },
  running: {
    label: 'Running',
    labelAr: 'قيد التنفيذ',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
  },
  succeeded: {
    label: 'Succeeded',
    labelAr: 'نجح',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
  },
  failed: {
    label: 'Failed',
    labelAr: 'فشل',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    labelAr: 'ملغى',
    color: 'text-gray-400',
    bg: 'bg-gray-500/20',
  },
};

interface ActionsPanelProps {
  projectId: string;
  lang?: 'ar' | 'en';
  className?: string;
  showStats?: boolean;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onActionComplete?: (action: F0Action) => void;
}

export function ActionsPanel({
  projectId,
  lang = 'ar',
  className = '',
  showStats = true,
  maxItems = 10,
  autoRefresh = true,
  refreshInterval = 5000,
  onActionComplete,
}: ActionsPanelProps) {
  const [actions, setActions] = useState<F0Action[]>([]);
  const [stats, setStats] = useState<ActionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActionStatus | 'all'>('all');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isArabic = lang === 'ar';

  const fetchActions = useCallback(async () => {
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(
        `/api/projects/${projectId}/actions?limit=${maxItems}${statusParam}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch actions');
      }

      setActions(data.actions);
      if (data.stats) {
        setStats(data.stats);
      }
      setError(null);

      // Check for newly completed actions
      if (onActionComplete) {
        data.actions.forEach((action: F0Action) => {
          if (action.status === 'succeeded' || action.status === 'failed') {
            onActionComplete(action);
          }
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, filter, maxItems, onActionComplete]);

  useEffect(() => {
    fetchActions();

    // Auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchActions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchActions, autoRefresh, refreshInterval]);

  const handleRetry = async (actionId: string) => {
    setActionLoading(actionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry action');
      }

      await fetchActions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (actionId: string) => {
    setActionLoading(actionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/actions/${actionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel action');
      }

      await fetchActions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunNext = async () => {
    setActionLoading('run-next');
    try {
      const res = await fetch('/api/f0/auto-execute-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run next action');
      }

      await fetchActions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className={`bg-black/50 border border-white/10 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-white/5 rounded"></div>
            <div className="h-12 bg-white/5 rounded"></div>
            <div className="h-12 bg-white/5 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/50 border border-white/10 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h3 className="font-medium">
              {isArabic ? 'قائمة الإجراءات' : 'Actions Queue'}
            </h3>
            {stats && (
              <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                {stats.total} {isArabic ? 'إجراء' : 'actions'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunNext}
              disabled={actionLoading === 'run-next' || stats?.pending === 0}
              className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1 transition ${
                stats?.pending === 0
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              }`}
            >
              {actionLoading === 'run-next' ? (
                <span className="animate-spin">⏳</span>
              ) : (
                '▶️'
              )}
              {isArabic ? 'تشغيل التالي' : 'Run Next'}
            </button>
            <button
              onClick={fetchActions}
              className="text-xs text-white/40 hover:text-white/60"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {showStats && stats && (
          <div className="flex gap-2 flex-wrap">
            {(['pending', 'running', 'succeeded', 'failed'] as const).map((status) => {
              const config = STATUS_CONFIG[status];
              const count = stats[status];
              return (
                <button
                  key={status}
                  onClick={() => setFilter(filter === status ? 'all' : status)}
                  className={`text-xs px-2 py-1 rounded-md transition ${
                    filter === status
                      ? `${config.bg} ${config.color} ring-1 ring-current`
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  {count} {isArabic ? config.labelAr : config.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border-b border-red-500/30">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Actions List */}
      <div className="divide-y divide-white/5">
        {actions.length === 0 ? (
          <div className="p-6 text-center text-white/40">
            {isArabic
              ? 'لا توجد إجراءات في القائمة'
              : 'No actions in queue'}
          </div>
        ) : (
          actions.map((action) => {
            const typeConfig = ACTION_TYPE_CONFIG[action.type];
            const statusConfig = STATUS_CONFIG[action.status];
            const isExpanded = expandedActionId === action.id;
            const isLoading = actionLoading === action.id;

            return (
              <div
                key={action.id}
                className="p-3 hover:bg-white/5 transition cursor-pointer"
                onClick={() => setExpandedActionId(isExpanded ? null : action.id)}
              >
                {/* Main Row */}
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${typeConfig.color}`}>
                    {typeConfig.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {isArabic ? typeConfig.labelAr : typeConfig.label}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${statusConfig.bg} ${statusConfig.color}`}
                      >
                        {action.status === 'running' && (
                          <span className="animate-pulse mr-1">●</span>
                        )}
                        {isArabic ? statusConfig.labelAr : statusConfig.label}
                      </span>
                    </div>
                    {action.payload?.taskTitle && (
                      <p className="text-xs text-white/40 truncate mt-0.5">
                        {action.payload.taskTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Attempts */}
                    {action.attempts > 0 && (
                      <span className="text-xs text-white/30">
                        {action.attempts}/{action.maxAttempts}
                      </span>
                    )}
                    {/* Action Buttons */}
                    {action.status === 'failed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry(action.id);
                        }}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition"
                      >
                        {isLoading ? '⏳' : '🔄'} {isArabic ? 'إعادة' : 'Retry'}
                      </button>
                    )}
                    {(action.status === 'pending' || action.status === 'running') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(action.id);
                        }}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                      >
                        {isLoading ? '⏳' : '❌'} {isArabic ? 'إلغاء' : 'Cancel'}
                      </button>
                    )}
                    {/* Expand Arrow */}
                    <span className="text-white/30 text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 p-3 bg-black/30 rounded-lg text-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-white/40">ID:</span>{' '}
                        <span className="text-white/60 font-mono">{action.id}</span>
                      </div>
                      <div>
                        <span className="text-white/40">
                          {isArabic ? 'المصدر:' : 'Source:'}
                        </span>{' '}
                        <span className="text-white/60">{action.source}</span>
                      </div>
                      {action.taskId && (
                        <div>
                          <span className="text-white/40">
                            {isArabic ? 'المهمة:' : 'Task:'}
                          </span>{' '}
                          <span className="text-white/60 font-mono">{action.taskId}</span>
                        </div>
                      )}
                      {action.createdAt && (
                        <div>
                          <span className="text-white/40">
                            {isArabic ? 'أُنشئ:' : 'Created:'}
                          </span>{' '}
                          <span className="text-white/60">
                            {new Date(action.createdAt).toLocaleString(
                              isArabic ? 'ar-EG' : 'en-US'
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    {action.resultSummary && (
                      <div className="pt-2 border-t border-white/10">
                        <span className="text-white/40">
                          {isArabic ? 'النتيجة:' : 'Result:'}
                        </span>
                        <p className="text-white/70 mt-1">{action.resultSummary}</p>
                      </div>
                    )}
                    {action.errorMessage && (
                      <div className="pt-2 border-t border-white/10">
                        <span className="text-red-400">
                          {isArabic ? 'الخطأ:' : 'Error:'}
                        </span>
                        <p className="text-red-300/80 mt-1">{action.errorMessage}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Hook to manage actions
 */
export function useActions(projectId: string | undefined) {
  const [actions, setActions] = useState<F0Action[]>([]);
  const [stats, setStats] = useState<ActionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/actions`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch actions');
      }

      setActions(data.actions);
      setStats(data.stats);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const enqueueAction = useCallback(
    async (params: {
      type: ActionType;
      source?: string;
      taskId?: string;
      phaseId?: string;
      payload?: Record<string, any>;
    }) => {
      if (!projectId) throw new Error('No projectId');

      const res = await fetch(`/api/projects/${projectId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enqueue action');
      }

      await fetchActions();
      return data.action;
    },
    [projectId, fetchActions]
  );

  const cancelAction = useCallback(
    async (actionId: string) => {
      if (!projectId) throw new Error('No projectId');

      const res = await fetch(`/api/projects/${projectId}/actions/${actionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel action');
      }

      await fetchActions();
    },
    [projectId, fetchActions]
  );

  const retryAction = useCallback(
    async (actionId: string) => {
      if (!projectId) throw new Error('No projectId');

      const res = await fetch(`/api/projects/${projectId}/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry action');
      }

      await fetchActions();
    },
    [projectId, fetchActions]
  );

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return {
    actions,
    stats,
    loading,
    error,
    refresh: fetchActions,
    enqueueAction,
    cancelAction,
    retryAction,
  };
}

/**
 * Compact action status badge component
 */
export function ActionStatusBadge({
  status,
  lang = 'ar',
}: {
  status: ActionStatus;
  lang?: 'ar' | 'en';
}) {
  const config = STATUS_CONFIG[status];
  const isArabic = lang === 'ar';

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
      {status === 'running' && <span className="animate-pulse mr-1">●</span>}
      {isArabic ? config.labelAr : config.label}
    </span>
  );
}
