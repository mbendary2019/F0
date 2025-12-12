// src/lib/agent/actions/actionPlanner.ts

import { askAgent } from '@/lib/agents';
import {
  ActionPlan,
  AnyAction,
  ActionStatus,
  ActionInitiator,
  ActionName,
  ActionCategory,
  PlannedAction,
} from './actionTypes';
import {
  getProjectMemory,
} from '@/lib/agent/projectMemory';
import {
  buildProjectMemorySystemPrompt,
} from '@/lib/agent/projectMemoryPrompt';

/* -------------------------------------------------------------------------- */
/*                             Public Types / API                             */
/* -------------------------------------------------------------------------- */

export interface PlanActionsParams {
  /** Project this plan is for */
  projectId: string;

  /** User ID (for trace / logs / routing) */
  userId: string;

  /** Natural language intent from the user (original message or summary) */
  userInput: string;

  /** Who initiated this plan (default: 'user') */
  initiator?: ActionInitiator;

  /**
   * Optional extra context to help the planner:
   * - file tree
   * - active file path
   * - current route
   * - current phase
   */
  additionalContext?: string;

  /**
   * Optional: language hint ('en', 'ar', etc.)
   * Planner will still output JSON, but can reason in that language.
   */
  locale?: string;
}

export interface PlanActionsResult {
  plan: ActionPlan;
  /** Raw JSON string returned from the LLM (for debugging) */
  rawJson: string;
}

/* -------------------------------------------------------------------------- */
/*                     Core Entry: planActions (Phase 95.2)                   */
/* -------------------------------------------------------------------------- */

/**
 * Main entry point for the Action Planner Agent.
 *
 * Multi-step hybrid:
 * - Uses memory + project context + user input
 * - Asks the model to think through the steps internally
 * - But only emits final JSON ActionPlan in the response
 */
export async function planActions(
  params: PlanActionsParams
): Promise<PlanActionsResult> {
  const {
    projectId,
    userId,
    userInput,
    initiator = 'user',
    additionalContext,
    locale = 'en',
  } = params;

  // 1) Load project memory (Phase 94 integration)
  const memoryDoc = await getProjectMemory(projectId);
  const memoryPrompt = memoryDoc
    ? buildProjectMemorySystemPrompt(memoryDoc)
    : 'No project memory is available yet.';

  // 2) Build system prompt for the planner
  const systemPrompt = buildActionPlannerSystemPrompt(memoryPrompt);

  // 3) Build user message: includes intent + optional context
  const userPrompt = buildActionPlannerUserPrompt({
    userInput,
    additionalContext,
    projectId,
    locale,
  });

  // 4) Call main model
  const response = await askAgent(userPrompt, {
    projectId: `planner:${userId}`,
  });

  const raw = response.visible || '';

  // 5) Extract JSON block
  const jsonStr = extractJsonBlock(raw);

  // 6) Parse + normalize plan
  const parsed = JSON.parse(jsonStr) as Partial<ActionPlan>;

  const normalized = normalizeActionPlan({
    projectId,
    initiator,
    userInput,
    rawPlan: parsed,
  });

  return {
    plan: normalized,
    rawJson: jsonStr,
  };
}

/* -------------------------------------------------------------------------- */
/*                            Prompt Construction                             */
/* -------------------------------------------------------------------------- */

interface BuildUserPromptParams {
  projectId: string;
  userInput: string;
  additionalContext?: string;
  locale?: string;
}

/**
 * Builds the user-facing prompt for the planner.
 * Contains:
 * - projectId
 * - user input (intent)
 * - optional context (file tree, phase, etc.)
 */
function buildActionPlannerUserPrompt(
  params: BuildUserPromptParams
): string {
  const { projectId, userInput, additionalContext, locale } = params;

  const lines: string[] = [];

  lines.push(`Project ID: ${projectId}`);
  if (locale) {
    lines.push(`User locale: ${locale}`);
  }
  lines.push('');

  lines.push('User request / intent:');
  lines.push(userInput.trim());
  lines.push('');

  if (additionalContext?.trim()) {
    lines.push('Additional context:');
    lines.push(additionalContext.trim());
    lines.push('');
  }

  lines.push(
    'Your job: Think through the best implementation steps, then output ONLY a valid JSON ActionPlan object (no explanation, no comments, no markdown).'
  );

  return lines.join('\n');
}

