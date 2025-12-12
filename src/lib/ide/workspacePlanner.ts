/**
 * Phase 85.1: Workspace Planner Engine
 * Phase 85.4: Analysis-Driven Planning
 * Phase 85.4.1: Impact & Risk Estimation
 * Server-side module for planning multi-file workspace changes
 */

import {
  IdeWorkspaceContext,
  WorkspacePlan,
  WorkspacePlanStep,
  IdeProjectAnalysisDocument
} from '@/types/ideBridge';
import { askAgent } from '@/lib/agents';
import { attachImpactToPlan } from '@/lib/ide/impactEstimator';

interface WorkspacePlannerInput {
  goal: string;
  workspaceContext?: IdeWorkspaceContext;
  locale?: string;
  projectId?: string;
  brief?: string;
  techStack?: any;
  memory?: any;
  // Phase 85.4: Analysis-aware planning
  projectAnalysis?: IdeProjectAnalysisDocument | null;
}

/**
 * Phase 85.4: Helper to convert Analysis → text summary for AI
 */
function buildAnalysisContextSummary(
  analysis?: IdeProjectAnalysisDocument | null
): string {
  if (!analysis) {
    return "No static project analysis is available. Plan using only the workspace context.\n";
  }

  const { summary, files, edges } = analysis;
  let out = "\n=== PROJECT DEPENDENCY ANALYSIS ===\n";
  out += `Files: ${summary.fileCount}, Dependencies: ${summary.edgeCount}, Issues: ${summary.issues.length}\n\n`;

  // Top 5 Core Files (high fan-in = hotspots)
  if (summary.topFanIn && summary.topFanIn.length > 0) {
    out += "**Core Files (Top Fan-In)**:\n";
    summary.topFanIn.slice(0, 5).forEach((f) => {
      out += `  - ${f.path} (↑ ${f.fanIn} dependents)\n`;
    });
    out += "\n";
  }

  // Top 5 God Files (high fan-out = complex dependencies)
  if (summary.topFanOut && summary.topFanOut.length > 0) {
    out += "**God Files (Top Fan-Out)**:\n";
    summary.topFanOut.slice(0, 5).forEach((f) => {
      out += `  - ${f.path} (↓ ${f.fanOut} dependencies)\n`;
    });
    out += "\n";
  }

  // Cycles
  if (summary.cycles && summary.cycles.length > 0) {
    out += "**Circular Dependencies Detected**:\n";
    summary.cycles.slice(0, 3).forEach((cycle, idx) => {
      out += `  ${idx + 1}. ${cycle.join(" → ")}\n`;
    });
    out += "\n";
  }

  // Top Issues
  if (summary.issues && summary.issues.length > 0) {
    out += "**Issues**:\n";
    summary.issues.slice(0, 8).forEach((issue) => {
      out += `  - [${issue.severity}] ${issue.kind}: ${issue.message}\n`;
      if (issue.affectedFiles && issue.affectedFiles.length > 0) {
        out += `    Files: ${issue.affectedFiles.slice(0, 3).join(", ")}\n`;
      }
    });
    out += "\n";
  }

  out += "Use this analysis to inform your plan. Prioritize fixing cycles, refactoring god files, and protecting core files.\n";
  return out;
}

/**
 * Server-side Workspace Planner.
 * يحوّل Goal + WorkspaceContext → خطة منظمة لتعديلات متعددة الملفات.
 */
