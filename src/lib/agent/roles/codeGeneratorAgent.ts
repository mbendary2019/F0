// src/lib/agent/roles/codeGeneratorAgent.ts

import { BaseAgentCallParams } from './agentRoles';
import { ArchitectPlan } from './architectAgent';
import { DecomposedTask } from './taskDecomposerAgent';
import { getProjectMemory } from '@/lib/agent/projectMemory';
import { buildProjectMemorySystemPrompt } from '@/lib/agent/projectMemoryPrompt';
import { askProjectAgent } from '@/lib/agent/askProjectAgent';
import { AnyAction } from '@/lib/agent/actions/actionTypes';

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/**
 * Represents a file change (for IDE preview / diff view)
 */
export interface FileDiff {
  path: string; // "src/app/api/auth/signup/route.ts"
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  oldContent?: string; // For UPDATE operations
  newContent?: string; // For CREATE/UPDATE operations
  language?: string; // "typescript", "json", etc.
}

/**
 * Code generation result with both actions and diffs
 */
export interface CodeGenerationPlan {
  role: 'CODE_GENERATOR';
  projectId: string;
  taskId: string;

  /** Summary of what was generated */
  summary: string;

  /** Phase 95 actions ready to execute */
  actions: AnyAction[];

  /** File diffs for IDE preview */
  diffs: FileDiff[];

  /** Any notes/warnings/tips */
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/*                               Public API                                   */
/* -------------------------------------------------------------------------- */

export interface RunCodeGeneratorAgentParams extends BaseAgentCallParams {
  /** The task to implement */
  task: DecomposedTask;

  /** Architecture context (APIs, data models, modules) */
  architectPlan: ArchitectPlan;

  /**
   * Optional: existing file tree
   * Format: array of relative paths like ["src/app/page.tsx", "src/lib/firebase.ts"]
   */
  fileTree?: string[];