/**
 * Builds the system prompt for the planner.
 * Includes:
 * - description of the planner role
 * - allowed action types
 * - JSON schema shape (high-level)
 * - integration with project memory
 */
function buildActionPlannerSystemPrompt(
  memoryPrompt: string
): string {
  const lines: string[] = [];

  lines.push(
    'You are the F0 Action Planner Agent. Your job is to convert natural-language user requests into a structured ActionPlan that can be executed by the F0 platform.'
  );
  lines.push('');
  lines.push(
    'You MUST respect the project-specific memory and decisions below. Never contradict finalized decisions in memory:'
  );
  lines.push('');
  lines.push(memoryPrompt);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('Your responsibilities:');
  lines.push('- Understand the user intent and the current project context.');
  lines.push('- Plan a sequence of actions (file changes, Firestore updates, env updates, deployments, memory notes, tool calls) to satisfy the request.');
  lines.push('- Use the smallest set of actions that fully implement the request.');
  lines.push('- Be safe and conservative: do not delete or overwrite critical files unless explicitly required.');
  lines.push('');
  lines.push('You must follow these rules:');
  lines.push('- ALWAYS output a single JSON object of type ActionPlan.');
  lines.push('- DO NOT include any extra text, markdown, comments, or explanations.');
  lines.push('- The JSON must be strictly valid and parseable.');
  lines.push('');
  lines.push('High-level ActionPlan shape (TypeScript-style):');
  lines.push(`
type ActionPlan = {
  id: string;
  projectId: string;
  summary: string;
  createdBy: "user" | "agent" | "system";
  createdAt: number;
  userIntent?: string;
  autoExecuted?: boolean;
  steps: {
    index: number;
    status: "PENDING";
    action: AnyAction;
  }[];
};

type AnyAction =
  | WriteFileAction
  | UpdateFileAction
  | DeleteFileAction
  | MkdirAction
  | CreateFirestoreDocAction
  | UpdateFirestoreDocAction
  | DeleteFirestoreDocAction
  | UpdateEnvAction
  | RunDeployAction
  | AppendMemoryNoteAction
  | SetMemorySectionAction
  | CallToolAction;
`);
  lines.push('');
  lines.push('Supported action.action values:');
  lines.push('- "WRITE_FILE"');
  lines.push('- "UPDATE_FILE"');
  lines.push('- "DELETE_FILE"');
  lines.push('- "MKDIR"');
  lines.push('- "CREATE_FIRESTORE_DOC"');
  lines.push('- "UPDATE_FIRESTORE_DOC"');
  lines.push('- "DELETE_FIRESTORE_DOC"');
  lines.push('- "UPDATE_ENV"');
  lines.push('- "RUN_DEPLOY"');
  lines.push('- "APPEND_MEMORY_NOTE"');
  lines.push('- "SET_MEMORY_SECTION"');
  lines.push('- "CALL_TOOL"');
  lines.push('');
  lines.push('Notes:');
  lines.push('- Always set action.projectId to the provided projectId.');
  lines.push('- Always set action.createdBy to "user" or "agent" depending on who initiated it.');
  lines.push('- Always set action.category according to the action type (FILE_SYSTEM, FIRESTORE, ENV, DEPLOYMENT, MEMORY, TOOL).');
  lines.push('- steps[index].status must start as "PENDING".');
  lines.push('- createdAt should be a UNIX timestamp in milliseconds (you may use 0; it will be normalized later).');
  lines.push('');
  lines.push('Think through the best plan internally, but ONLY output the final JSON ActionPlan object.');

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*                          JSON Extraction / Helpers                         */
/* -------------------------------------------------------------------------- */

/**
 * Extracts the first JSON object (starting with "{", ending with "}")
 * from the model output. If none found, throws.
 */
function extractJsonBlock(output: string): string {
  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(
      `[ActionPlanner] Could not find JSON object in model output: ${output.slice(
        0,
        200
      )}...`
    );
  }

  return output.slice(firstBrace, lastBrace + 1);
}

