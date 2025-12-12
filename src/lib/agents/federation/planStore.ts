// src/lib/agents/federation/planStore.ts
// =============================================================================
// Phase 155.3 – PlanStore (Zustand)
// Reactive store for task plans with real-time updates
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TaskPlan, AgentTask, TaskStatus, AgentMessage } from './types';
import { TaskGraph } from './taskGraph';
import { getAgentBus } from './bus';

// =============================================================================
// Store Types
// =============================================================================

export type PlanStoreState = {
  /** Current active plan */
  activePlan: TaskPlan | null;

  /** Task graph for the active plan */
  activeGraph: TaskGraph | null;

  /** All plans by ID */
  plans: Map<string, TaskPlan>;

  /** Currently focused task ID */
  focusedTaskId: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Message history */
  messages: AgentMessage[];
};

export type PlanStoreActions = {
  /** Set the active plan */
  setActivePlan: (plan: TaskPlan | null) => void;

  /** Update a plan */
  updatePlan: (plan: TaskPlan) => void;

  /** Update task status */
  updateTaskStatus: (taskId: string, status: TaskStatus, result?: unknown, error?: string) => void;

  /** Add a task to the active plan */
  addTask: (task: Omit<AgentTask, 'id' | 'status'>) => void;

  /** Remove a task from the active plan */
  removeTask: (taskId: string) => void;

  /** Set focused task */
  setFocusedTask: (taskId: string | null) => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error */
  setError: (error: string | null) => void;

  /** Add message to history */
  addMessage: (message: AgentMessage) => void;

  /** Clear messages */
  clearMessages: () => void;

  /** Reset store */
  reset: () => void;

  /** Start listening to bus messages */
  startListening: () => () => void;
};

export type PlanStore = PlanStoreState & PlanStoreActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: PlanStoreState = {
  activePlan: null,
  activeGraph: null,
  plans: new Map(),
  focusedTaskId: null,
  isLoading: false,
  error: null,
  messages: [],
};

// =============================================================================
// Store Implementation
// =============================================================================

export const usePlanStore = create<PlanStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setActivePlan: (plan) => {
      console.log('[155.3][AGENTS][STORE] Setting active plan:', plan?.id);

      set({
        activePlan: plan,
        activeGraph: plan ? new TaskGraph(plan) : null,
        focusedTaskId: null,
      });

      // Add to plans map
      if (plan) {
        const plans = new Map(get().plans);
        plans.set(plan.id, plan);
        set({ plans });
      }
    },

    updatePlan: (plan) => {
      console.log('[155.3][AGENTS][STORE] Updating plan:', plan.id);

      const plans = new Map<string, TaskPlan>(get().plans);
      plans.set(plan.id, plan);

      const state: Partial<PlanStoreState> = { plans };

      // Update active plan if it's the same
      if (get().activePlan?.id === plan.id) {
        state.activePlan = plan;
        state.activeGraph = new TaskGraph(plan);
      }

      set(state);
    },

    updateTaskStatus: (taskId, status, result, error) => {
      console.log('[155.3][AGENTS][STORE] Updating task status:', { taskId, status });

      const graph = get().activeGraph;
      if (!graph) return;

      graph.updateTaskStatus(taskId, status, result, error);

      // Trigger re-render with updated plan
      set({
        activePlan: graph.getPlan(),
      });
    },

    addTask: (task) => {
      const graph = get().activeGraph;
      if (!graph) {
        console.warn('[155.3][AGENTS][STORE] No active plan to add task to');
        return;
      }

      const newTask = graph.addTask(task);
      console.log('[155.3][AGENTS][STORE] Task added:', newTask.id);

      set({
        activePlan: graph.getPlan(),
      });
    },

    removeTask: (taskId) => {
      const graph = get().activeGraph;
      if (!graph) return;

      const removed = graph.removeTask(taskId);
      if (removed) {
        console.log('[155.3][AGENTS][STORE] Task removed:', taskId);
        set({
          activePlan: graph.getPlan(),
          focusedTaskId: get().focusedTaskId === taskId ? null : get().focusedTaskId,
        });
      }
    },

    setFocusedTask: (taskId) => {
      set({ focusedTaskId: taskId });
    },

    setLoading: (isLoading) => {
      set({ isLoading });
    },

    setError: (error) => {
      set({ error });
    },

    addMessage: (message) => {
      set((state) => ({
        messages: [...state.messages, message].slice(-100), // Keep last 100 messages
      }));
    },

    clearMessages: () => {
      set({ messages: [] });
    },

    reset: () => {
      console.log('[155.3][AGENTS][STORE] Resetting store');
      set(initialState);
    },

    startListening: () => {
      const bus = getAgentBus();

      // Subscribe to all messages (broadcast to planner to intercept all)
      const unsub = bus.subscribe('planner', (message) => {
        get().addMessage(message);

        // Handle specific message types
        switch (message.kind) {
          case 'plan_result': {
            const payload = message.payload as { plan: TaskPlan };
            get().setActivePlan(payload.plan);
            get().setLoading(false);
            break;
          }

          case 'task_result': {
            const payload = message.payload as {
              taskId: string;
              status: 'completed' | 'failed';
              result?: unknown;
              error?: string;
            };
            get().updateTaskStatus(
              payload.taskId,
              payload.status,
              payload.result,
              payload.error
            );
            break;
          }

          case 'status_update': {
            const payload = message.payload as { taskId?: string; progress?: number };
            if (payload.taskId) {
              get().setFocusedTask(payload.taskId);
            }
            break;
          }

          case 'error': {
            const payload = message.payload as { message: string; taskId?: string };
            get().setError(payload.message);
            if (payload.taskId) {
              get().updateTaskStatus(payload.taskId, 'failed', undefined, payload.message);
            }
            break;
          }
        }
      });

      console.log('[155.3][AGENTS][STORE] Started listening to bus');
      return unsub;
    },
  }))
);

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get tasks by status
 */
export function useTasksByStatus(status: TaskStatus): AgentTask[] {
  return usePlanStore((state) =>
    state.activePlan?.tasks.filter((t) => t.status === status) ?? []
  );
}

/**
 * Get ready tasks (dependencies satisfied)
 */
export function useReadyTasks(): AgentTask[] {
  return usePlanStore((state) =>
    state.activeGraph?.getReadyTasks() ?? []
  );
}

/**
 * Get plan progress
 */
export function usePlanProgress(): number {
  return usePlanStore((state) =>
    state.activeGraph?.getProgress() ?? 0
  );
}

/**
 * Get plan stats
 */
export function usePlanStats() {
  return usePlanStore((state) =>
    state.activeGraph?.getStats() ?? {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      cancelled: 0,
      progress: 0,
    }
  );
}

/**
 * Get focused task
 */
export function useFocusedTask(): AgentTask | null {
  return usePlanStore((state) => {
    if (!state.focusedTaskId || !state.activeGraph) return null;
    return state.activeGraph.getTask(state.focusedTaskId) ?? null;
  });
}

console.log('[155.3][AGENTS][STORE] PlanStore module loaded');
