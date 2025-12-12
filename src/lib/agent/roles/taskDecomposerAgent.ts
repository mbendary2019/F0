// src/lib/agent/roles/taskDecomposerAgent.ts

import { BaseAgentCallParams } from './agentRoles';
import { ArchitectPlan } from './architectAgent';
import { getProjectMemory } from '@/lib/agent/projectMemory';
import { buildProjectMemorySystemPrompt } from '@/lib/agent/projectMemoryPrompt';
import { askProjectAgent } from '@/lib/agent/askProjectAgent';

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type TaskType =
  | 'BACKEND'
  | 'FRONTEND'
  | 'FULLSTACK'
  | 'INTEGRATION'
  | 'DATABASE'
  | 'INFRA'
  | 'DOCS'
  | 'RESEARCH';

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

export interface DecomposedTask {
  id: string; // "auth_setup_1"
  title: string; // "Configure Firebase Auth providers"
  description: string;

  /** Links */
  moduleId?: string; // from ArchitectPlan.modules[id]
  phaseId?: string; // from ArchitectPlan.phases[id]

  type: TaskType;
  priority: TaskPriority;

  /** Dependencies on other tasks (by id) */
  dependsOn?: string[];

  /** Rough time estimate in hours (integer) */
  estimateHours?: number;

  /** Optional hints for Phase 95 planner */
  actionHints?: string[]; // e.g. ["WRITE_FILE", "CREATE_FIRESTORE_DOC"]
}

export interface TaskGroup {
  id: string; // "phase_1_auth"
  title: string; // "Phase 1 - Auth & Onboarding"
  phaseId?: string;
  moduleIds?: string[];
  tasks: DecomposedTask[];
}

export interface TaskDecompositionPlan {
  role: 'TASK_DECOMPOSER';
  projectId: string;

  /** Short summary of what this decomposition covers */
  summary: string;

  /** High-level goals derived from ArchitectPlan + user request */
  goals: string[];

  /** Tasks grouped by phase/module (for easy UI rendering) */
  groups: TaskGroup[];

  /** Flat list of all tasks (for indexing/search) */
  allTasks: DecomposedTask[];

