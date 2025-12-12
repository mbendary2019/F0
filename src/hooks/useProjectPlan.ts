/**
 * Phase 93.5: useProjectPlan Hook
 * Fetches project plan (phases + tasks) from API
 * with optional real-time polling
 */

import { useState, useEffect, useCallback } from 'react';
import type { PhaseDoc, TaskDoc } from '@/lib/server/projectPlan';

export interface ProjectProgress {
  totalPhases: number;
  completedPhases: number;
  totalTasks: number;
  completedTasks: number;
  overallCompletion: number;
}

interface UseProjectPlanReturn {
  phases: PhaseDoc[];
  tasks: TaskDoc[];
  tasksByPhase: Record<string, TaskDoc[]>;
  progress: ProjectProgress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskDoc['status']) => Promise<void>;
}

export function useProjectPlan(
  projectId: string | undefined,
  options: {
    pollInterval?: number; // ms, 0 = disabled
    includeProgress?: boolean;
  } = {}
): UseProjectPlanReturn {
  const { pollInterval = 0, includeProgress = true } = options;

  const [phases, setPhases] = useState<PhaseDoc[]>([]);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch plan data
  const fetchPlan = useCallback(async () => {
    if (!projectId) return;

    try {
      const params = new URLSearchParams();
      if (includeProgress) params.set('progress', 'true');

      const res = await fetch(`/api/projects/${projectId}/plan?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch plan');
      }

      setPhases(data.phases || []);
      setTasks(data.tasks || []);
      if (data.progress) {
        setProgress(data.progress);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, includeProgress]);

  // Initial fetch
  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Polling
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;

    const interval = setInterval(fetchPlan, pollInterval);
    return () => clearInterval(interval);
  }, [fetchPlan, pollInterval]);

  // Group tasks by phase
  const tasksByPhase: Record<string, TaskDoc[]> = {};
  for (const task of tasks) {
    if (!tasksByPhase[task.phaseId]) {
      tasksByPhase[task.phaseId] = [];
    }
    tasksByPhase[task.phaseId].push(task);
  }

  // Sort tasks by priority within each phase
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  for (const phaseId of Object.keys(tasksByPhase)) {
    tasksByPhase[phaseId].sort((a, b) => {
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    });
  }

  // Update task status
  const updateTaskStatus = useCallback(async (taskId: string, status: TaskDoc['status']) => {
    if (!projectId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update task');
      }

      // Update local state
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t))
      );

      if (data.progress) {
        setProgress(data.progress);
      }

      // Also update phase completion locally
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setPhases((prev) =>
          prev.map((p) => {
            if (p.id === task.phaseId) {
              const phaseTasks = tasks.filter((t) => t.phaseId === p.id);
              const completed = phaseTasks.filter(
                (t) => (t.id === taskId ? status : t.status) === 'completed'
              ).length;
              const completion = Math.round((completed / phaseTasks.length) * 100);
              return {
                ...p,
                completion,
                status: completion === 100 ? 'completed' : (completion > 0 ? 'active' : p.status),
              };
            }
            return p;
          })
        );
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, tasks]);

  return {
    phases,
    tasks,
    tasksByPhase,
    progress,
    loading,
    error,
    refresh: fetchPlan,
    updateTaskStatus,
  };
}

/**
 * Get next pending task for auto-execution
 */
export async function getNextPendingTask(projectId: string): Promise<TaskDoc | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/plan?next=true`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to get next task');
    }

    return data.nextTask || null;
  } catch (err) {
    console.error('[getNextPendingTask] Error:', err);
    return null;
  }
}
