// src/components/agents/TaskCard.tsx
// =============================================================================
// Phase 155.3 – TaskCard Component
// Individual task card with status, progress, and actions
// =============================================================================

'use client';

import { cn } from '@/lib/utils';
import type { AgentTask, TaskStatus, AgentRole } from '@/lib/agents/federation/types';

// =============================================================================
// Types
// =============================================================================

type TaskCardProps = {
  task: AgentTask;
  isFocused?: boolean;
  locale?: 'en' | 'ar';
  onFocus?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
};

// =============================================================================
// Status Display
// =============================================================================

const STATUS_CONFIG: Record<TaskStatus, { label: string; labelAr: string; color: string; icon: string }> = {
  pending: { label: 'Pending', labelAr: 'قيد الانتظار', color: 'text-slate-400 bg-slate-500/20', icon: '⏳' },
  in_progress: { label: 'In Progress', labelAr: 'قيد التنفيذ', color: 'text-blue-400 bg-blue-500/20', icon: '🔄' },
  blocked: { label: 'Blocked', labelAr: 'محظور', color: 'text-amber-400 bg-amber-500/20', icon: '🚫' },
  completed: { label: 'Completed', labelAr: 'مكتمل', color: 'text-green-400 bg-green-500/20', icon: '✅' },
  failed: { label: 'Failed', labelAr: 'فشل', color: 'text-red-400 bg-red-500/20', icon: '❌' },
  cancelled: { label: 'Cancelled', labelAr: 'ملغى', color: 'text-gray-400 bg-gray-500/20', icon: '🚫' },
};

const ROLE_CONFIG: Record<AgentRole, { label: string; labelAr: string; color: string; icon: string }> = {
  planner: { label: 'Planner', labelAr: 'المخطط', color: 'text-purple-400', icon: '📋' },
  code: { label: 'Code', labelAr: 'البرمجة', color: 'text-blue-400', icon: '💻' },
  test: { label: 'Test', labelAr: 'الاختبار', color: 'text-green-400', icon: '🧪' },
  shell: { label: 'Shell', labelAr: 'الطرفية', color: 'text-amber-400', icon: '⚡' },
  browser: { label: 'Browser', labelAr: 'المتصفح', color: 'text-cyan-400', icon: '🌐' },
  git: { label: 'Git', labelAr: 'Git', color: 'text-orange-400', icon: '📦' },
  review: { label: 'Review', labelAr: 'المراجعة', color: 'text-pink-400', icon: '👁️' },
};

// =============================================================================
// Component
// =============================================================================

export function TaskCard({
  task,
  isFocused = false,
  locale = 'en',
  onFocus,
  onRetry,
  onCancel,
}: TaskCardProps) {
  const isArabic = locale === 'ar';
  const statusConfig = STATUS_CONFIG[task.status];
  const roleConfig = ROLE_CONFIG[task.assignedTo];

  const handleClick = () => {
    onFocus?.(task.id);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRetry?.(task.id);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.(task.id);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative p-3 rounded-lg border transition-all cursor-pointer',
        'bg-[#0a0020]/60 hover:bg-[#0a0020]/80',
        isFocused
          ? 'border-purple-500/50 ring-1 ring-purple-500/30'
          : 'border-white/10 hover:border-white/20',
        task.status === 'in_progress' && 'animate-pulse'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{roleConfig.icon}</span>
          <h4 className="text-sm font-medium text-white/90 truncate">
            {task.title}
          </h4>
        </div>

        <span className={cn(
          'flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium',
          statusConfig.color
        )}>
          {statusConfig.icon} {isArabic ? statusConfig.labelAr : statusConfig.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/50 line-clamp-2 mb-2">
        {task.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          {/* Agent badge */}
          <span className={cn('font-medium', roleConfig.color)}>
            {isArabic ? roleConfig.labelAr : roleConfig.label}
          </span>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded bg-white/5 text-white/40"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-white/30">+{task.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === 'failed' && onRetry && (
            <button
              onClick={handleRetry}
              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              {isArabic ? 'إعادة' : 'Retry'}
            </button>
          )}
          {(task.status === 'pending' || task.status === 'in_progress') && onCancel && (
            <button
              onClick={handleCancel}
              className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Dependencies indicator */}
      {task.dependencies.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-white/30">
          {isArabic
            ? `يعتمد على ${task.dependencies.length} مهمة`
            : `Depends on ${task.dependencies.length} task(s)`}
        </div>
      )}

      {/* Error message */}
      {task.error && (
        <div className="mt-2 p-2 rounded bg-red-500/10 text-red-400 text-[10px]">
          {task.error}
        </div>
      )}

      {/* Retry count */}
      {task.retryCount && task.retryCount > 0 && (
        <div className="absolute top-2 right-2 text-[9px] text-amber-400/60">
          {isArabic ? `محاولة ${task.retryCount}` : `Attempt ${task.retryCount}`}
        </div>
      )}
    </div>
  );
}

export default TaskCard;
