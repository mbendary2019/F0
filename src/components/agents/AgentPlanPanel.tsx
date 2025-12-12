// src/components/agents/AgentPlanPanel.tsx
// =============================================================================
// Phase 155.4 – AgentPlanPanel
// Real-time display of the latest TaskPlan for a project
// Uses API polling instead of Firestore direct access
// =============================================================================

'use client';

import React, { useEffect, useState, useCallback } from 'react';

// Types inline to avoid import path issues with orchestrator
type TaskStatus = 'PENDING' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
type TaskKind = 'feature' | 'bugfix' | 'refactor' | 'tests' | 'infra' | 'chore';
type ReviewDecisionType = 'APPROVE' | 'REQUEST_CHANGES' | 'ROLLBACK';
type PlanStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
type AgentRole = 'planner' | 'code' | 'test' | 'shell' | 'browser' | 'git' | 'review' | 'media' | 'audio' | 'memory' | 'conversation';

interface AgentTask {
  id: string;
  planId: string;
  label: string;
  owner: AgentRole;
  status: TaskStatus;
  dependsOn: string[];
  input: unknown;
  output?: unknown;
  error?: { message: string; code?: string; details?: unknown };
  kind?: TaskKind;
  tags?: string[];
}

interface TaskPlan {
  id: string;
  goal: string;
  createdBy: 'user' | 'agent';
  createdAt: string;
  tasks: AgentTask[];
  status?: PlanStatus;
  metadata?: {
    projectId?: string;
    inferredGoalType?: string;
    lastDecision?: ReviewDecisionType;
    [key: string]: unknown;
  };
}

type Props = {
  projectId: string;
};

const statusLabel: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

const statusColor: Record<TaskStatus, string> = {
  PENDING: 'bg-slate-700/60 text-slate-100',
  RUNNING: 'bg-blue-600/70 text-white animate-pulse',
  BLOCKED: 'bg-amber-600/80 text-white',
  COMPLETED: 'bg-emerald-600/80 text-white',
  FAILED: 'bg-rose-600/80 text-white',
  SKIPPED: 'bg-slate-500/70 text-slate-100',
};

const roleLabel: Record<AgentRole, string> = {
  planner: 'Planner',
  code: 'Code',
  test: 'Test',
  shell: 'Shell',
  browser: 'Browser',
  git: 'Git',
  review: 'Review',
  media: 'Media',
  audio: 'Audio',
  memory: 'Memory',
  conversation: 'Conversation',
};

const roleIcon: Record<AgentRole, string> = {
  planner: '📋',
  code: '💻',
  test: '🧪',
  shell: '⚡',
  browser: '🌐',
  git: '📦',
  review: '👁️',
  media: '🎨',
  audio: '🎵',
  memory: '🧠',
  conversation: '💬',
};

const decisionColor: Record<ReviewDecisionType, string> = {
  APPROVE: 'bg-emerald-600/80 text-white',
  REQUEST_CHANGES: 'bg-amber-600/80 text-white',
  ROLLBACK: 'bg-rose-700/90 text-white',
};

const decisionIcon: Record<ReviewDecisionType, string> = {
  APPROVE: '✅',
  REQUEST_CHANGES: '⚠️',
  ROLLBACK: '🚨',
};

export function AgentPlanPanel({ projectId }: Props) {
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/agents/plans?projectId=${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch plan');
      }

      setPlan(data.plan || null);
      setError(null);
    } catch (err) {
      console.error('[AgentPlanPanel] Error loading plan:', err);
      // Don't show error for normal "no plan" state
      setError(null);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPlan();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchPlan, 2000);
    return () => clearInterval(interval);
  }, [fetchPlan]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-fuchsia-500" />
          Loading agent plan...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-slate-300">No Agent Plan</span>
          <span className="text-xs">
            Start an Agent Run or Autonomy Loop to see task plans here.
          </span>
        </div>
      </div>
    );
  }

  const goalType = (plan.metadata?.inferredGoalType as string) ?? 'feature';
  const decision = plan.metadata?.lastDecision as ReviewDecisionType | undefined;
  const completedTasks = plan.tasks.filter((t) => t.status === 'COMPLETED').length;
  const progress = plan.tasks.length > 0 ? Math.round((completedTasks / plan.tasks.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 lg:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Agent Plan
            </span>
            <span className="inline-flex items-center rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">
              {goalType}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-slate-50 line-clamp-2">
            {plan.goal}
          </h2>
          <p className="text-[11px] text-slate-500 font-mono">
            {plan.id}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {plan.status && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                plan.status === 'COMPLETED'
                  ? 'bg-emerald-600/80 text-white'
                  : plan.status === 'FAILED'
                  ? 'bg-rose-600/80 text-white'
                  : 'bg-blue-600/70 text-white animate-pulse'
              }`}
            >
              {plan.status === 'IN_PROGRESS' ? 'In Progress' : plan.status}
            </span>
          )}

          {decision && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${decisionColor[decision]}`}
            >
              {decisionIcon[decision]} {decision.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Progress</span>
          <span>{completedTasks}/{plan.tasks.length} tasks ({progress}%)</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              plan.status === 'FAILED' ? 'bg-rose-500' : 'bg-fuchsia-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {plan.tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              task.status === 'RUNNING'
                ? 'bg-blue-950/40 border border-blue-800/50'
                : task.status === 'FAILED'
                ? 'bg-rose-950/30 border border-rose-800/40'
                : 'bg-slate-900/60'
            }`}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm shrink-0">
                {roleIcon[task.owner]}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-slate-50 truncate">
                  {task.label}
                </span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2 py-[1px] text-[10px] font-medium text-slate-200">
                    {roleLabel[task.owner]}
                  </span>
                  {task.kind && (
                    <span className="inline-flex items-center rounded-full bg-slate-900/90 px-2 py-[1px] text-[10px] font-medium text-slate-300">
                      {task.kind}
                    </span>
                  )}
                  {Array.isArray(task.tags) &&
                    task.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-slate-900/60 px-2 py-[1px] text-[10px] text-slate-400"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
                {task.error && (
                  <span className="mt-1 text-[10px] text-rose-400 truncate">
                    Error: {task.error.message}
                  </span>
                )}
              </div>
            </div>

            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium shrink-0 ${statusColor[task.status]}`}
            >
              {statusLabel[task.status]}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800/70 pt-3 text-[11px] text-slate-400">
        <span>
          {plan.tasks.length} tasks
          {plan.metadata?.inferredGoalType && (
            <> &middot; {String(plan.metadata.inferredGoalType)}</>
          )}
        </span>
        <span>
          {new Date(plan.createdAt).toLocaleString(undefined, {
            hour12: false,
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

console.log('[155.4][UI] AgentPlanPanel loaded');
