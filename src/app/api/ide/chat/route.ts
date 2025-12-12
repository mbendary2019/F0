/**
 * Phase 84.1: IDE Chat Endpoint
 * Phase 84.7: Refactored to use requireUser and requireProjectOwner helpers
 * Phase 85.4: Analysis-Driven Workspace Planning
 * POST /api/ide/chat
 * Handles chat requests from IDE clients (VS Code, etc.)
 * Returns agent responses with optional patch suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import type { IdeChatRequest, IdeChatResponse, IdeProjectAnalysisDocument } from '@/types/ideBridge';
import { askAgent } from '@/lib/agents';
import { classifyUserMessage } from '@/lib/agents/taskClassifier';
import { shouldUsePatchMode } from '@/lib/agents/patch/usePatchMode';
import { previewPatch } from '@/lib/agents/patch/orchestrator';
import { planWorkspaceChanges } from '@/lib/ide/workspacePlanner';
import { generatePatchesForStep } from '@/lib/ide/workspacePatchEngine';
import {
  loadProjectAnalysis,
  saveProjectAnalysis,
} from '@/lib/ide/projectAnalysisStore';
import {
  buildDependencyGraph,
  analyzeDependencyGraph,
} from '@/lib/ide/dependencyGraph';

const db = getFirestore(adminApp);

/**
 * Phase 85.4: Helper to get or build project analysis
 * Tries to load cached analysis, falls back to building from workspace files
 */