export async function planWorkspaceChanges(
  input: WorkspacePlannerInput
): Promise<WorkspacePlan> {
  const { goal, workspaceContext, locale = 'en', projectId, brief, techStack, memory, projectAnalysis } = input;

  const systemPrompt = `
You are the F0 Workspace Planner.
Your job is to inspect the project workspace description and produce a **step-by-step plan**
of code changes across multiple files.

Rules:
- Do NOT write code.
- Do NOT produce diffs.
- Only produce a **plan**.
- Each step should reference concrete file paths.
- Steps should be small-ish and safe to apply.
- Be specific about what will change in each file.
- If project dependency analysis is provided, USE IT to inform your plan:
  * Prioritize fixing circular dependencies
  * Be careful with "core files" (high fan-in) - changes may affect many files
  * Consider refactoring "god files" (high fan-out) to reduce complexity
  * Address reported issues by severity

Return STRICTLY valid JSON following this TypeScript type:

type WorkspacePlan = {
  goal: string;
  summary: string;
  steps: {
    id: string;
    title: string;
    description: string;
    targetFiles: string[];
    changeKind:
      | "refactor"
      | "bugfix"
      | "performance"
      | "typing"
      | "style"
      | "structure"
      | "docs"
      | "other";
    estimatedImpact?: string;
  }[];
};

Example response:
{
  "goal": "Add TypeScript strict mode to the project",
  "summary": "Enable strict mode in tsconfig.json and fix type errors across key files",
  "steps": [
    {
      "id": "step-1",
      "title": "Update tsconfig.json",
      "description": "Enable strict mode and strictNullChecks in compiler options",
      "targetFiles": ["tsconfig.json"],
      "changeKind": "typing",
      "estimatedImpact": "Low - configuration change only"
    },
    {
      "id": "step-2",
      "title": "Fix type errors in utils",
      "description": "Add proper type annotations and null checks to utility functions",
      "targetFiles": ["src/utils/helpers.ts", "src/utils/validators.ts"],
      "changeKind": "typing",
      "estimatedImpact": "Medium - improves type safety"
    }
  ]
}
`;

  // Build user prompt with workspace context
  let userPrompt = `User goal:\n${goal}\n\n`;

  // Phase 85.4: Inject analysis summary
  const analysisSummary = buildAnalysisContextSummary(projectAnalysis);
  userPrompt += analysisSummary;

  if (workspaceContext) {
    userPrompt += `Workspace context:\n`;

    // Add opened files
    if (workspaceContext.openedFiles && workspaceContext.openedFiles.length > 0) {
      userPrompt += `\nOpened files (${workspaceContext.openedFiles.length}):\n`;
      workspaceContext.openedFiles.slice(0, 20).forEach(file => {
        userPrompt += `  - ${file.path}${file.languageId ? ` (${file.languageId})` : ''}\n`;
      });
      if (workspaceContext.openedFiles.length > 20) {
        userPrompt += `  ... and ${workspaceContext.openedFiles.length - 20} more files\n`;
      }
    }

    // Add current file
    if (workspaceContext.currentFile) {
      userPrompt += `\nCurrent file: ${workspaceContext.currentFile.path}\n`;
    }

    // Add changed files
    if (workspaceContext.changedFiles && workspaceContext.changedFiles.length > 0) {
      userPrompt += `\nModified files (${workspaceContext.changedFiles.length}):\n`;
      workspaceContext.changedFiles.forEach(file => {
        userPrompt += `  - [${file.status}] ${file.path}\n`;
      });
    }

    // Add package.json info
    if (workspaceContext.packageJson) {
      const deps = Object.keys(workspaceContext.packageJson.dependencies || workspaceContext.packageJson.deps || {});
      const devDeps = Object.keys(workspaceContext.packageJson.devDependencies || workspaceContext.packageJson.devDeps || {});

      if (deps.length > 0 || devDeps.length > 0) {
        userPrompt += `\nDependencies:\n`;
        if (deps.length > 0) {
          userPrompt += `  - Production: ${deps.slice(0, 10).join(', ')}${deps.length > 10 ? ', ...' : ''}\n`;
        }
        if (devDeps.length > 0) {
          userPrompt += `  - Dev: ${devDeps.slice(0, 10).join(', ')}${devDeps.length > 10 ? ', ...' : ''}\n`;
        }
      }
    }
  }

  userPrompt += `\nReturn ONLY JSON, no markdown, no prose.`;

  console.log('[Workspace Planner] Generating plan for goal:', goal);
  console.log('[Workspace Planner] Workspace context:', {
    filesCount: workspaceContext?.openedFiles?.length || 0,
    changedFiles: workspaceContext?.changedFiles?.length || 0,
  });

  // Call agent
  try {
    const raw = await askAgent(userPrompt, {
      projectId,
      brief,
      techStack,
      memory,
      lang: locale as 'ar' | 'en',
      systemPrompt,
    });

    console.log('[Workspace Planner] Raw agent response:', raw.substring(0, 200));

    // Try to parse JSON
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = raw.trim();
      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1];
        }
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1];
        }
      }

      const plan = JSON.parse(jsonText) as WorkspacePlan;

      // Validate plan shape
      if (!plan.goal || !Array.isArray(plan.steps)) {
        throw new Error('Invalid plan shape: missing goal or steps array');
      }

      // Fill missing IDs
      plan.steps = plan.steps.map((s, idx) => ({
        id: s.id || `step-${idx + 1}`,
        title: s.title || `Step ${idx + 1}`,
        description: s.description || '',
        targetFiles: Array.isArray(s.targetFiles) ? s.targetFiles : [],
        changeKind: s.changeKind || 'other',
        estimatedImpact: s.estimatedImpact,
      }));

      console.log('[Workspace Planner] Successfully generated plan with', plan.steps.length, 'steps');

      // Phase 85.4.1: Add impact estimation
      const planWithImpact = attachImpactToPlan(plan, projectAnalysis);

      return planWithImpact;
    } catch (parseError) {
      console.error('[Workspace Planner] Failed to parse plan JSON:', parseError);
      console.error('[Workspace Planner] Raw response was:', raw);

      // Fallback plan
      const fallback: WorkspacePlan = {
        goal,
        summary: 'Planner failed to parse JSON; returning minimal plan.',
        steps: [
          {
            id: 'fallback-1',
            title: 'Review and refactor key files',
            description:
              'Review the main files related to the user goal and apply safe improvements.',
            targetFiles:
              workspaceContext?.openedFiles?.map((f) => f.path) ?? [],
            changeKind: 'refactor',
            estimatedImpact: 'Moderate project improvements',
          },
        ],
      };

      console.log('[Workspace Planner] Returning fallback plan');

      return fallback;
    }
  } catch (agentError) {
    console.error('[Workspace Planner] Agent call failed:', agentError);

    // Fallback plan for agent errors
    const fallback: WorkspacePlan = {
      goal,
      summary: 'Planner encountered an error; returning minimal plan.',
      steps: [
        {
          id: 'fallback-1',
          title: 'Review workspace files',
          description: 'Review the workspace files and determine necessary changes.',
          targetFiles: workspaceContext?.openedFiles?.slice(0, 5).map((f) => f.path) ?? [],
          changeKind: 'other',
          estimatedImpact: 'Unknown - manual review needed',
        },
      ],
    };

    return fallback;
  }
}