/**
 * Simple helper to generate a pseudo-unique ID string.
 * (Not cryptographically secure; good enough for planning.)
 */
function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${rand}`;
}

/* -------------------------------------------------------------------------- */
/*                        Plan Normalization / Validation                     */
/* -------------------------------------------------------------------------- */

interface NormalizePlanParams {
  projectId: string;
  initiator: ActionInitiator;
  userInput: string;
  rawPlan: Partial<ActionPlan>;
}

/**
 * Normalizes / fixes an ActionPlan coming from the model:
 * - Ensures id, projectId, summary, createdAt, createdBy
 * - Normalizes steps[] and indexes
 * - Ensures actions have ids, categories, projectId, createdBy, createdAt
 * - Sets status=PENDING for all steps
 */
function normalizeActionPlan(
  params: NormalizePlanParams
): ActionPlan {
  const { projectId, initiator, userInput, rawPlan } = params;

  const now = Date.now();

  const id = rawPlan.id || genId('plan');
  const summary =
    rawPlan.summary?.trim() ||
    `Plan generated for user request: ${truncate(userInput, 80)}`;

  const steps = Array.isArray(rawPlan.steps) ? rawPlan.steps : [];

  const normalizedSteps: PlannedAction<AnyAction>[] = steps.map((step, i) => {
    const index = typeof step.index === 'number' ? step.index : i;
    const actionRaw: AnyAction = (step as any).action;

    if (!actionRaw || typeof actionRaw !== 'object') {
      throw new Error(
        `[ActionPlanner] Invalid action at step ${i}: ${JSON.stringify(
          step
        )}`
      );
    }

    const normalizedAction = normalizeAction({
      projectId,
      initiator,
      rawAction: actionRaw,
      fallbackIndex: index,
      now,
    });

    const status: ActionStatus = 'PENDING';

    return {
      index,
      status,
      action: normalizedAction,
      result: step.result, // usually undefined at planning time
    };
  });

  const plan: ActionPlan = {
    id,
    projectId,
    summary,
    createdBy: initiator,
    createdAt: rawPlan.createdAt || now,
    userIntent: rawPlan.userIntent || userInput,
    autoExecuted: rawPlan.autoExecuted ?? false,
    steps: normalizedSteps,
  };

  return plan;
}

interface NormalizeActionParams {
  projectId: string;
  initiator: ActionInitiator;
  rawAction: AnyAction;
  fallbackIndex: number;
  now: number;
}

/**
 * Ensures an action has:
 * - id
 * - projectId
 * - createdBy
 * - createdAt
 * - category (inferred if missing)
 */
function normalizeAction(
  params: NormalizeActionParams
): AnyAction {
  const { projectId, initiator, rawAction, fallbackIndex, now } = params;

  const a: any = { ...rawAction };

  a.id = a.id || genId(`act${fallbackIndex}`);
  a.projectId = projectId;
  a.createdBy = a.createdBy || initiator;
  a.createdAt = a.createdAt || now;

  if (!a.action) {
    throw new Error(
      `[ActionPlanner] Action missing "action" field at index ${fallbackIndex}: ${JSON.stringify(
        rawAction
      )}`
    );
  }

  a.category = a.category || inferActionCategory(a.action as ActionName);

  return a as AnyAction;
}

/**
 * Infer ActionCategory from ActionName (fallback when the model forgets).
 */
function inferActionCategory(actionName: ActionName): ActionCategory {
  switch (actionName) {
    case 'WRITE_FILE':
    case 'UPDATE_FILE':
    case 'DELETE_FILE':
    case 'MKDIR':
      return 'FILE_SYSTEM';

    case 'CREATE_FIRESTORE_DOC':
    case 'UPDATE_FIRESTORE_DOC':
    case 'DELETE_FIRESTORE_DOC':
      return 'FIRESTORE';

    case 'UPDATE_ENV':
      return 'ENV';

    case 'RUN_DEPLOY':
      return 'DEPLOYMENT';

    case 'APPEND_MEMORY_NOTE':
    case 'SET_MEMORY_SECTION':
      return 'MEMORY';

    case 'CALL_TOOL':
    default:
      return 'TOOL';
  }
}

/**
 * Helper to truncate long strings safely.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