async function getOrBuildProjectAnalysis(
  projectId: string,
  workspaceContext?: any
): Promise<IdeProjectAnalysisDocument | null> {
  try {
    // Try to load cached analysis
    const cached = await loadProjectAnalysis(projectId);
    if (cached) {
      console.log('[IDE Chat] Using cached project analysis');
      return cached;
    }

    // No cached analysis - build new one if we have workspace context
    if (!workspaceContext?.openedFiles || workspaceContext.openedFiles.length === 0) {
      console.log('[IDE Chat] No workspace files available for analysis');
      return null;
    }

    console.log('[IDE Chat] Building fresh project analysis from workspace files');

    // Build dependency graph
    const files = workspaceContext.openedFiles.map((f: any) => ({
      path: f.path,
      content: f.content || '',
      languageId: f.languageId,
    }));

    const graph = buildDependencyGraph(files);
    const analysis = analyzeDependencyGraph(projectId, graph);

    // Save for future use
    await saveProjectAnalysis(projectId, analysis);

    console.log('[IDE Chat] Project analysis built and cached');
    return analysis;
  } catch (error) {
    console.error('[IDE Chat] Failed to get/build project analysis:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Phase 84.7: Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: IdeChatRequest = await req.json();
    const { sessionId, projectId, message, locale = 'en', fileContext, workspaceContext, mode = 'single-file' } = body;

    if (!sessionId || !projectId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, projectId, or message' },
        { status: 400 }
      );
    }

    // Phase 84.7: Verify project ownership
    await requireProjectOwner(user, projectId);

    console.log(`[IDE Chat] Mode: ${mode}, hasWorkspaceContext: ${!!workspaceContext}`);

    // Verify session exists and belongs to user
    const sessionDoc = await db
      .collection('projects')
      .doc(projectId)
      .collection('ideSessions')
      .doc(sessionId)
      .get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const sessionData = sessionDoc.data();
    if (sessionData?.createdBy !== user.uid) {
      return NextResponse.json(
        { error: 'Access denied - Session belongs to another user' },
        { status: 403 }
      );
    }

    // 4. Update session last active timestamp
    await sessionDoc.ref.update({
      lastActiveAt: FieldValue.serverTimestamp(),
    });

    // 5. Get project context (brief, tech stack, memory)
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const projectData = projectDoc.data();
    const brief = projectData?.context?.brief || '';
    const techStack = projectData?.projectAnalysis || null;
    const memory = projectData?.projectMemory || null;

    // ========================================
    // Phase 85.1: Multi-File Workspace Modes
    // Phase 85.4: Analysis-Driven Planning
    // ========================================

    // If mode is multi-file-plan or multi-file-apply AND we have workspace context
    if ((mode === 'multi-file-plan' || mode === 'multi-file-apply') && workspaceContext) {
      console.log(`[IDE Chat] Phase 85.1: Multi-file mode detected: ${mode}`);

      // Phase 85.4: Get or build project analysis
      const projectAnalysis = await getOrBuildProjectAnalysis(projectId, workspaceContext);

      // Step 1: Generate workspace plan with analysis context
      const plan = await planWorkspaceChanges({
        goal: message,
        workspaceContext,
        locale,
        projectId,
        brief,
        techStack,
        memory,
        projectAnalysis, // Phase 85.4: Pass analysis to planner
      });

      console.log(`[IDE Chat] Generated plan with ${plan.steps.length} steps`);

      // If mode is just planning, return plan only
      if (mode === 'multi-file-plan') {
        const response: IdeChatResponse = {
          messageId: crypto.randomUUID(),
          replyText: `I've created a plan with ${plan.steps.length} steps to achieve your goal:\n\n${plan.summary}`,
          kind: 'workspace-plan',
          plan,
        };

        console.log(`[IDE Chat] Returning workspace plan (plan-only mode)`);

        return NextResponse.json(response, { status: 200 });
      }

      // If mode is multi-file-apply, generate patches for each step
      if (mode === 'multi-file-apply') {
        console.log(`[IDE Chat] Phase 85.2: Generating patches for ${plan.steps.length} steps...`);

        const patches: Array<{ filePath: string; diff: string; stepId?: string }> = [];

        // For each step, use the new Workspace Patch Engine (Phase 85.2)
        for (const step of plan.steps) {
          try {
            console.log(`[IDE Chat] Generating patches for step ${step.id}: ${step.title}`);

            const stepPatches = await generatePatchesForStep({
              sessionId,
              projectId,
              workspaceContext,
              step,
              locale,
              brief,
              techStack,
              memory,
            });

            console.log(`[IDE Chat] Generated ${stepPatches.length} patches for step ${step.id}`);

            // Add all patches from this step
            patches.push(...stepPatches);
          } catch (patchError) {
            console.error(`[IDE Chat] Failed to generate patches for step ${step.id}:`, patchError);
            // Continue with other steps
          }
        }

        console.log(`[IDE Chat] Phase 85.2: Generated ${patches.length} total patches across ${plan.steps.length} steps`);

        const response: IdeChatResponse = {
          messageId: crypto.randomUUID(),
          replyText: `I've created a plan with ${plan.steps.length} steps and generated ${patches.length} patches:\n\n${plan.summary}`,
          kind: 'workspace-plan+patches',
          plan,
          patches,
        };

        return NextResponse.json(response, { status: 200 });
      }
    }

    // ========================================
    // Single-File Mode (Default - Phase 84.x)
    // ========================================

    console.log(`[IDE Chat] Using single-file mode (default)`);

    // 6. Build enhanced message with file context and workspace context
    let enhancedMessage = message;

    // Add workspace context if provided (Phase 84.7)
    if (workspaceContext) {
      let contextInfo = '\n\n## Workspace Context\n\n';

      // Add dependencies info
      if (workspaceContext.packageJson) {
        const deps = Object.keys(workspaceContext.packageJson.dependencies || {});
        const devDeps = Object.keys(workspaceContext.packageJson.devDependencies || {});

        if (deps.length > 0) {
          contextInfo += `**Dependencies**: ${deps.join(', ')}\n\n`;
        }
        if (devDeps.length > 0) {
          contextInfo += `**Dev Dependencies**: ${devDeps.join(', ')}\n\n`;
        }
      }

      // Add current file info
      if (workspaceContext.currentFile) {
        contextInfo += `**Current File**: ${workspaceContext.currentFile.path}`;
        if (workspaceContext.currentFile.languageId) {
          contextInfo += ` (${workspaceContext.currentFile.languageId})`;
        }
        contextInfo += '\n\n';
      }

      // Add opened files
      if (workspaceContext.openedFiles && workspaceContext.openedFiles.length > 0) {
        contextInfo += `**Opened Files** (${workspaceContext.openedFiles.length}):\n`;
        workspaceContext.openedFiles.slice(0, 10).forEach(file => {
          contextInfo += `  - ${file.path}\n`;
        });
        if (workspaceContext.openedFiles.length > 10) {
          contextInfo += `  ... and ${workspaceContext.openedFiles.length - 10} more\n`;
        }
        contextInfo += '\n';
      }

      // Add changed files (git diff)
      if (workspaceContext.changedFiles && workspaceContext.changedFiles.length > 0) {
        contextInfo += `**Modified Files** (${workspaceContext.changedFiles.length}):\n`;
        workspaceContext.changedFiles.forEach(file => {
          contextInfo += `  - [${file.status}] ${file.path}\n`;
        });
        contextInfo += '\n';
      }

      enhancedMessage = contextInfo + message;
    }

    // Add file context if provided
    if (fileContext) {
      let fileInfo = `File: ${fileContext.filePath}\n`;
      if (fileContext.selection) {
        fileInfo += `Selection (lines ${fileContext.selection.startLine}-${fileContext.selection.endLine}):\n`;
      }
      fileInfo += `\`\`\`${fileContext.languageId || ''}\n${fileContext.content}\n\`\`\`\n\n`;
      fileInfo += `User request: ${message}`;

      enhancedMessage = fileInfo;
    }

    // 7. Classify task kind
    const taskClassification = await classifyUserMessage({
      message: enhancedMessage,
      locale: locale as 'ar' | 'en',
      projectType: techStack?.projectType,
      hasUi: !!techStack?.features?.hasTailwind || !!techStack?.features?.hasShadcn,
      hasBackendApi: !!techStack?.features?.hasBackendApi,
    });

    console.log(`[IDE Chat] Task classified as: ${taskClassification.taskKind}`);

    // 8. Call agent
    const agentResponse = await askAgent(enhancedMessage, {
      projectId,
      brief,
      techStack,
      memory,
      lang: locale as 'ar' | 'en',
      taskClassification,
    });

    // 9. Check if we should generate patch
    let patchSuggestion: IdeChatResponse['patchSuggestion'] = undefined;

    if (shouldUsePatchMode(taskClassification.taskKind)) {
      console.log(`[IDE Chat] Patch mode enabled for task kind: ${taskClassification.taskKind}`);

      // Try to extract/generate patch from agent response
      try {
        const patchResult = await previewPatch({
          projectId,
          agentResponse: agentResponse.text,
          userMessage: message,
          taskKind: taskClassification.taskKind,
          locale: locale as 'ar' | 'en',
        });

        if (patchResult && patchResult.patches && patchResult.patches.length > 0) {
          // Extract unified diff text from patches
          const patchText = patchResult.patches
            .map(p => p.diff || '')
            .filter(Boolean)
            .join('\n\n');

          if (patchText) {
            patchSuggestion = {
              hasPatch: true,
              patchText,
            };
            console.log(`[IDE Chat] Generated patch with ${patchResult.patches.length} file(s)`);
          }
        }
      } catch (patchError) {
        console.error('[IDE Chat] Patch generation error:', patchError);
        // Continue without patch - it's optional
      }
    }

    // 10. Build response
    const messageId = crypto.randomUUID();
    const response: IdeChatResponse = {
      messageId,
      replyText: agentResponse.text,
      patchSuggestion,
      taskKind: taskClassification.taskKind,
      kind: 'single-file', // Phase 85.1: Explicit kind for single-file mode
    };

    // 11. Save message to session history (optional - for future reference)
    try {
      await db
        .collection('projects')
        .doc(projectId)
        .collection('ideSessions')
        .doc(sessionId)
        .collection('messages')
        .doc(messageId)
        .set({
          id: messageId,
          role: 'assistant',
          text: agentResponse.text,
          taskKind: taskClassification.taskKind,
          hasPatch: !!patchSuggestion?.hasPatch,
          createdAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
      console.warn('[IDE Chat] Failed to save message to history:', err);
      // Non-critical error, continue
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('IDE chat error:', error);

    // Phase 84.7: Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    if (error.message === 'NOT_OWNER') {
      return NextResponse.json(
        { error: 'Access denied - Not project owner' },
        { status: 403 }
      );
    }

    if (error.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
