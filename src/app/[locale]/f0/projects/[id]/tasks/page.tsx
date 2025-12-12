'use client';

/**
 * Phase 93.6: Project Task Board (Kanban)
 * Visual board with 4 columns: Pending, In Progress, Completed, Blocked
 * Uses useProjectPlan hook from Phase 93.5
 * Phase 96.1: Added QA Status Badge support
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectPlan } from '@/hooks/useProjectPlan';
import type { TaskDoc, PhaseDoc } from '@/lib/server/projectPlan';
import { QaStatusBadge, QaResultCard } from '@/components/f0/orchestrator/QaStatusBadge';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

const COLUMNS: { status: TaskStatus; label: string; labelAr: string; color: string; bgColor: string }[] = [
  { status: 'pending', label: 'Pending', labelAr: 'قيد الانتظار', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/30' },
  { status: 'in_progress', label: 'In Progress', labelAr: 'قيد التنفيذ', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30' },
  { status: 'completed', label: 'Completed', labelAr: 'مكتملة', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/30' },
  { status: 'blocked', label: 'Blocked', labelAr: 'متوقفة', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30' },
];

const MODE_ICONS: Record<string, string> = {
  chat: '💬',
  refactor: '🔧',
  deploy: '🚀',
  plan: '📋',
  explain: '📖',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function ProjectTasksPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const {
    phases,
    tasks,
    progress,
    loading,
    error,
    refresh,
    updateTaskStatus,
  } = useProjectPlan(projectId, { pollInterval: 5000, includeProgress: true });

  const [selectedTask, setSelectedTask] = useState<TaskDoc | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Get phase by ID
  const getPhase = useCallback((phaseId: string): PhaseDoc | undefined => {
    return phases.find(p => p.id === phaseId);
  }, [phases]);

  // Group tasks by status
  const tasksByStatus: Record<TaskStatus, TaskDoc[]> = {
    pending: [],
    in_progress: [],
    completed: [],
    blocked: [],
  };

  for (const task of tasks) {
    const status = task.status as TaskStatus;
    if (tasksByStatus[status]) {
      tasksByStatus[status].push(task);
    }
  }

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setActionLoading(taskId);
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle run task via auto-executor
  const handleRunTask = async (task: TaskDoc) => {
    setRunningTaskId(task.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to run task');
      }

      // Refresh to get updated status
      await refresh();
    } catch (err) {
      console.error('Failed to run task:', err);
      alert(`خطأ في تشغيل المهمة: ${err}`);
    } finally {
      setRunningTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-64 mb-6"></div>
            <div className="h-4 bg-white/10 rounded w-full mb-8"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-96 bg-white/5 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">خطأ: {error}</p>
            <button
              onClick={refresh}
              className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overallCompletion = progress?.overallCompletion ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">📋 لوحة المهام</h1>
            <p className="text-sm text-white/60 mt-1">
              إدارة وتتبع مهام المشروع
            </p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
          >
            🔄 تحديث
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">التقدم الكلي</span>
            <span className="text-sm font-mono">
              {progress?.completedTasks ?? 0} / {progress?.totalTasks ?? 0} مهمة
              ({overallCompletion}%)
            </span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${overallCompletion}%` }}
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {COLUMNS.map(col => (
            <div
              key={col.status}
              className={`p-4 rounded-lg border ${col.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm ${col.color}`}>{col.labelAr}</span>
                <span className="text-2xl font-bold">
                  {tasksByStatus[col.status].length}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.status} className="flex flex-col">
              {/* Column Header */}
              <div className={`p-3 rounded-t-lg border-b-2 ${col.bgColor} border-b-${col.color.replace('text-', '')}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${col.color}`}>{col.labelAr}</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
                    {tasksByStatus[col.status].length}
                  </span>
                </div>
              </div>

              {/* Tasks */}
              <div className="flex-1 bg-white/5 rounded-b-lg p-2 space-y-2 min-h-[400px]">
                {tasksByStatus[col.status].length === 0 ? (
                  <div className="text-center text-white/30 py-8 text-sm">
                    لا توجد مهام
                  </div>
                ) : (
                  tasksByStatus[col.status].map(task => {
                    const phase = getPhase(task.phaseId);
                    const isRunning = runningTaskId === task.id;
                    const isActionLoading = actionLoading === task.id;

                    return (
                      <div
                        key={task.id}
                        className="bg-black/50 border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors cursor-pointer"
                        onClick={() => setSelectedTask(task)}
                      >
                        {/* Task Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-medium text-sm line-clamp-2">
                            {task.title}
                          </h3>
                          <span className="text-lg flex-shrink-0">
                            {MODE_ICONS[task.mode] || '📌'}
                          </span>
                        </div>

                        {/* Phase Badge */}
                        {phase && (
                          <div className="text-xs text-white/50 mb-2">
                            📁 {phase.title}
                          </div>
                        )}

                        {/* Priority & Mode & QA Status */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                            {task.priority === 'high' ? 'عالية' : task.priority === 'low' ? 'منخفضة' : 'متوسطة'}
                          </span>
                          <span className="text-xs text-white/40">
                            {task.mode}
                          </span>
                          {/* Phase 96.1: QA Status Badge */}
                          <QaStatusBadge
                            status={(task as any).lastQaStatus}
                            lang="ar"
                            showTooltip
                            lastQaSummary={(task as any).lastQaSummary}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                          {/* Status Change Buttons */}
                          {col.status !== 'pending' && (
                            <button
                              onClick={() => handleStatusChange(task.id, 'pending')}
                              disabled={isActionLoading}
                              className="text-xs px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors disabled:opacity-50"
                            >
                              ⏳
                            </button>
                          )}
                          {col.status !== 'in_progress' && (
                            <button
                              onClick={() => handleStatusChange(task.id, 'in_progress')}
                              disabled={isActionLoading}
                              className="text-xs px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors disabled:opacity-50"
                            >
                              ▶️
                            </button>
                          )}
                          {col.status !== 'completed' && (
                            <button
                              onClick={() => handleStatusChange(task.id, 'completed')}
                              disabled={isActionLoading}
                              className="text-xs px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors disabled:opacity-50"
                            >
                              ✅
                            </button>
                          )}
                          {col.status !== 'blocked' && (
                            <button
                              onClick={() => handleStatusChange(task.id, 'blocked')}
                              disabled={isActionLoading}
                              className="text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors disabled:opacity-50"
                            >
                              🚫
                            </button>
                          )}

                          {/* Run Button (only for pending/blocked tasks) */}
                          {(col.status === 'pending' || col.status === 'blocked') && (
                            <button
                              onClick={() => handleRunTask(task)}
                              disabled={isRunning}
                              className="text-xs px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {isRunning ? (
                                <>
                                  <span className="animate-spin">⚙️</span>
                                  جاري...
                                </>
                              ) : (
                                <>🤖 تشغيل</>
                              )}
                            </button>
                          )}

                          {/* Quick QA Button */}
                          <button
                            onClick={() => setSelectedTask(task)}
                            className="text-xs px-2 py-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded transition-colors flex items-center gap-1"
                            title="فحص QA"
                          >
                            🔍 QA
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            phase={getPhase(selectedTask.phaseId)}
            projectId={projectId}
            onClose={() => setSelectedTask(null)}
            onStatusChange={handleStatusChange}
            onRun={handleRunTask}
            onRefresh={refresh}
          />
        )}
      </div>
    </div>
  );
}

