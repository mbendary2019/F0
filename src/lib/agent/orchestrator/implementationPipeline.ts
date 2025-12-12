// src/lib/agent/orchestrator/implementationPipeline.ts

import { runArchitectAgent, ArchitectPlan } from '@/lib/agent/roles/architectAgent';
import {
  runTaskDecomposerAgent,
  TaskDecompositionPlan,
  DecomposedTask,
} from '@/lib/agent/roles/taskDecomposerAgent';
import {
  runCodeGeneratorAgent,
  CodeGenerationPlan,
} from '@/lib/agent/roles/codeGeneratorAgent';

import {
  ActionPlan,
  ActionPlanStep,
} from '@/lib/agent/actions/actionTypes';
import { runActionPlan } from '@/lib/agent/actions/runner/runActionPlan';

export type OrchestratorMode =
  | 'PLAN_ONLY'          // Architect + Tasks فقط
  | 'PLAN_AND_CODE'      // Architect + Tasks + Code (بدون تنفيذ)
  | 'FULL_AUTO';         // Architect + Tasks + Code + تنفيذ

export type TaskSelectionStrategy = 'HIGH_PRIORITY_FIRST' | 'ALL';

export interface RunImplementationPipelineParams {
  projectId: string;
  userId: string;
  userInput: string;       // طلب المستخدم بالعربي/إنجليزي
  locale?: string;
  mode?: OrchestratorMode;
  maxTasks?: number;       // أقصى عدد Tasks ننفذها في الـ run الواحد (default 3–5)
  taskSelectionStrategy?: TaskSelectionStrategy;
}

export interface ExecutedPlanSummary {
  planId: string;
  summary: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  successfulSteps: number;
  totalSteps: number;
  rawResult: any;
}

export interface ImplementationPipelineResult {
  projectId: string;
  userId: string;
  userInput: string;
  mode: OrchestratorMode;

  // Step 1: Architecture
  architectPlan: ArchitectPlan;
  // Step 2: Tasks
  taskPlan: TaskDecompositionPlan;
  selectedTasks: DecomposedTask[];

  // Step 3: Code generation
  codeGenPlans: CodeGenerationPlan[];

  // Step 4: Action plans
  actionPlans: ActionPlan[];

  // Step 5: Execution (optional)
  executedPlans: ExecutedPlanSummary[];

  // Meta
  createdAt: number;
  notes?: string;
}

/**
 * High-level orchestrator that:
 * 1) Generates ArchitectPlan
 * 2) Breaks it into tasks
 * 3) Generates code for selected tasks
 * 4) Optionally executes actions
 */
export async function runImplementationPipeline(
  params: RunImplementationPipelineParams
): Promise<ImplementationPipelineResult> {
  const {
    projectId,
    userId,
    userInput,
    locale = 'en',
    mode = 'PLAN_AND_CODE',
    maxTasks = 3,
    taskSelectionStrategy = 'HIGH_PRIORITY_FIRST',
  } = params;

  const createdAt = Date.now();

  // ---------------------------------------------------------------------------
  // 1) Architect Agent
  // ---------------------------------------------------------------------------
  console.log('[ORCHESTRATOR] Step 1: Running Architect Agent...');
  const { plan: architectPlan } = await runArchitectAgent({
    projectId,
    userId,
    userInput,
    locale,
    intentType: 'UNKNOWN',
  });

  console.log('[ORCHESTRATOR] ✅ Architecture generated:', {
    modules: architectPlan.modules?.length || 0,
    apis: architectPlan.apis?.length || 0,
    phases: architectPlan.phases?.length || 0,
  });

  // ---------------------------------------------------------------------------
  // 2) Task Decomposer Agent
  // ---------------------------------------------------------------------------
  console.log('[ORCHESTRATOR] Step 2: Running Task Decomposer Agent...');
  const { plan: taskPlan } = await runTaskDecomposerAgent({
    projectId,
    userId,
    userInput,
    architectPlan,
    locale,
    maxTasks: maxTasks * 3, // نسمح بتاسكات أكثر شوية، هنفلتر بعدين
  });

  console.log('[ORCHESTRATOR] ✅ Tasks decomposed:', {
    total: taskPlan.allTasks?.length || 0,
    groups: taskPlan.groups?.length || 0,
  });

  // اختيار الـ Tasks اللي هنشتغل عليها
  const selectedTasks = selectTasks(taskPlan, {
    maxTasks,
    strategy: taskSelectionStrategy,
  });

  console.log('[ORCHESTRATOR] Selected tasks:', {
    count: selectedTasks.length,
    titles: selectedTasks.map((t) => t.title),
  });

  // ---------------------------------------------------------------------------
  // 3) Code Generator Agent (لو المود يسمح)
  // ---------------------------------------------------------------------------
  const codeGenPlans: CodeGenerationPlan[] = [];
  const actionPlans: ActionPlan[] = [];
  const executedPlans: ExecutedPlanSummary[] = [];

  if (mode === 'PLAN_ONLY') {
    // ما نعملش CodeGen ولا تنفيذ
    console.log('[ORCHESTRATOR] Mode is PLAN_ONLY, skipping code generation and execution.');
    return {
      projectId,
      userId,
      userInput,
      mode,
      architectPlan,
      taskPlan,
      selectedTasks,
      codeGenPlans,
      actionPlans,
      executedPlans,
      createdAt,
      notes:
        'PLAN_ONLY mode: generated architecture and tasks without code or execution.',
    };
  }

  // Otherwise: PLAN_AND_CODE أو FULL_AUTO
  console.log('[ORCHESTRATOR] Step 3: Generating code for selected tasks...');
  for (let i = 0; i < selectedTasks.length; i++) {
    const task = selectedTasks[i];
    console.log(`[ORCHESTRATOR] Generating code for task ${i + 1}/${selectedTasks.length}: ${task.title}`);

    // 3.1 Code generation for this task
    const { plan: codeGenPlan } = await runCodeGeneratorAgent({
      projectId,
      userId,
      userInput: `Implement task: ${task.title}`,
      locale,
      task,
      architectPlan,
    });

    codeGenPlans.push(codeGenPlan);
    console.log(`[ORCHESTRATOR] ✅ Code generated:`, {
      actions: codeGenPlan.actions?.length || 0,
      diffs: codeGenPlan.diffs?.length || 0,
    });

    // 3.2 Build ActionPlan from CodeGenerationPlan
    const ap = buildActionPlanFromCodeGen(codeGenPlan, projectId, userId);
    actionPlans.push(ap);

    // 3.3 (Optional) Execute actions
    if (mode === 'FULL_AUTO') {
      console.log(`[ORCHESTRATOR] Executing action plan for task: ${task.title}`);
      const execResult: any = await runActionPlan(ap);

      const { status, successfulSteps, totalSteps } = deriveExecutionStatus(execResult);
      executedPlans.push({
        planId: ap.id,
        summary: ap.summary,
        status,
        successfulSteps,
        totalSteps,
        rawResult: execResult,
      });

      console.log(`[ORCHESTRATOR] ✅ Execution completed:`, {
        status,
        successfulSteps,
        totalSteps,
      });
    }
  }

  const result: ImplementationPipelineResult = {
    projectId,
    userId,
    userInput,
    mode,
    architectPlan,
    taskPlan,
    selectedTasks,
    codeGenPlans,
    actionPlans,
    executedPlans,
    createdAt,
    notes:
      mode === 'FULL_AUTO'
        ? 'Architecture + tasks + code generation + execution completed.'
        : 'Architecture + tasks + code generation completed (no execution).',
  };

  console.log('[ORCHESTRATOR] Pipeline completed:', {
    mode: result.mode,
    selectedTasks: result.selectedTasks.length,
    codeGenPlans: result.codeGenPlans.length,
    actionPlans: result.actionPlans.length,
    executedPlans: result.executedPlans.length,
  });

  return result;
}

