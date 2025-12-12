/**
 * Phase 90.2: Plan Viewer Component
 * Displays project plan with phases and tasks
 * Shows status, progress, and allows navigation
 */

'use client';

import { Phase, Task } from '@/app/api/agent/plan-project/route';

export interface PlanViewerProps {
  phases: Phase[];
  onTaskClick?: (task: Task) => void;
}

export function PlanViewer({ phases, onTaskClick }: PlanViewerProps) {
  if (!phases || phases.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#0d0d1a] rounded-xl border border-violet-600/30">
        <p className="text-slate-400">No plan generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <div
          key={phase.id}
          className="bg-[#0d0d1a] p-6 rounded-xl border border-violet-600/30 hover:border-violet-500/50 transition-colors"
        >
          {/* Phase Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-violet-300 mb-1">
                Phase {phase.order}: {phase.title}
              </h2>
              <p className="text-sm text-slate-400">
                {phase.tasks.length} {phase.tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>

            {/* Status Badge */}
            <StatusBadge status={phase.status} />
          </div>

          {/* Tasks List */}
          <ul className="space-y-3">
            {phase.tasks.map((task) => (
              <li
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className={`
                  flex items-start gap-3 p-3 rounded-lg
                  bg-[#1a1a2e]/50 border border-slate-700/30
                  hover:border-violet-500/50 hover:bg-[#1a1a2e]
                  transition-all
                  ${onTaskClick ? 'cursor-pointer' : ''}
                `}
              >
                {/* Task Status Indicator */}
                <div className="mt-1">
                  <TaskStatusIcon status={task.status} />
                </div>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AgentBadge agent={task.agent} />
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {task.title}
                    </span>
                  </div>

                  {task.input && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {task.input}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">{task.type}</span>
                  </div>
                </div>

                {/* Task Arrow */}
                {onTaskClick && (
                  <div className="mt-1 text-slate-500 group-hover:text-violet-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status?: string }) {
  const statusConfig = {
    PENDING: { label: 'Pending', color: 'bg-slate-600/30 text-slate-300' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-600/30 text-blue-300' },
    DONE: { label: 'Done', color: 'bg-green-600/30 text-green-300' },
    FAILED: { label: 'Failed', color: 'bg-red-600/30 text-red-300' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;

  return (
    <span
      className={`
        px-3 py-1 rounded-full text-xs font-medium
        ${config.color}
      `}
    >
      {config.label}
    </span>
  );
}

// Task Status Icon Component
function TaskStatusIcon({ status }: { status?: string }) {
  if (status === 'DONE') {
    return (
      <div className="w-5 h-5 rounded-full bg-green-600/20 border border-green-500/50 flex items-center justify-center">
        <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }

  if (status === 'IN_PROGRESS') {
    return (
      <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/50 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="w-5 h-5 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center">
        <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }

  // NEW (default)
  return (
    <div className="w-5 h-5 rounded-full bg-slate-600/20 border border-slate-500/50 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-slate-400" />
    </div>
  );
}

// Agent Badge Component
function AgentBadge({ agent }: { agent: string }) {
  const agentConfig = {
    UI_AGENT: { label: 'UI', color: 'bg-purple-600/20 text-purple-300 border-purple-500/50' },
    DB_AGENT: { label: 'DB', color: 'bg-blue-600/20 text-blue-300 border-blue-500/50' },
    BACKEND_AGENT: { label: 'API', color: 'bg-green-600/20 text-green-300 border-green-500/50' },
    IDE_AGENT: { label: 'IDE', color: 'bg-orange-600/20 text-orange-300 border-orange-500/50' },
    DEPLOY_AGENT: { label: 'Deploy', color: 'bg-pink-600/20 text-pink-300 border-pink-500/50' },
  };

  const config = agentConfig[agent as keyof typeof agentConfig] || {
    label: agent,
    color: 'bg-slate-600/20 text-slate-300 border-slate-500/50',
  };

  return (
    <span
      className={`
        px-2 py-0.5 rounded text-xs font-medium border
        ${config.color}
      `}
    >
      {config.label}
    </span>
  );
}
