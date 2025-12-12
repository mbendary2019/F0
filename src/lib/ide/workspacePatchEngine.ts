/**
 * Phase 85.2: Multi-File Patch Generation Engine
 * Generates patches for workspace plan steps using Phase 78 pipeline
 */

import { IdeWorkspaceContext, WorkspacePlanStep } from '@/types/ideBridge';
import { askAgent } from '@/lib/agents';

interface PatchResult {
  filePath: string;
  diff: string;
  stepId: string;
}

/**
 * Generate patches for a single WorkspacePlanStep.
 *
 * Each step references target files.
 * For each file, we run the Phase 78 patch generation pipeline.
 */
export async function generatePatchesForStep(input: {
  sessionId: string;
  projectId?: string;
  workspaceContext: IdeWorkspaceContext;
  step: WorkspacePlanStep;
  locale?: string;
  brief?: string;
  techStack?: any;
  memory?: any;
}): Promise<PatchResult[]> {
  const {
    sessionId,
    projectId,
    workspaceContext,
    step,
    locale = 'en',
    brief,
    techStack,
    memory,
  } = input;

  console.log(`[Workspace Patch Engine] Generating patches for step: ${step.id}`);
  console.log(`[Workspace Patch Engine] Target files (${step.targetFiles.length}):`, step.targetFiles);

  const patches: PatchResult[] = [];

  for (const filePath of step.targetFiles) {
    try {
      // Find file content from workspaceContext
      const fileContent = await loadFileContent(workspaceContext, filePath);

      if (!fileContent) {
        console.warn(
          `[Workspace Patch Engine] File not found in workspace context: ${filePath}`
        );
        continue;
      }

      console.log(`[Workspace Patch Engine] Processing file: ${filePath} (${fileContent.length} chars)`);

      // Build system prompt for patch generation
      const systemPrompt = `
You are the F0 Multi-File Patch Generator.
Given a workspace step describing a requested change,
produce a safe patch for ONLY the target file.

Return unified diff ONLY.
No explanations.
No markdown code blocks.
No prose.

The diff MUST follow this exact format:
--- ${filePath}
+++ ${filePath}
@@ -startLine,count +startLine,count @@
 context line
-removed line
+added line
 context line
`;

      // Build user prompt with step context
      const userPrompt = `
Workspace Step: ${step.title}

Description: ${step.description}

Change Kind: ${step.changeKind}

Target file: ${filePath}

Original content:
\`\`\`
${fileContent}
\`\`\`

Generate a unified diff patch that implements this change for ${filePath} ONLY.
Return ONLY the unified diff. No explanations.
`;

      console.log(`[Workspace Patch Engine] Calling agent for ${filePath}...`);

      // Call agent to generate patch
      const response = await askAgent(userPrompt, {
        projectId,
        brief,
        techStack,
        memory,
        lang: locale as 'ar' | 'en',
        systemPrompt,
      });

      // Extract diff from response
      let diff = response.text || response;

      // Clean up response (remove markdown code blocks if present)
      if (diff.includes('```')) {
        const match = diff.match(/```(?:diff|patch)?\s*([\s\S]*?)\s*```/);
        if (match) {
          diff = match[1].trim();
        }
      }

      // Validate diff starts with --- or looks like unified diff
      if (!diff.includes('---') && !diff.includes('+++') && !diff.includes('@@')) {
        console.warn(`[Workspace Patch Engine] Response doesn't look like a unified diff for ${filePath}`);
        console.warn(`[Workspace Patch Engine] Response preview:`, diff.substring(0, 200));

        // Try to construct a simple diff if AI returned the changed content
        diff = constructSimpleDiff(filePath, fileContent, diff);
      }

      console.log(`[Workspace Patch Engine] Generated patch for ${filePath} (${diff.length} chars)`);

      patches.push({
        filePath,
        diff,
        stepId: step.id,
      });
    } catch (error) {
      console.error(`[Workspace Patch Engine] Failed to generate patch for ${filePath}:`, error);
      // Continue with other files
    }
  }

  console.log(`[Workspace Patch Engine] Generated ${patches.length} patches for step ${step.id}`);

  return patches;
}

/**
 * Load file content from workspace context
 */
async function loadFileContent(
  ctx: IdeWorkspaceContext,
  filePath: string
): Promise<string | null> {
  if (!ctx.openedFiles || !Array.isArray(ctx.openedFiles)) {
    console.warn('[Workspace Patch Engine] No openedFiles in workspace context');
    return null;
  }

  const file = ctx.openedFiles.find((f) => f.path === filePath);
  if (!file) {
    console.warn(`[Workspace Patch Engine] File ${filePath} not found in openedFiles`);
    return null;
  }

  // Web IDE / VS Code extension will send content inside workspaceContext
  if ((file as any).content) {
    return (file as any).content as string;
  }

  console.warn(`[Workspace Patch Engine] File ${filePath} found but has no content`);
  return null;
}

/**
 * Construct a simple unified diff when AI returns modified content instead of diff
 */
function constructSimpleDiff(
  filePath: string,
  original: string,
  modified: string
): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Simple diff: assume full file replacement
  const diff = [
    `--- ${filePath}`,
    `+++ ${filePath}`,
    `@@ -1,${originalLines.length} +1,${modifiedLines.length} @@`,
    ...originalLines.map(line => `-${line}`),
    ...modifiedLines.map(line => `+${line}`),
  ].join('\n');

  return diff;
}