// QA Mode type for re-run selector
type QaMode = 'static' | 'ai' | 'both';

/**
 * Task Detail Modal with AI Logs History
 * Phase 96.3: Added QA Report section with re-run support
 */
function TaskDetailModal({
  task,
  phase,
  projectId,
  onClose,
  onStatusChange,
  onRun,
  onRefresh,
}: {
  task: TaskDoc;
  phase?: PhaseDoc;
  projectId: string;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onRun: (task: TaskDoc) => Promise<void>;
  onRefresh?: () => Promise<void>;
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch task logs
  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/projects/${projectId}/logs?taskId=${task.id}&limit=20`);
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      } finally {
        setLogsLoading(false);
      }
    }
    fetchLogs();
  }, [projectId, task.id]);

  const handleStatusChange = async (status: TaskStatus) => {
    setActionLoading(true);
    await onStatusChange(task.id, status);
    setActionLoading(false);
  };

  const handleRun = async () => {
    setActionLoading(true);
    await onRun(task);
    setActionLoading(false);
    onClose();
  };

  // Phase 96.3: Handle re-run QA with mode selection
  const handleReRunQa = async (mode: QaMode) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/run-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qaMode: mode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to run QA');
      }

      // Refresh to get updated QA status
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Failed to run QA:', err);
      alert(`خطأ في تشغيل QA: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{MODE_ICONS[task.mode] || '📌'}</span>
              <h2 className="text-lg font-bold">{task.title}</h2>
            </div>
            {phase && (
              <p className="text-sm text-white/50">📁 {phase.title}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-white/70 mb-2">الوصف</h3>
              <p className="text-sm text-white/80 bg-white/5 rounded-lg p-3">
                {task.description}
              </p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-white/50 mb-1">الحالة</div>
              <div className="font-medium">
                {task.status === 'pending' && '⏳ قيد الانتظار'}
                {task.status === 'in_progress' && '▶️ قيد التنفيذ'}
                {task.status === 'completed' && '✅ مكتملة'}
                {task.status === 'blocked' && '🚫 متوقفة'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-white/50 mb-1">الأولوية</div>
              <div className={`font-medium ${
                task.priority === 'high' ? 'text-red-400' :
                task.priority === 'low' ? 'text-gray-400' : 'text-yellow-400'
              }`}>
                {task.priority === 'high' ? '🔴 عالية' : task.priority === 'low' ? '⚪ منخفضة' : '🟡 متوسطة'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-white/50 mb-1">النوع</div>
              <div className="font-medium">{task.mode}</div>
            </div>
          </div>

          {/* Phase 96.1 + 96.3: QA Status Card with Re-run support */}
          <QaResultCard
            status={(task as any).lastQaStatus}
            summary={(task as any).lastQaSummary}
            details={(task as any).lastQaDetails}
            score={(task as any).lastQaScore}
            qaAt={(task as any).lastQaAt}
            lang="ar"
            projectId={projectId}
            taskId={task.id}
            onReRunQa={handleReRunQa}
          />

          {/* Actions */}
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-2">الإجراءات</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleStatusChange('pending')}
                disabled={actionLoading || task.status === 'pending'}
                className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                ⏳ قيد الانتظار
              </button>
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={actionLoading || task.status === 'in_progress'}
                className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                ▶️ قيد التنفيذ
              </button>
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={actionLoading || task.status === 'completed'}
                className="px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                ✅ إكمال
              </button>
              <button
                onClick={() => handleStatusChange('blocked')}
                disabled={actionLoading || task.status === 'blocked'}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                🚫 إيقاف
              </button>
              {(task.status === 'pending' || task.status === 'blocked') && (
                <button
                  onClick={handleRun}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  🤖 تشغيل تلقائي
                </button>
              )}
            </div>
          </div>

          {/* AI Logs History */}
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-2">سجل العمليات</h3>
            {logsLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-white/5 rounded-lg"></div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center text-white/30 py-6 bg-white/5 rounded-lg">
                لا توجد سجلات بعد
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logs.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    className="bg-white/5 rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/70">
                        {log.origin === 'auto-executor' && '🤖'}
                        {log.origin === 'web-ide' && '🌐'}
                        {log.origin === 'desktop-ide' && '💻'}
                        {' '}{log.mode}
                      </span>
                      <span className={`text-xs ${
                        log.status === 'success' ? 'text-green-400' :
                        log.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </div>
                    {log.userPromptPreview && (
                      <div className="text-xs text-white/40 mt-1 line-clamp-1">
                        {log.userPromptPreview}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
