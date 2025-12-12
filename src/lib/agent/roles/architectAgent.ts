// src/lib/agent/roles/architectAgent.ts

import { BaseAgentCallParams } from './agentRoles';
import { getProjectMemory } from '@/lib/agent/projectMemory';
import { buildProjectMemorySystemPrompt } from '@/lib/agent/projectMemoryPrompt';
import { askAgent } from '@/lib/agents';

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type ArchitectComplexityLevel = 'SIMPLE' | 'STANDARD' | 'ADVANCED';

export interface ArchitectModule {
  id: string;                // e.g. "auth", "billing"
  title: string;             // "Authentication & User Accounts"
  description: string;
  priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
  dependsOn?: string[];      // other module ids
}

export interface ArchitectApiDesign {
  name: string;              // "POST /api/payments/checkout"
  purpose: string;           // "Create Stripe checkout session"
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;              // "/api/..."
  authRequired: boolean;
  notes?: string;
}

export interface ArchitectDataModelField {
  name: string;
  type: string;              // "string", "number", "boolean", "timestamp", "map", ...
  optional?: boolean;
  description?: string;
}

export interface ArchitectDataModel {
  id: string;                // "projects", "users"
  collectionPath: string;    // "projects", "projects/{projectId}/tasks"
  description: string;
  fields: ArchitectDataModelField[];
}

export interface ArchitectPhasePlan {
  id: string;                // "PHASE_1", "PHASE_2"
  title: string;             // "MVP Auth + Dashboard"
  description: string;
  order: number;
  goals: string[];
  doneCriteria: string[];    // "User can sign up and login", ...
}

export interface ArchitectConstraint {
  type:
    | 'SCOPE'
    | 'TECH_STACK'
    | 'PERFORMANCE'
    | 'SECURITY'
    | 'UX'
    | 'BUDGET'
    | 'TIMELINE';
  description: string;
}

export interface ArchitectRisk {
  id: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigation: string;
}

export interface ArchitectPlan {
  role: 'ARCHITECT';
  projectId: string;

  /** Short summary in 2–3 sentences */
  summary: string;

  /** What the user is trying to achieve */
  goals: string[];

  /** Confirmed constraints (from memory + current request) */
  constraints: ArchitectConstraint[];

  /** Modules / subsystems that form the architecture */
  modules: ArchitectModule[];

  /** Recommended backend APIs */
  apis: ArchitectApiDesign[];

  /** Firestore data models (MVP) */
  dataModels: ArchitectDataModel[];

  /** Implementation phases roadmap */
  phases: ArchitectPhasePlan[];

  /** Risks & mitigations (optional but useful) */
  risks?: ArchitectRisk[];

  /** Complexity level (used later for task decomposition) */
  complexity: ArchitectComplexityLevel;

