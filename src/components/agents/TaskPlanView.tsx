// src/components/agents/TaskPlanView.tsx
// =============================================================================
// Phase 155.3 – TaskPlanView Component
// Visualizes the complete task plan with progress and controls
// =============================================================================

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  usePlanStore,
  usePlanStats,
  usePlanProgress,
} from '@/lib/agents/federation/planStore';
import { TaskCard } from './TaskCard';
import type { AgentTask } from '@/lib/agents/federation/types';

// =============================================================================
// Types
// =============================================================================

type TaskPlanViewProps = {
  locale?: 'en' | 'ar';
  onRetryTask?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onPausePlan?: () => void;
  onResumePlan?: () => void;
  onCancelPlan?: () => void;
  className?: string;
};

// =============================================================================
// Component
// =============================================================================

export function TaskPlanView({
  locale = 'en',
  onRetryTask,
  onCancelTask,
  onPausePlan,
  onResumePlan,
  onCancelPlan,
  className,
}: TaskPlanViewProps) {
  const isArabic = locale === 'ar';

  // Store selectors
  const activePlan = usePlanStore((s) => s.activePlan);
  const focusedTaskId = usePlanStore((s) => s.focusedTaskId);
  const setFocusedTask = usePlanStore((s) => s.setFocusedTask);
  const isLoading = usePlanStore((s) => s.isLoading);
  const error = usePlanStore((s) => s.error);

  const stats = usePlanStats();
  const progress = usePlanProgress();

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    if (!activePlan) return null;

    const groups: Record<string, AgentTask[]> = {
      in_progress: [],
      pending: [],
      blocked: [],
      completed: [],
      failed: [],
      cancelled: [],
    };

    for (const task of activePlan.tasks) {
      groups[task.status]?.push(task);
    }

    return groups;
  }, [activePlan]);

  // No plan state
  if (!activePlan && !isLoading) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <div className="text-3xl mb-3 opacity-40">📋</div>
        <p className="text-sm text-white/50">
          {isArabic
            ? 'لا توجد خطة نشطة. ابدأ بطلب مهمة من الوكيل.'
            : 'No active plan. Start by requesting a task from the agent.'}
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-white/50">
          {isArabic ? 'جاري إنشاء الخطة...' : 'Creating plan...'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-[#070019]">
        {/* Plan info */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-white/90">
              {isArabic ? 'خطة المهام' : 'Task Plan'}
            </h3>
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">
              {activePlan?.userIntent}
            </p>
          </div>

          {/* Plan status badge */}
          <span className={cn(
            'text-[10px] px-2 py-1 rounded-full font-medium',
            activePlan?.status === 'executing' && 'bg-blue-500/20 text-blue-400',
            activePlan?.status === 'completed' && 'bg-green-500/20 text-green-400',
            activePlan?.status === 'failed' && 'bg-red-500/20 text-red-400',
            activePlan?.status === 'paused' && 'bg-amber-500/20 text-amber-400',
            activePlan?.status === 'planning' && 'bg-purple-500/20 text-purple-400'
          )}>
            {activePlan?.status === 'executing' && (isArabic ? 'قيد التنفيذ' : 'Executing')}
            {activePlan?.status === 'completed' && (isArabic ? 'مكتمل' : 'Completed')}
            {activePlan?.status === 'failed' && (isArabic ? 'فشل' : 'Failed')}
            {activePlan?.status === 'paused' && (isArabic ? 'متوقف' : 'Paused')}
            {activePlan?.status === 'planning' && (isArabic ? 'تخطيط' : 'Planning')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
            <span>{isArabic ? 'التقدم' : 'Progress'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-white/30">
            {stats.total} {isArabic ? 'مهمة' : 'tasks'}
          </span>
          {stats.inProgress > 0 && (
            <span className="text-blue-400">
              {stats.inProgress} {isArabic ? 'نشط' : 'active'}
            </span>
          )}
          {stats.completed > 0 && (
            <span className="text-green-400">
              {stats.completed} {isArabic ? 'مكتمل' : 'done'}
            </span>
          )}
          {stats.failed > 0 && (
            <span className="text-red-400">
              {stats.failed} {isArabic ? 'فشل' : 'failed'}
            </span>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-3 p-2 rounded bg-red-500/10 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Plan controls */}
        <div className="flex items-center gap-2 mt-3">
          {activePlan?.status === 'executing' && onPausePlan && (
            <button
              onClick={onPausePlan}
              className="px-3 py-1 text-xs rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              {isArabic ? 'إيقاف مؤقت' : 'Pause'}
            </button>
          )}
          {activePlan?.status === 'paused' && onResumePlan && (
            <button
              onClick={onResumePlan}
              className="px-3 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              {isArabic ? 'استئناف' : 'Resume'}
            </button>
          )}
          {(activePlan?.status === 'executing' || activePlan?.status === 'paused') && onCancelPlan && (
            <button
              onClick={onCancelPlan}
              className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              {isArabic ? 'إلغاء الخطة' : 'Cancel Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groupedTasks && (
          <>
            {/* In Progress */}
            {groupedTasks.in_progress.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'قيد التنفيذ' : 'In Progress'}
                </h4>
                <div className="space-y-2">
                  {groupedTasks.in_progress.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isFocused={focusedTaskId === task.id}
                      locale={locale}
                      onFocus={setFocusedTask}
                      onCancel={onCancelTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending */}
            {groupedTasks.pending.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'قيد الانتظار' : 'Pending'}
                </h4>
                <div className="space-y-2">
                  {groupedTasks.pending.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isFocused={focusedTaskId === task.id}
                      locale={locale}
                      onFocus={setFocusedTask}
                      onCancel={onCancelTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Blocked */}
            {groupedTasks.blocked.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'محظور' : 'Blocked'}
                </h4>
                <div className="space-y-2">
                  {groupedTasks.blocked.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isFocused={focusedTaskId === task.id}
                      locale={locale}
                      onFocus={setFocusedTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Failed */}
            {groupedTasks.failed.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'فشل' : 'Failed'}
                </h4>
                <div className="space-y-2">
                  {groupedTasks.failed.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isFocused={focusedTaskId === task.id}
                      locale={locale}
                      onFocus={setFocusedTask}
                      onRetry={onRetryTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {groupedTasks.completed.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-green-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'مكتمل' : 'Completed'}
                </h4>
                <div className="space-y-2">
                  {groupedTasks.completed.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isFocused={focusedTaskId === task.id}
                      locale={locale}
                      onFocus={setFocusedTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled */}
            {groupedTasks.cancelled.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'ملغى' : 'Cancelled'}
                </h4>
                <div className="space-y-2 opacity-50">
                  {groupedTasks.cancelled.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isFocused={focusedTaskId === task.id}
                      locale={locale}
                      onFocus={setFocusedTask}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default TaskPlanView;