  /** Notes / strategy info (for debugging / display) */
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/*                               Public API                                   */
/* -------------------------------------------------------------------------- */

export interface RunTaskDecomposerAgentParams extends BaseAgentCallParams {
  architectPlan: ArchitectPlan;
  /**
   * Optional limit for number of tasks (to keep it reasonable).
   * Example: 30–60 tasks for whole MVP.
   */
  maxTasks?: number;
}

export interface RunTaskDecomposerAgentResult {
  plan: TaskDecompositionPlan;
  rawJson: string;
}

/**
 * Main entry point:
 * - Reads project memory
 * - Injects ArchitectPlan (modules + phases + apis)
 * - Asks model to break everything into actionable tasks
 * - Returns normalized TaskDecompositionPlan
 */
export async function runTaskDecomposerAgent(
  params: RunTaskDecomposerAgentParams
): Promise<RunTaskDecomposerAgentResult> {
  const {
    projectId,
    userId,
    userInput,
    architectPlan,
    locale = 'en',
    maxTasks,
  } = params;

  const memoryDoc = await getProjectMemory(projectId);
  const memoryPrompt = memoryDoc
    ? buildProjectMemorySystemPrompt(memoryDoc)
    : 'No project memory yet. Treat this as a new project unless otherwise specified.';

  const systemPrompt = buildTaskDecomposerSystemPrompt(memoryPrompt, maxTasks);

  const userPrompt = buildTaskDecomposerUserPrompt({
    projectId,
    userInput,
    architectPlan,
    locale,
    maxTasks,
  });

  const response = await askProjectAgent({
    projectId,
    userId,
    systemPrompt,
    userText: userPrompt,
    autoMemory: false, // Don't auto-update memory for internal agent calls
  });

  const raw = response.visible || '';
  const jsonStr = extractJsonBlock(raw);

  const parsed = JSON.parse(jsonStr) as Partial<TaskDecompositionPlan>;
  const normalized = normalizeTaskDecompositionPlan(parsed, projectId);

  return {
    plan: normalized,
    rawJson: jsonStr,
  };
}

/* -------------------------------------------------------------------------- */
/*                           Prompt Construction                              */
/* -------------------------------------------------------------------------- */

interface TaskDecomposerUserPromptParams {
  projectId: string;
  userInput: string;
  architectPlan: ArchitectPlan;
  locale?: string;
  maxTasks?: number;
}

function buildTaskDecomposerUserPrompt(
  params: TaskDecomposerUserPromptParams
): string {
  const { projectId, userInput, architectPlan, locale, maxTasks } = params;
  const lines: string[] = [];

  lines.push(`Project ID: ${projectId}`);
  if (locale) {
    lines.push(`User locale: ${locale}`);
  }
  if (typeof maxTasks === 'number') {
    lines.push(`Max tasks (soft limit): ${maxTasks}`);
  }
  lines.push('');

  lines.push('User original request / intent:');
  lines.push(userInput.trim());
  lines.push('');

  lines.push('High-level Architect Plan summary:');
  lines.push(architectPlan.summary);
  lines.push('');

  lines.push('Modules:');
  lines.push(
    JSON.stringify(
      architectPlan.modules.map((m) => ({
        id: m.id,
        title: m.title,
        priority: m.priority,
        dependsOn: m.dependsOn,
      })),
      null,
      2
    )
  );
  lines.push('');

  lines.push('Phases:');
  lines.push(
    JSON.stringify(
      architectPlan.phases.map((p) => ({
        id: p.id,
        title: p.title,
        order: p.order,
        goals: p.goals,
      })),
      null,
      2
    )
  );
  lines.push('');

  lines.push('APIs:');
  lines.push(
    JSON.stringify(
      architectPlan.apis.map((a) => ({
        name: a.name,
        method: a.method,
        path: a.path,
      })),
      null,
      2
    )
  );
  lines.push('');

  lines.push('Data Models:');
  lines.push(
    JSON.stringify(
      architectPlan.dataModels.map((dm) => ({
        id: dm.id,
        collectionPath: dm.collectionPath,
      })),
      null,
      2
    )
  );
  lines.push('');

  lines.push(
    'Your job as the TASK DECOMPOSER is to break this architecture into actionable, implementation-ready tasks.'
  );
  lines.push(
    'Each task should be small enough to be implemented in a few hours at most.'
  );
  lines.push(
    'You MUST respond ONLY with a valid JSON object of type TaskDecompositionPlan. No comments, no markdown, no extra text.'
  );

  return lines.join('\n');
}

function buildTaskDecomposerSystemPrompt(
  memoryPrompt: string,
  maxTasks?: number
): string {
  const lines: string[] = [];

  lines.push(
    'You are the TASK DECOMPOSER AGENT for the F0 platform. Your job is to convert high-level architectures into concrete tasks that developers and AI agents can execute.'
  );
  lines.push('');
  lines.push(
    'You MUST respect all project constraints and decisions stored in the memory:'
  );
  lines.push('');
  lines.push(memoryPrompt);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('Output TypeScript shape:');
  lines.push(`
type DecomposedTask = {
  id: string;
  title: string;
  description: string;
  moduleId?: string;
  phaseId?: string;
  type:
    | "BACKEND"
    | "FRONTEND"
    | "FULLSTACK"
    | "INTEGRATION"
    | "DATABASE"
    | "INFRA"
    | "DOCS"
    | "RESEARCH";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dependsOn?: string[];
  estimateHours?: number;
  actionHints?: string[];
};

type TaskGroup = {
  id: string;
  title: string;
  phaseId?: string;
  moduleIds?: string[];
  tasks: DecomposedTask[];
};

type TaskDecompositionPlan = {
  role: "TASK_DECOMPOSER";
  projectId: string;
  summary: string;
  goals: string[];
  groups: TaskGroup[];
  allTasks: DecomposedTask[];
  notes?: string;
};
  `);

  lines.push('');
  lines.push('Guidelines:');
  lines.push(
    '- Link tasks to moduleId and phaseId whenever possible (use IDs from the provided ArchitectPlan).'
  );
  lines.push(
    '- Use clear, implementation-oriented titles like "Implement signup API" not vague ones.'
  );
  lines.push(
    '- Use HIGH priority for critical path tasks (auth, core flows, billing).'
  );
  lines.push('- Use MEDIUM/LOW for enhancements and nice-to-have features.');
  lines.push(
    '- Use estimateHours as rough integer estimates (e.g., 2, 4, 8).'
  );
  lines.push(
    '- Use dependsOn to link tasks (e.g., "setup_firebase_auth" must come before "implement_login_ui").'
  );
  lines.push(
    '- Use actionHints to suggest action types for Phase 95 planner (e.g., ["WRITE_FILE", "CREATE_FIRESTORE_DOC"]).'
  );
  if (typeof maxTasks === 'number') {
    lines.push(
      `- Try to keep total number of tasks around ${maxTasks}, but prioritize logical breakdown over strict limit.`
    );
  } else {
    lines.push('- Aim for roughly 20–50 tasks for a typical MVP-level project.');
  }
  lines.push('');
  lines.push(
    'Think through the breakdown internally, then respond ONLY with JSON (no backticks, markdown, or explanations).'
  );

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*                       JSON Extraction & Normalization                      */
/* -------------------------------------------------------------------------- */

function extractJsonBlock(output: string): string {
  const first = output.indexOf('{');
  const last = output.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(
      `[TaskDecomposer] Could not find JSON object in output: ${output.slice(
        0,
        200
      )}...`
    );
  }
  return output.slice(first, last + 1);
}

function normalizeTaskDecompositionPlan(
  raw: Partial<TaskDecompositionPlan>,
  projectId: string
): TaskDecompositionPlan {
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  const allTasksFlat: DecomposedTask[] = [];

  const normalizedGroups: TaskGroup[] = groups.map((g, gIdx) => {
    const tasks = Array.isArray(g.tasks) ? g.tasks : [];

    const normalizedTasks: DecomposedTask[] = tasks.map((t, tIdx) => {
      const id = t?.id || `task_${gIdx + 1}_${tIdx + 1}`;
      const title = t?.title || `Task ${gIdx + 1}.${tIdx + 1}`;

      const task: DecomposedTask = {
        id,
        title,
        description: t?.description || '',
        moduleId: t?.moduleId,
        phaseId: t?.phaseId,
        type: t?.type || 'FULLSTACK',
        priority: t?.priority || 'MEDIUM',
        dependsOn: t?.dependsOn || [],
        estimateHours:
          typeof t?.estimateHours === 'number' ? t.estimateHours : undefined,
        actionHints: t?.actionHints || [],
      };

      allTasksFlat.push(task);
      return task;
    });

    const group: TaskGroup = {
      id: g?.id || `group_${gIdx + 1}`,
      title: g?.title || `Task Group ${gIdx + 1}`,
      phaseId: g?.phaseId,
      moduleIds: g?.moduleIds || [],
      tasks: normalizedTasks,
    };

    return group;
  });

  // If model didn't fill allTasks, we use our flat list
  const allTasks =
    Array.isArray(raw.allTasks) && raw.allTasks.length > 0
      ? raw.allTasks
      : allTasksFlat;

  const plan: TaskDecompositionPlan = {
    role: 'TASK_DECOMPOSER',
    projectId,
    summary: raw.summary || 'Task breakdown for project architecture',
    goals: raw.goals || [],
    groups: normalizedGroups,
    allTasks,
    notes: raw.notes || '',
  };

  return plan;
}