  /** Free-form notes / tips */
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/*                               Public API                                   */
/* -------------------------------------------------------------------------- */

export interface RunArchitectAgentParams extends BaseAgentCallParams {
  /**
   * Optional: high-level hint like "new project", "extend existing module", ...
   */
  intentType?:
    | 'NEW_PROJECT'
    | 'EXTEND_FEATURE'
    | 'REFRESH_ARCH'
    | 'UNKNOWN';
}

export interface RunArchitectAgentResult {
  plan: ArchitectPlan;
  rawJson: string;
}

/**
 * Main entry point:
 * - Reads project memory
 * - Builds system prompt tuned for architecture
 * - Calls askAgent with strict JSON-only instructions
 * - Normalizes / validates the result
 */
export async function runArchitectAgent(
  params: RunArchitectAgentParams
): Promise<RunArchitectAgentResult> {
  const { projectId, userId, userInput, locale = 'en', intentType } = params;

  // 1) Load project memory
  const memoryDoc = await getProjectMemory(projectId);
  const memoryPrompt = memoryDoc
    ? buildProjectMemorySystemPrompt(memoryDoc)
    : 'No project memory yet. Treat this as a fresh project unless the user says otherwise.';

  // 2) Build prompts
  const systemPrompt = buildArchitectSystemPrompt(memoryPrompt);
  const userPrompt = buildArchitectUserPrompt({
    projectId,
    userInput,
    locale,
    intentType,
  });

  // 3) Call agent
  const response = await askAgent(userPrompt, {
    projectId: `architect:${userId}`,
  });

  const raw = response.visible || '';

  // 4) Extract & parse JSON
  const jsonStr = extractJsonBlock(raw);
  const parsed = JSON.parse(jsonStr) as Partial<ArchitectPlan>;

  // 5) Normalize
  const normalized = normalizeArchitectPlan(parsed, projectId);

  return {
    plan: normalized,
    rawJson: jsonStr,
  };
}

/* -------------------------------------------------------------------------- */
/*                           Prompt Construction                              */
/* -------------------------------------------------------------------------- */

interface ArchitectUserPromptParams {
  projectId: string;
  userInput: string;
  locale?: string;
  intentType?: RunArchitectAgentParams['intentType'];
}

function buildArchitectUserPrompt(
  params: ArchitectUserPromptParams
): string {
  const { projectId, userInput, locale, intentType } = params;
  const lines: string[] = [];

  lines.push(`Project ID: ${projectId}`);
  if (locale) {
    lines.push(`User locale: ${locale}`);
  }
  if (intentType) {
    lines.push(`Intent type: ${intentType}`);
  }
  lines.push('');
  lines.push('User request / high-level intent:');
  lines.push(userInput.trim());
  lines.push('');
  lines.push(
    'Your job as the ARCHITECT is to design the best technical architecture and implementation roadmap for this request.'
  );
  lines.push(
    'You MUST respond ONLY with a valid JSON object of type ArchitectPlan. No comments, no markdown, no natural language outside JSON.'
  );

  return lines.join('\n');
}

function buildArchitectSystemPrompt(memoryPrompt: string): string {
  const lines: string[] = [];

  lines.push(
    'You are the ARCHITECT AGENT for the F0 platform. Your responsibility is to design clear, practical architectures and roadmaps for software projects.'
  );
  lines.push('');
  lines.push(
    'You MUST respect all project decisions and constraints stored in the project memory below:'
  );
  lines.push('');
  lines.push(memoryPrompt);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('Your outputs will be used by:');
  lines.push('- Task Decomposer Agent (to break modules into actionable tasks)');
  lines.push('- Action Planner (Phase 95) to generate ActionPlans');
  lines.push('- Code Generator Agent to implement modules and APIs');
  lines.push('');
  lines.push('You MUST output a single JSON object matching this TypeScript shape:');
  lines.push(`
type ArchitectPlan = {
  role: "ARCHITECT";
  projectId: string;
  summary: string;
  goals: string[];
  constraints: {
    type: "SCOPE" | "TECH_STACK" | "PERFORMANCE" | "SECURITY" | "UX" | "BUDGET" | "TIMELINE";
    description: string;
  }[];
  modules: {
    id: string;
    title: string;
    description: string;
    priority: "MUST_HAVE" | "SHOULD_HAVE" | "NICE_TO_HAVE";
    dependsOn?: string[];
  }[];
  apis: {
    name: string;
    purpose: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    authRequired: boolean;
    notes?: string;
  }[];
  dataModels: {
    id: string;
    collectionPath: string;
    description: string;
    fields: {
      name: string;
      type: string;
      optional?: boolean;
      description?: string;
    }[];
  }[];
  phases: {
    id: string;
    title: string;
    description: string;
    order: number;
    goals: string[];
    doneCriteria: string[];
  }[];
  risks?: {
    id: string;
    description: string;
    impact: "LOW" | "MEDIUM" | "HIGH";
    mitigation: string;
  }[];
  complexity: "SIMPLE" | "STANDARD" | "ADVANCED";
  notes?: string;
};
`);
  lines.push('');
  lines.push('Rules:');
  lines.push('- Never contradict DONE_DECISIONS in memory.');
  lines.push('- If the user request conflicts with a FINAL decision, note it in `notes` and keep the decision.');
  lines.push('- Prefer Next.js + Firebase + Stripe when in doubt (unless memory says otherwise).');
  lines.push('- Prefer simple, incremental phases (Phase 1 = MVP, Phase 2 = enhancements, etc.).');
  lines.push('- Keep module ids, data model ids, and phase ids simple and machine-friendly (no spaces).');
  lines.push('');
  lines.push(
    'Think through the architecture internally, then respond ONLY with JSON. Do NOT include any backticks, markdown, or natural language outside JSON.'
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
      `[ArchitectAgent] Could not find JSON object in output: ${output.slice(
        0,
        200
      )}...`
    );
  }
  return output.slice(first, last + 1);
}

function normalizeArchitectPlan(
  raw: Partial<ArchitectPlan>,
  projectId: string
): ArchitectPlan {
  const plan: ArchitectPlan = {
    role: 'ARCHITECT',
    projectId,
    summary: raw.summary || 'High-level architecture plan',
    goals: raw.goals && raw.goals.length ? raw.goals : [],
    constraints: raw.constraints || [],
    modules: (raw.modules || []).map((m, idx) => ({
      id: m?.id || `module_${idx + 1}`,
      title: m?.title || `Module ${idx + 1}`,
      description: m?.description || '',
      priority: m?.priority || 'MUST_HAVE',
      dependsOn: m?.dependsOn || [],
    })),
    apis: (raw.apis || []).map((a) => ({
      name: a?.name || a?.path || 'Unnamed API',
      purpose: a?.purpose || '',
      method: a?.method || 'POST',
      path: a?.path || '/api/unnamed',
      authRequired:
        typeof a?.authRequired === 'boolean' ? a.authRequired : true,
      notes: a?.notes,
    })),
    dataModels: (raw.dataModels || []).map((dm, idx) => ({
      id: dm?.id || `model_${idx + 1}`,
      collectionPath: dm?.collectionPath || dm?.id || `collection_${idx + 1}`,
      description: dm?.description || '',
      fields: (dm?.fields || []).map((f) => ({
        name: f?.name || 'field',
        type: f?.type || 'string',
        optional: f?.optional ?? false,
        description: f?.description,
      })),
    })),
    phases: (raw.phases || []).map((p, idx) => ({
      id: p?.id || `PHASE_${idx + 1}`,
      title: p?.title || `Phase ${idx + 1}`,
      description: p?.description || '',
      order: typeof p?.order === 'number' ? p.order : idx + 1,
      goals: p?.goals || [],
      doneCriteria: p?.doneCriteria || [],
    })),
    risks: (raw.risks || []).map((r, idx) => ({
      id: r?.id || `risk_${idx + 1}`,
      description: r?.description || '',
      impact: r?.impact || 'MEDIUM',
      mitigation: r?.mitigation || '',
    })),
    complexity: raw.complexity || 'STANDARD',
    notes: raw.notes || '',
  };

  return plan;
}