/* -------------------------------------------------------------------------- */
/*                               Helpers                                      */
/* -------------------------------------------------------------------------- */

interface TaskSelectionParams {
  maxTasks: number;
  strategy: TaskSelectionStrategy;
}

function selectTasks(
  taskPlan: TaskDecompositionPlan,
  params: TaskSelectionParams
): DecomposedTask[] {
  const { maxTasks, strategy } = params;
  const all = taskPlan.allTasks || [];

  if (!all.length) return [];

  if (strategy === 'ALL') {
    return all.slice(0, maxTasks);
  }

  // HIGH_PRIORITY_FIRST
  const high = all.filter((t) => t.priority === 'HIGH');
  const medium = all.filter((t) => t.priority === 'MEDIUM');
  const low = all.filter((t) => t.priority === 'LOW');

  const ordered = [...high, ...medium, ...low];
  return ordered.slice(0, maxTasks);
}

/**
 * Build ActionPlan from CodeGenerationPlan
 */
function buildActionPlanFromCodeGen(
  codeGenPlan: CodeGenerationPlan,
  projectId: string,
  userId: string
): ActionPlan {
  const steps: ActionPlanStep[] = (codeGenPlan.actions || []).map((action, idx) => ({
    index: idx,
    status: 'PENDING' as const,
    action,
  }));

  return {
    id: `action-plan-${codeGenPlan.taskId}-${Date.now()}`,
    projectId,
    summary: codeGenPlan.summary || 'Code generation action plan',
    createdBy: userId,
    createdAt: Date.now(),
    userIntent: `Implement task: ${codeGenPlan.taskId}`,
    autoExecuted: true,
    steps,
  };
}

/**
 * Try to infer final status from Action Runner result.
 */
function deriveExecutionStatus(execResult: any): {
  status: ExecutedPlanSummary['status'];
  successfulSteps: number;
  totalSteps: number;
} {
  try {
    const steps = execResult?.steps || execResult?.stepResults || [];
    if (!Array.isArray(steps) || steps.length === 0) {
      return { status: 'PARTIAL', successfulSteps: 0, totalSteps: 0 };
    }

    const totalSteps = steps.length;
    const successfulSteps = steps.filter(
      (s: any) => s.status === 'SUCCESS' || s.status === 'COMPLETED'
    ).length;

    const hasError = steps.some(
      (s: any) =>
        s.status === 'ERROR' ||
        s.status === 'FAILED' ||
        s.error != null
    );

    if (hasError && successfulSteps === 0) {
      return { status: 'FAILED', successfulSteps, totalSteps };
    }

    if (successfulSteps === totalSteps) {
      return { status: 'SUCCESS', successfulSteps, totalSteps };
    }

    return { status: 'PARTIAL', successfulSteps, totalSteps };
  } catch {
    return { status: 'PARTIAL', successfulSteps: 0, totalSteps: 0 };
  }
}