  /**
   * Optional: existing file contents (for UPDATE operations)
   * Map of path -> content
   */
  existingFiles?: Record<string, string>;
}

export interface RunCodeGeneratorAgentResult {
  plan: CodeGenerationPlan;
  rawJson: string;
}

/**
 * Main entry point:
 * - Reads project memory
 * - Injects task details, architecture context, file tree
 * - Asks agent to generate code
 * - Returns actions + diffs
 */
export async function runCodeGeneratorAgent(
  params: RunCodeGeneratorAgentParams
): Promise<RunCodeGeneratorAgentResult> {
  const {
    projectId,
    userId,
    userInput,
    task,
    architectPlan,
    fileTree = [],
    existingFiles = {},
    locale = 'en',
  } = params;

  // 1) Load project memory
  const memoryDoc = await getProjectMemory(projectId);
  const memoryPrompt = memoryDoc
    ? buildProjectMemorySystemPrompt(memoryDoc)
    : 'No project memory yet. Treat this as a new project unless otherwise specified.';

  // 2) Build prompts
  const systemPrompt = buildCodeGeneratorSystemPrompt(memoryPrompt);
  const userPrompt = buildCodeGeneratorUserPrompt({
    projectId,
    userInput,
    task,
    architectPlan,
    fileTree,
    existingFiles,
    locale,
  });

  // 3) Call agent
  const response = await askProjectAgent({
    projectId,
    userId,
    systemPrompt,
    userText: userPrompt,
    autoMemory: false, // Don't auto-update memory for internal agent calls
  });

  const raw = response.visible || '';

  // 4) Extract & parse JSON
  const jsonStr = extractJsonBlock(raw);
  const parsed = JSON.parse(jsonStr) as Partial<CodeGenerationPlan>;

  // 5) Normalize
  const normalized = normalizeCodeGenerationPlan(parsed, projectId, task.id);

  return {
    plan: normalized,
    rawJson: jsonStr,
  };
}

/* -------------------------------------------------------------------------- */
/*                           Prompt Construction                              */
/* -------------------------------------------------------------------------- */

interface CodeGeneratorUserPromptParams {
  projectId: string;
  userInput: string;
  task: DecomposedTask;
  architectPlan: ArchitectPlan;
  fileTree: string[];
  existingFiles: Record<string, string>;
  locale?: string;
}

function buildCodeGeneratorUserPrompt(
  params: CodeGeneratorUserPromptParams
): string {
  const {
    projectId,
    userInput,
    task,
    architectPlan,
    fileTree,
    existingFiles,
    locale,
  } = params;
  const lines: string[] = [];

  lines.push(`Project ID: ${projectId}`);
  if (locale) {
    lines.push(`User locale: ${locale}`);
  }
  lines.push('');

  lines.push('USER REQUEST (ORIGINAL):');
  lines.push(userInput.trim());
  lines.push('');

  lines.push('TASK TO IMPLEMENT:');
  lines.push(`ID: ${task.id}`);
  lines.push(`Title: ${task.title}`);
  lines.push(`Description: ${task.description}`);
  lines.push(`Type: ${task.type}`);
  lines.push(`Priority: ${task.priority}`);
  if (task.moduleId) {
    lines.push(`Module: ${task.moduleId}`);
  }
  if (task.phaseId) {
    lines.push(`Phase: ${task.phaseId}`);
  }
  if (task.dependsOn && task.dependsOn.length > 0) {
    lines.push(`Dependencies: ${task.dependsOn.join(', ')}`);
  }
  if (task.actionHints && task.actionHints.length > 0) {
    lines.push(`Action Hints: ${task.actionHints.join(', ')}`);
  }
  lines.push('');

  lines.push('ARCHITECTURE CONTEXT:');
  lines.push(`Summary: ${architectPlan.summary}`);
  lines.push('');

  // Find relevant module
  if (task.moduleId) {
    const module = architectPlan.modules.find((m) => m.id === task.moduleId);
    if (module) {
      lines.push('Related Module:');
      lines.push(JSON.stringify(module, null, 2));
      lines.push('');
    }
  }

  // Find relevant APIs
  const relatedApis = architectPlan.apis.filter(
    (api) =>
      task.title.toLowerCase().includes(api.name.toLowerCase()) ||
      task.description.toLowerCase().includes(api.path.toLowerCase())
  );
  if (relatedApis.length > 0) {
    lines.push('Related APIs:');
    lines.push(JSON.stringify(relatedApis, null, 2));
    lines.push('');
  }

  // Find relevant data models
  const relatedModels = architectPlan.dataModels.filter(
    (dm) =>
      task.title.toLowerCase().includes(dm.id.toLowerCase()) ||
      task.description.toLowerCase().includes(dm.collectionPath.toLowerCase())
  );
  if (relatedModels.length > 0) {
    lines.push('Related Data Models:');
    lines.push(JSON.stringify(relatedModels, null, 2));
    lines.push('');
  }

  // File tree (show relevant files only to save tokens)
  if (fileTree.length > 0) {
    const relevantFiles = fileTree
      .filter((path) => {
        const lower = path.toLowerCase();
        return (
          lower.includes(task.moduleId?.toLowerCase() || '') ||
          lower.includes('api') ||
          lower.includes('lib') ||
          lower.includes('components')
        );
      })
      .slice(0, 50); // Limit to 50 files

    if (relevantFiles.length > 0) {
      lines.push('EXISTING FILE TREE (relevant files):');
      relevantFiles.forEach((path) => {
        lines.push(`  - ${path}`);
      });
      lines.push('');
    }
  }

  // Existing file contents (if provided)
  if (Object.keys(existingFiles).length > 0) {
    lines.push('EXISTING FILE CONTENTS (for UPDATE operations):');
    Object.entries(existingFiles).forEach(([path, content]) => {
      lines.push(`\n--- ${path} ---`);
      lines.push(content.slice(0, 2000)); // Limit to 2000 chars per file
      if (content.length > 2000) {
        lines.push('... (truncated)');
      }
    });
    lines.push('');
  }

  lines.push('YOUR JOB:');
  lines.push(
    '1. Generate complete, production-ready code to implement this task.'
  );
  lines.push('2. Follow Next.js 14+ App Router conventions.');
  lines.push('3. Use TypeScript with proper types.');
  lines.push('4. Follow the architecture plan (APIs, data models, modules).');
  lines.push(
    '5. Output ONLY a valid JSON object of type CodeGenerationPlan.'
  );
  lines.push('6. Include both actions (for execution) and diffs (for preview).');
  lines.push('');

  lines.push(
    'RESPOND ONLY WITH JSON. No markdown, no backticks, no explanations outside JSON.'
  );

  return lines.join('\n');
}

function buildCodeGeneratorSystemPrompt(memoryPrompt: string): string {
  const lines: string[] = [];

  lines.push(
    'You are the CODE GENERATOR AGENT for the F0 platform. Your job is to generate production-ready code for specific tasks.'
  );
  lines.push('');
  lines.push(
    'You MUST respect all project decisions and constraints stored in memory:'
  );
  lines.push('');
  lines.push(memoryPrompt);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('Output TypeScript shape:');
  lines.push(`
type FileDiff = {
  path: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  oldContent?: string;
  newContent?: string;
  language?: string;
};

type CodeGenerationPlan = {
  role: "CODE_GENERATOR";
  projectId: string;
  taskId: string;
  summary: string;
  actions: AnyAction[];  // Phase 95 actions (WRITE_FILE, UPDATE_FILE, etc.)
  diffs: FileDiff[];     // For IDE preview
  notes?: string;
};
  `);

  lines.push('');
  lines.push('CRITICAL RULES (Phase 106.1):');
  lines.push('- ⚠️ MANDATORY: Generate at least ONE file with COMPLETE, working code.');
  lines.push('- ⚠️ NEVER return empty newContent or empty diffs array.');
  lines.push('- ⚠️ If no specific path is given, use: src/components/GeneratedComponent.tsx');
  lines.push('- Generate COMPLETE, working code (no placeholders like "// TODO").');
  lines.push('- Follow Next.js 14+ App Router conventions (app directory).');
  lines.push(
    '- Use TypeScript with proper types (no "any" unless absolutely necessary).'
  );
  lines.push('- For API routes: use NextRequest/NextResponse from next/server.');
  lines.push('- For server components: async functions, no "use client".');
  lines.push('- For client components: "use client" directive at top.');
  lines.push(
    '- For Firebase: use existing helpers from @/lib/firebase.ts and @/lib/firebaseClient.ts.'
  );
  lines.push('- Include proper error handling (try/catch, validation).');
  lines.push('- Follow the architecture plan (respect API specs, data models).');
  lines.push('');

  lines.push('ACTION TYPES YOU CAN USE:');
  lines.push('- WRITE_FILE: Create a new file');
  lines.push('- UPDATE_FILE: Modify an existing file');
  lines.push('- DELETE_FILE: Delete a file');
  lines.push('- CREATE_FIRESTORE_DOC: Create Firestore document');
  lines.push('- UPDATE_ENV: Add environment variable');
  lines.push('- APPEND_MEMORY_NOTE: Update project memory');
  lines.push('');

  lines.push('DIFF FORMAT:');
  lines.push(
    '- For CREATE: operation="CREATE", newContent=<full file content>'
  );
  lines.push(
    '- For UPDATE: operation="UPDATE", oldContent=<existing>, newContent=<modified>'
  );
  lines.push('- For DELETE: operation="DELETE", oldContent=<existing>');
  lines.push('');

  lines.push(
    'Think through the implementation internally, then respond ONLY with JSON (no backticks, markdown, or explanations).'
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
      `[CodeGenerator] Could not find JSON object in output: ${output.slice(
        0,
        200
      )}...`
    );
  }
  return output.slice(first, last + 1);
}

function normalizeCodeGenerationPlan(
  raw: Partial<CodeGenerationPlan>,
  projectId: string,
  taskId: string
): CodeGenerationPlan {
  const plan: CodeGenerationPlan = {
    role: 'CODE_GENERATOR',
    projectId,
    taskId,
    summary: raw.summary || 'Code generation for task',
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    diffs: Array.isArray(raw.diffs)
      ? raw.diffs.map((d) => ({
          // Phase 106.1: Smart fallback path instead of 'unknown'
          path: d?.path || 'src/components/GeneratedComponent.tsx',
          operation: d?.operation || 'CREATE',
          oldContent: d?.oldContent,
          newContent: d?.newContent,
          language: d?.language || inferLanguage(d?.path || 'src/components/GeneratedComponent.tsx'),
        }))
      : [],
    notes: raw.notes || '',
  };

  return plan;
}

function inferLanguage(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.md')) return 'markdown';
  return 'plaintext';
}
