/**
 * Phase 92: Orchestrator Dashboard
 *
 * Real-time dashboard showing phases, tasks, and execution status
 * Features:
 * - Live phase/task updates via Firestore listeners
 * - Progress bars and status indicators
 * - Phase filtering
 * - Task feed with logs
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { TaskStatusPill } from './TaskStatusPill';
import { AgentBadge } from './AgentBadge';

interface OrchestratorDashboardProps {
  projectId: string;
  useOpsCollection?: boolean;
}

export function OrchestratorDashboard({ projectId, useOpsCollection = true }: OrchestratorDashboardProps) {
  const { phases, loading: phasesLoading } = useProjectPhases(projectId, { useOpsCollection });
  const { tasks, loading: tasksLoading } = useProjectTasks(projectId, undefined, { useOpsCollection });
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  // Calculate overall progress (supports both legacy and new status names)
  const overallProgress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) =>
      t.status === 'DONE' || t.status === 'completed'
    ).length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  // Filter tasks by selected phase
  const filteredTasks = useMemo(() => {
    if (!selectedPhaseId) return tasks;
    return tasks.filter((t) => t.phaseId === selectedPhaseId);
  }, [tasks, selectedPhaseId]);

  // Count tasks by status (supports both legacy and new status names)
  const taskStats = useMemo(() => {
    const stats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
    };
    tasks.forEach((t) => {
      // Map legacy status to new status
      const status = t.status === 'NEW' ? 'pending'
        : t.status === 'IN_PROGRESS' ? 'in_progress'
        : t.status === 'DONE' ? 'completed'
        : t.status === 'FAILED' ? 'blocked'
        : t.status;
      if (status in stats) {
        stats[status as keyof typeof stats]++;
      }
    });
    return stats;
  }, [tasks]);

  if (phasesLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading orchestrator dashboard...</div>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">No execution plan found. Generate a plan first.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-[#0d0d1a] p-6 rounded-xl border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">Overall Progress</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Completion</span>
              <span className="text-white font-medium">{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Task Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Pending</div>
              <div className="text-2xl font-bold text-gray-300">{taskStats.pending}</div>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <div className="text-xs text-blue-400 mb-1">In Progress</div>
              <div className="text-2xl font-bold text-blue-300">{taskStats.in_progress}</div>
            </div>
            <div className="bg-green-500/10 p-3 rounded-lg">
              <div className="text-xs text-green-400 mb-1">Completed</div>
              <div className="text-2xl font-bold text-green-300">{taskStats.completed}</div>
            </div>
            <div className="bg-red-500/10 p-3 rounded-lg">
              <div className="text-xs text-red-400 mb-1">Blocked</div>
              <div className="text-2xl font-bold text-red-300">{taskStats.blocked}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="bg-[#0d0d1a] p-6 rounded-xl border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">Phases</h2>
        <div className="space-y-3">
          {phases.map((phase) => {
            // Support both new (completion) and legacy (tasksCount/completedTasksCount) progress
            const phaseProgress = phase.completion !== undefined
              ? phase.completion
              : (phase.tasksCount && phase.tasksCount > 0
                  ? Math.round(((phase.completedTasksCount || 0) / phase.tasksCount) * 100)
                  : 0);

            // Support both index (new) and order (legacy)
            const phaseOrder = phase.index || phase.order || 0;

            return (
              <button
                key={phase.id}
                onClick={() =>
                  setSelectedPhaseId(selectedPhaseId === phase.id ? null : phase.id)
                }
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedPhaseId === phase.id
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        {phaseOrder}. {phase.title}
                      </span>
                      <TaskStatusPill status={phase.status as any} />
                    </div>
                    {phase.tasksCount !== undefined && (
                      <div className="text-xs text-gray-400">
                        {phase.completedTasksCount || 0} / {phase.tasksCount} tasks completed
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">{phaseProgress}%</div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${phaseProgress}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Feed */}
      <div className="bg-[#0d0d1a] p-6 rounded-xl border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {selectedPhaseId ? 'Phase Tasks' : 'All Tasks'}
          </h2>
          {selectedPhaseId && (
            <button
              onClick={() => setSelectedPhaseId(null)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Show all tasks
            </button>
          )}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No tasks found</div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{task.title}</span>
                      <AgentBadge agent={task.agent} />
                      <TaskStatusPill status={task.status} />
                    </div>
                    <div className="text-xs text-gray-400 mb-2">{task.type}</div>
                    <div className="text-sm text-gray-300">{task.input}</div>
                  </div>
                </div>

                {/* Logs */}
                {task.logs && task.logs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">Logs:</div>
                    <div className="space-y-1">
                      {task.logs.slice(-3).map((log, idx) => (
                        <div key={idx} className="text-xs text-gray-500 font-mono">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Output Preview */}
                {task.output && task.status === 'DONE' && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">Output:</div>
                    <div className="text-xs text-green-400 font-mono bg-green-500/5 p-2 rounded">
                      {task.output.summary || 'Task completed successfully'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
