'use client';

/**
 * Phase 104 + 93.5: Continue with Agent - Workspace Page
 * Left: Phases + Tasks (from Firestore or ops_projects API)
 * Right: Agent Chat
 *
 * Phase 93.5: Supports both collections:
 * - projects/{id}/phases (client Firestore listener - legacy)
 * - ops_projects/{id}/phases (API - new)
 *
 * Phase 98.3: Template Kickoff Banner
 * - Shows banner when project is created from a template
 * - Agent proposes plan and user can confirm or customize
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseClient';
import type { F0Phase, F0Task } from '@/types/project';
import AgentChatPanel from '@/components/f0/AgentChatPanel';
import DevicePreviewPane from '@/components/f0/ide/DevicePreviewPane';
import { useProjectPlan } from '@/hooks/useProjectPlan';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { QaStatusBadge } from '@/components/f0/orchestrator/QaStatusBadge';

// Phase 98.3: Template Kickoff Types
interface TemplateKickoffState {
  hasTemplate: boolean;
  templateSlug: string | null;
  templateTitle: string | null;
  kickoff: {
    done: boolean;
    doneAt: number | null;
  };
}

export default function ContinueWithAgentPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = params.locale as string;

  const [phases, setPhases] = useState<F0Phase[]>([]);
  const [tasks, setTasks] = useState<Record<string, F0Task[]>>({});
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('mvp');
  const [activeTask, setActiveTask] = useState<F0Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [autoExecuting, setAutoExecuting] = useState(false);
  const [autoExecuteError, setAutoExecuteError] = useState<string | null>(null);

  // Phase 96.3: QA state
  const [qaRunning, setQaRunning] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaSuccess, setQaSuccess] = useState(false);

  // Phase 97.1: Right panel mode (chat or preview)
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'preview'>('chat');

  // Phase 93.5: Toggle between legacy (projects) and new (ops_projects) collections
  const [useOpsCollection, setUseOpsCollection] = useState(false);

  // Phase 98.3: Template Kickoff State
  const [templateState, setTemplateState] = useState<TemplateKickoffState | null>(null);
  const [confirmingKickoff, setConfirmingKickoff] = useState(false);

  // Phase 98.3.1: Pending prompt for agent chat (for plan generation or customization)
  const [pendingKickoffPrompt, setPendingKickoffPrompt] = useState<string | null>(null);

  // Phase 97.1: Get project details for preview URL
  const { project } = useProjectDetails(projectId);

  // Phase 93.5: Use ops_projects API when toggle is enabled
  const {
    phases: opsPhases,
    tasksByPhase: opsTasksByPhase,
    progress: opsProgress,
    loading: opsLoading,
    error: opsError,
    refresh: refreshOpsPlan,
    updateTaskStatus: updateOpsTaskStatus,
  } = useProjectPlan(useOpsCollection ? projectId : undefined, {
    pollInterval: 10000, // Refresh every 10 seconds
    includeProgress: true,
  });

  // Real-time listener for phases (legacy collection)
  useEffect(() => {
    if (!projectId) return;

    const phasesRef = collection(db, 'projects', projectId, 'phases');
    const q = query(phasesRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const phasesData: F0Phase[] = [];
      snapshot.forEach((doc) => {
        phasesData.push(doc.data() as F0Phase);
      });
      setPhases(phasesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Real-time listener for tasks
  useEffect(() => {
    if (!projectId) return;

    const tasksRef = collection(db, 'projects', projectId, 'tasks');

    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const tasksByPhase: Record<string, F0Task[]> = {};

      snapshot.forEach((doc) => {
        const task = doc.data() as F0Task;
        if (!tasksByPhase[task.phaseId]) {
          tasksByPhase[task.phaseId] = [];
        }
        tasksByPhase[task.phaseId].push(task);
      });

      setTasks(tasksByPhase);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Phase 98.3: Load template kickoff state
  useEffect(() => {
    if (!projectId) return;

    const loadTemplateState = async () => {
      try {
        console.log('[Continue] Loading template state for project:', projectId);
        const res = await fetch(`/api/projects/${projectId}/template/kickoff`);
        console.log('[Continue] Template API response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('[Continue] Template API data:', data);
          if (data.ok && data.hasTemplate) {
            console.log('[Continue] Setting template state - hasTemplate:', data.hasTemplate, 'kickoff.done:', data.kickoff?.done);
            setTemplateState({
              hasTemplate: true,
              templateSlug: data.templateSlug,
              templateTitle: data.templateTitle,
              kickoff: {
                done: data.kickoff?.done ?? false,
                doneAt: data.kickoff?.doneAt ?? null,
              },
            });
          } else {
            console.log('[Continue] Template state NOT set - ok:', data.ok, 'hasTemplate:', data.hasTemplate);
          }
        }
      } catch (err) {
        console.error('[Continue] Error loading template state:', err);
      }
    };

    loadTemplateState();
  }, [projectId]);

  // Phase 98.3: Confirm template kickoff plan
  // Phase 98.3.1: Now also triggers Agent API to generate the plan
  const handleConfirmKickoffPlan = async () => {
    if (!projectId) return;

    setConfirmingKickoff(true);
    try {
      // Step 1: Mark kickoff as confirmed
      const res = await fetch(`/api/projects/${projectId}/template/kickoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_plan' }),
      });

      if (res.ok) {
        setTemplateState((prev) =>
          prev ? { ...prev, kickoff: { done: true, doneAt: Date.now() } } : prev
        );

        // Step 2: Trigger Agent to generate the plan with phases AND tasks
        const planPrompt = locale === 'ar'
          ? `عايزك تولّد خطة تنفيذ كاملة للمشروع بناءً على الـ template المختار "${templateState?.templateTitle || templateState?.templateSlug}".

مهم جداً: الخطة لازم تشمل الاتنين:

1. **Phases (مراحل)** - على الأقل 3-4 مراحل، كل مرحلة ليها:
   - id (مثل: "mvp", "phase-2", etc)
   - title
   - status: "pending"

2. **Tasks (مهام)** - كل phase لازم يكون فيها 3-5 tasks على الأقل، كل task ليها:
   - id
   - phaseId (يطابق id الـ phase)
   - title
   - description
   - priority: "low" | "medium" | "high" | "critical"
   - status: "pending"

رجّع الخطة في F0_JSON format مع "phases" array و "tasks" array.

مثال على الـ format المطلوب:
[F0_JSON]
{
  "projectId": "${projectId}",
  "phases": [
    {"id": "mvp", "title": "MVP Phase", "status": "pending", "order": 0}
  ],
  "tasks": [
    {"id": "task-1", "phaseId": "mvp", "title": "Setup project", "description": "...", "priority": "high", "status": "pending"}
  ]
}
[/F0_JSON]`
          : `Generate a complete execution plan for this project based on the selected template "${templateState?.templateTitle || templateState?.templateSlug}".

IMPORTANT: The plan MUST include BOTH:

1. **Phases** - At least 3-4 phases, each with:
   - id (e.g., "mvp", "phase-2", etc)
   - title
   - status: "pending"

2. **Tasks** - Each phase MUST have 3-5 tasks minimum, each task with:
   - id
   - phaseId (matching the phase id)
   - title
   - description
   - priority: "low" | "medium" | "high" | "critical"
   - status: "pending"

Return the plan in F0_JSON format with both "phases" array AND "tasks" array.

Example format:
[F0_JSON]
{
  "projectId": "${projectId}",
  "phases": [
    {"id": "mvp", "title": "MVP Phase", "status": "pending", "order": 0}
  ],
  "tasks": [
    {"id": "task-1", "phaseId": "mvp", "title": "Setup project", "description": "...", "priority": "high", "status": "pending"}
  ]
}
[/F0_JSON]`;

        // Set the pending prompt - AgentChatPanel will pick it up
        setPendingKickoffPrompt(planPrompt);
      }
    } catch (err) {
      console.error('[Continue] Error confirming kickoff:', err);
    } finally {
      setConfirmingKickoff(false);
    }
  };

  // Phase 98.3.1: Customize plan - pre-fill agent chat with customization prompt
  const handleCustomizePlan = () => {
    const customizePrompt = locale === 'ar'
      ? `عايز أعدل خطة التنفيذ للمشروع المبني على template "${templateState?.templateTitle || templateState?.templateSlug}".

التعديلات اللي عايزها:
- [اكتب التعديلات هنا]

رجّع الخطة المعدلة في F0_JSON format.`
      : `I want to customize the execution plan for this project based on template "${templateState?.templateTitle || templateState?.templateSlug}".

My customizations:
- [write your changes here]

Return the modified plan in F0_JSON format.`;

    setPendingKickoffPrompt(customizePrompt);
  };

  // Phase 93.5: Select which data source to use
  const activePhases = useOpsCollection
    ? opsPhases.map((p) => ({
        id: p.id,
        title: p.title,
        goals: [],
        features: [],
        order: p.index,
        status: p.status as F0Phase['status'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
    : phases;

  const activeTasks = useOpsCollection
    ? Object.fromEntries(
        Object.entries(opsTasksByPhase).map(([phaseId, tasks]) => [
          phaseId,
          tasks.map((t) => ({
            id: t.id,
            phaseId: t.phaseId,
            title: t.title,
            description: t.description,
            status: t.status as F0Task['status'],
            priority: t.priority as F0Task['priority'],
            estimatedEffort: (t.difficulty === 'high' ? 'large' : t.difficulty === 'low' ? 'small' : 'medium') as F0Task['estimatedEffort'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })),
        ])
      )
    : tasks;

  const isLoading = useOpsCollection ? opsLoading : loading;

  // Calculate phase progress
  const getPhaseProgress = (phaseId: string): number => {
    if (useOpsCollection) {
      const phase = opsPhases.find((p) => p.id === phaseId);
      return phase?.completion ?? 0;
    }

    const phaseTasks = tasks[phaseId] || [];
    if (phaseTasks.length === 0) return 0;

    const completedTasks = phaseTasks.filter((t) => t.status === 'completed').length;
    return Math.round((completedTasks / phaseTasks.length) * 100);
  };

  // Status badge color
  const getStatusColor = (status: F0Task['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'in_progress':
        return 'text-yellow-400';
      case 'blocked':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusLabel = (status: F0Task['status']) => {
    const labels: Record<F0Task['status'], string> = {
      pending: locale === 'ar' ? 'معلق' : 'Pending',
      in_progress: locale === 'ar' ? 'جاري التنفيذ' : 'In Progress',
      completed: locale === 'ar' ? 'مكتمل' : 'Completed',
      blocked: locale === 'ar' ? 'متوقف' : 'Blocked',
    };
    return labels[status];
  };

  // Toggle task status: Pending → In Progress → Completed → Pending
  const handleToggleTaskStatus = async (task: F0Task) => {
    const newStatus =
      task.status === 'pending'
        ? 'in_progress'
        : task.status === 'in_progress'
        ? 'completed'
        : task.status === 'completed'
        ? 'pending'
        : 'pending';

    try {
      await updateDoc(
        doc(db, 'projects', projectId, 'tasks', task.id),
        { status: newStatus }
      );
      console.log(`Task ${task.id} status changed to ${newStatus}`);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Phase 87.1: Ask Code Agent to implement this task
  const handleRunTaskWithAgent = async (task: F0Task) => {
    setRunError(null);
    setRunningTaskId(task.id);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();

      const res = await fetch('/api/f0/code-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          taskId: task.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to run code agent');
      }

      console.log('[Code Agent] Task execution started:', data);
      // Firestore listeners will update the UI automatically
    } catch (error) {
      console.error('[Code Agent] Error running task:', error);
      setRunError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setRunningTaskId(null);
    }
  };

  // Phase 87.2+: Streaming Code Agent execution
  const handleRunTaskWithAgentStreaming = async (task: F0Task) => {
    setRunError(null);
    setRunningTaskId(task.id);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();

      const res = await fetch('/api/f0/code-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          taskId: task.id,
          stream: true, // Enable streaming
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to start streaming');
      }

      if (!res.body) {
        throw new Error('No response body');
      }

      // Read the stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[Code Agent Streaming] Stream ended');
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (lines ending with \n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6); // Remove "data: " prefix
              const data = JSON.parse(jsonStr);

              if (data.chunk) {
                // Emit chunk event for chat panel to display
                window.dispatchEvent(new CustomEvent('code-agent-stream-chunk', {
                  detail: { chunk: data.chunk, taskId: task.id }
                }));
              } else if (data.done) {
                console.log('[Code Agent Streaming] Completed:', data);
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error('[Code Agent Streaming] Parse error:', parseError);
            }
          }
        }
      }

      console.log('[Code Agent Streaming] Task execution completed');
      // Firestore listeners will update the UI automatically
    } catch (error) {
      console.error('[Code Agent Streaming] Error:', error);
      setRunError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setRunningTaskId(null);
    }
  };

  // Phase 87.2: Auto-execute next pending task in queue
  const handleAutoExecuteQueue = async () => {
    setAutoExecuteError(null);
    setAutoExecuting(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();

      const res = await fetch('/api/f0/auto-execute-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to auto-execute queue');
      }

      console.log('[Auto Execute Queue] Result:', data);

      if (!data.executed) {
        setAutoExecuteError(locale === 'ar' ? 'لا توجد مهام معلقة في القائمة' : 'No pending tasks in queue');
      }
      // Firestore listeners will update the UI automatically
    } catch (error) {
      console.error('[Auto Execute Queue] Error:', error);
      setAutoExecuteError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setAutoExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-white text-lg">
          {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Phase 98.3: Template Kickoff Banner */}
      {templateState?.hasTemplate && !templateState.kickoff.done && (
        <div className="bg-gradient-to-r from-violet-900/60 to-purple-900/60 border-b border-violet-500/30 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <div className="text-white font-medium text-sm">
                  {locale === 'ar'
                    ? `تم إنشاء المشروع من قالب: ${templateState.templateTitle || templateState.templateSlug}`
                    : `Project created from template: ${templateState.templateTitle || templateState.templateSlug}`}
                </div>
                <div className="text-violet-200/70 text-xs mt-0.5">
                  {locale === 'ar'
                    ? 'الوكيل سيقترح خطة تنفيذ. يمكنك تأكيدها أو تعديلها.'
                    : 'The agent will propose an execution plan. You can confirm or customize it.'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmKickoffPlan}
                disabled={confirmingKickoff}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  confirmingKickoff
                    ? 'bg-gray-500/30 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500/30 text-green-300 hover:bg-green-500/40 border border-green-500/50'
                }`}
              >
                {confirmingKickoff
                  ? (locale === 'ar' ? '⏳ جاري التأكيد...' : '⏳ Confirming...')
                  : (locale === 'ar' ? '✅ ابدأ تنفيذ الخطة' : '✅ Start executing plan')}
              </button>
              <button
                onClick={handleCustomizePlan}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/30 text-violet-200 hover:bg-violet-500/40 border border-violet-500/50 transition"
              >
                {locale === 'ar' ? '✏️ عدل الخطة' : '✏️ Customize plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0c0121]/80 border-b border-[#2c1466] flex-shrink-0">
        <div className="flex items-center gap-3 text-sm text-white/80">
          <span>🚀</span>
          <span className="font-medium">{locale === 'ar' ? 'استمرار العمل' : 'Continue Working'}</span>
          <span className="text-xs text-white/40 truncate max-w-[200px]">ID: {projectId}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Collection Toggle */}
          <div className="flex items-center gap-1 bg-[#1a0d3c] rounded-lg p-1">
            <button
              onClick={() => setUseOpsCollection(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                !useOpsCollection
                  ? 'bg-purple-500/40 text-purple-200 shadow-sm'
                  : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-300'
              }`}
              title="Legacy Projects Collection"
            >
              📁 <span className="hidden sm:inline">Projects</span>
            </button>
            <button
              onClick={() => setUseOpsCollection(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                useOpsCollection
                  ? 'bg-blue-500/40 text-blue-200 shadow-sm'
                  : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-300'
              }`}
              title="Ops Projects Collection (API)"
            >
              🗄️ <span className="hidden sm:inline">Ops Projects</span>
            </button>
          </div>

          {/* Auto Execute Queue Button */}
          <button
            onClick={handleAutoExecuteQueue}
            disabled={autoExecuting}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              autoExecuting
                ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300'
            }`}
            title="Run all queued tasks"
          >
            {autoExecuting ? '⏳' : '⚡'} <span className="hidden sm:inline">{autoExecuting ? (locale === 'ar' ? 'جاري التنفيذ...' : 'Running...') : (locale === 'ar' ? 'تشغيل المهام' : 'Run Queued')}</span>
          </button>
          {autoExecuteError && (
            <span className="text-xs text-red-400 max-w-[150px] truncate">{autoExecuteError}</span>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-row flex-1 min-h-0 w-full gap-2 p-2 overflow-hidden">
        {/* LEFT PANEL - Phases */}
        <div className="w-1/4 bg-[#0c0121] border border-[#2c1466] rounded-2xl p-4 flex flex-col min-h-0 overflow-hidden">
          {/* PHASES */}
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-3 flex-shrink-0">
              📘 {locale === 'ar' ? 'مراحل المشروع' : 'Project Phases'}
            </h2>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {activePhases.length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-8">
                  {locale === 'ar'
                    ? 'لا توجد مراحل بعد. ابدأ محادثة مع الوكيل!'
                    : 'No phases yet. Start a conversation with the agent!'}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                {activePhases.map((phase) => {
                  const progress = getPhaseProgress(phase.id);
                  const isSelected = selectedPhaseId === phase.id;

                  return (
                    <div
                      key={phase.id}
                      className={`p-3 rounded-xl cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#1b0d3f] border-2 border-[#7b5cff]'
                          : 'bg-[#140a2e] hover:bg-[#1b0d3f]'
                      }`}
                      onClick={() => setSelectedPhaseId(phase.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-white text-sm font-semibold">
                          {phase.title}
                        </div>
                        <div
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            phase.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : phase.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {phase.status === 'active'
                            ? locale === 'ar'
                              ? 'نشط'
                              : 'Active'
                            : phase.status === 'completed'
                            ? locale === 'ar'
                              ? 'مكتمل'
                              : 'Done'
                            : locale === 'ar'
                            ? 'معلق'
                            : 'Pending'}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 bg-[#2e1a57] rounded-full">
                        <div
                          className="h-full bg-[#7b5cff] rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>

                      <div className="text-xs text-gray-400 mt-1">
                        {progress}% {locale === 'ar' ? 'مكتمل' : 'complete'}
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE PANEL - Tasks */}
        <div className="w-1/4 bg-[#0c0121] border border-[#2c1466] rounded-2xl p-4 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-3 flex-shrink-0">
            📝 {locale === 'ar' ? 'المهام' : 'Tasks'}
          </h2>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {!activeTasks[selectedPhaseId] || activeTasks[selectedPhaseId].length === 0 ? (
              <div className="text-gray-400 text-sm text-center py-8">
                {locale === 'ar'
                  ? 'لا توجد مهام لهذه المرحلة'
                  : 'No tasks for this phase'}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {activeTasks[selectedPhaseId].map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl transition cursor-pointer ${
                        activeTask?.id === task.id
                          ? 'bg-[#1b0d3f] border-2 border-[#7b5cff]'
                          : 'bg-[#140a2e] hover:bg-[#1b0d3f]'
                      }`}
                      onClick={() => {
                        setActiveTask(task);
                      }}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="text-white text-sm font-medium flex-1">
                          {task.title}
                        </div>
                        <div
                          className={`text-xs font-semibold ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {getStatusLabel(task.status)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            task.priority === 'critical'
                              ? 'bg-red-500/20 text-red-400'
                              : task.priority === 'high'
                              ? 'bg-orange-500/20 text-orange-400'
                              : task.priority === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span>{task.estimatedEffort}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Task Details Panel */}
                {activeTask && (
                  <div className="mt-3 p-3 rounded-xl bg-[#1b0d3f] border border-[#7b5cff]/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-white">
                        {locale === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTask(null);
                        }}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="text-xs text-white font-medium mb-2">
                      {activeTask.title}
                    </div>

                    {activeTask.description && (
                      <div className="text-xs text-gray-300 mb-2">
                        {activeTask.description}
                      </div>
                    )}

                    <div className="flex gap-2 items-center text-[11px] flex-wrap mb-3">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          activeTask.priority === 'critical'
                            ? 'bg-red-500/20 text-red-400'
                            : activeTask.priority === 'high'
                            ? 'bg-orange-500/20 text-orange-400'
                            : activeTask.priority === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {activeTask.priority}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300">{activeTask.estimatedEffort}</span>
                    </div>

                    {/* Status Selector */}
                    <div className="mb-2">
                      <div className="text-[10px] text-gray-400 mb-1">
                        {locale === 'ar' ? 'الحالة:' : 'Status:'}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {(['pending', 'in_progress', 'completed', 'blocked'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDoc(
                                doc(db, 'projects', projectId, 'tasks', activeTask.id),
                                { status }
                              );
                            }}
                            className={`px-2 py-1 rounded text-[10px] transition ${
                              activeTask.status === status
                                ? status === 'completed'
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                  : status === 'in_progress'
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                  : status === 'blocked'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                                : 'bg-[#0c0121] text-gray-500 border border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {getStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Phase 87.1+: Code Agent Buttons */}
                    <div className="mt-3 pt-3 border-t border-[#2c1466] space-y-2">
                      {/* Streaming Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunTaskWithAgentStreaming(activeTask);
                        }}
                        disabled={runningTaskId === activeTask.id}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          runningTaskId === activeTask.id
                            ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/30'
                        }`}
                      >
                        {runningTaskId === activeTask.id ? (
                          <>
                            {locale === 'ar'
                              ? '⏳ جاري تنفيذ المهمة مع streaming...'
                              : '⏳ Streaming task execution...'}
                          </>
                        ) : (
                          <>
                            ⚡{' '}
                            {locale === 'ar'
                              ? 'تنفيذ مع streaming (مثل Cursor)'
                              : 'Execute with streaming (like Cursor)'}
                          </>
                        )}
                      </button>

                      {/* Original non-streaming button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunTaskWithAgent(activeTask);
                        }}
                        disabled={runningTaskId === activeTask.id}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          runningTaskId === activeTask.id
                            ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 shadow-lg shadow-gray-500/20'
                        }`}
                      >
                        {runningTaskId === activeTask.id ? (
                          <>
                            {locale === 'ar'
                              ? '⏳ جاري تنفيذ المهمة...'
                              : '⏳ Running task...'}
                          </>
                        ) : (
                          <>
                            🤖{' '}
                            {locale === 'ar'
                              ? 'تنفيذ عادي (بدون streaming)'
                              : 'Normal execution (no streaming)'}
                          </>
                        )}
                      </button>

                      {runError && (
                        <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded">
                          {locale === 'ar' ? 'خطأ:' : 'Error:'} {runError}
                        </div>
                      )}
                    </div>

                    {/* Phase 96.3: QA Report Section */}
                    <div className="mt-3 pt-3 border-t border-[#2c1466]">
                      <div className="rounded-xl border border-[#2c1466] bg-[#050020] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-violet-100">
                            {locale === 'ar' ? 'تقرير QA' : 'QA Report'}
                          </span>
                          <QaStatusBadge
                            status={(activeTask as any).lastQaStatus ?? 'not_run'}
                            lang={locale as 'ar' | 'en'}
                          />
                        </div>

                        <p className="text-[11px] text-violet-200/80 whitespace-pre-line mb-2">
                          {(activeTask as any).lastQaSummary ||
                            (locale === 'ar'
                              ? 'لم يتم تشغيل فحص الـ QA بعد.'
                              : 'QA check has not been run yet.')}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!projectId || !activeTask?.id) return;

                              setQaRunning(true);
                              setQaError(null);
                              setQaSuccess(false);

                              try {
                                const user = auth.currentUser;
                                const token = user ? await user.getIdToken() : null;

                                const res = await fetch(
                                  `/api/projects/${projectId}/tasks/${activeTask.id}/run-tests`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                    },
                                    body: JSON.stringify({ qaMode: 'both' }),
                                  }
                                );

                                const data = await res.json();

                                if (!res.ok) {
                                  throw new Error(data.error || 'Failed to run QA');
                                }

                                console.log('[QA] Re-run triggered for task:', activeTask.id, data);
                                setQaSuccess(true);

                                // Auto-hide success after 3 seconds
                                setTimeout(() => setQaSuccess(false), 3000);
                              } catch (err: any) {
                                console.error('[QA] Error running QA:', err);
                                setQaError(err.message || 'Unknown error');
                              } finally {
                                setQaRunning(false);
                              }
                            }}
                            disabled={qaRunning}
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium text-white transition flex items-center gap-1 ${
                              qaRunning
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-violet-700 hover:bg-violet-600'
                            }`}
                          >
                            {qaRunning ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                {locale === 'ar' ? 'جاري الفحص...' : 'Running...'}
                              </>
                            ) : (
                              <>
                                🔁 {locale === 'ar' ? 'إعادة فحص QA' : 'Re-run QA'}
                              </>
                            )}
                          </button>

                          {typeof (activeTask as any).lastQaScore === 'number' && (
                            <span className={`text-[11px] font-medium ${
                              (activeTask as any).lastQaScore >= 80
                                ? 'text-green-400'
                                : (activeTask as any).lastQaScore >= 50
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                            }`}>
                              Score: {(activeTask as any).lastQaScore}/100
                            </span>
                          )}
                        </div>

                        {/* QA Status Messages */}
                        {qaSuccess && (
                          <div className="mt-2 text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1">
                            ✅ {locale === 'ar' ? 'تم إرسال طلب فحص QA بنجاح! سيتم التحديث تلقائياً.' : 'QA check queued successfully! Will update automatically.'}
                          </div>
                        )}
                        {qaError && (
                          <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1">
                            ❌ {locale === 'ar' ? 'خطأ:' : 'Error:'} {qaError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Agent Chat / Preview (tabbed) */}
        <div className="w-1/2 bg-[#0c0121] border border-[#2c1466] rounded-2xl overflow-hidden flex flex-col min-h-0">
          {/* Phase 97.1: Tab Header */}
          <div className="border-b border-[#2c1466] p-3 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-[#1a0d3c] rounded-lg p-1">
              <button
                onClick={() => setRightPanelMode('chat')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  rightPanelMode === 'chat'
                    ? 'bg-purple-500/40 text-purple-200 shadow-sm'
                    : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-300'
                }`}
              >
                💬 <span>{locale === 'ar' ? 'محادثة' : 'Chat'}</span>
              </button>
              <button
                onClick={() => setRightPanelMode('preview')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  rightPanelMode === 'preview'
                    ? 'bg-violet-500/40 text-violet-200 shadow-sm'
                    : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-300'
                }`}
              >
                📱 <span>{locale === 'ar' ? 'معاينة' : 'Preview'}</span>
              </button>
            </div>

            {/* Preview URL indicator */}
            {rightPanelMode === 'preview' && project?.previewUrl && (
              <a
                href={project.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-violet-300/60 hover:text-violet-300 truncate max-w-[150px]"
                title={project.previewUrl}
              >
                ↗️ {project.previewUrl}
              </a>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightPanelMode === 'chat' ? (
              <AgentChatPanel
                projectId={projectId}
                locale={locale as 'ar' | 'en'}
                useOpsCollection={useOpsCollection}
                initialPrompt={pendingKickoffPrompt}
                onInitialPromptConsumed={() => setPendingKickoffPrompt(null)}
              />
            ) : (
              <DevicePreviewPane
                previewUrl={project?.previewUrl}
                locale={locale as 'ar' | 'en'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
