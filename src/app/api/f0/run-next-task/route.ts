/**
 * Phase 104.4: Run Next Task with Agent
 * POST /api/f0/run-next-task
 *
 * Finds the next pending queued_action for a task and executes it.
 * For now: skeleton implementation that marks task as completed automatically.
 * TODO: Integrate with Code Agent for real task execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Dev bypass helper
function isDevEnv() {
  return process.env.NODE_ENV === 'development' ||
         process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
         process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user (with dev bypass)
    let uid = 'dev-user';

    if (isDevEnv()) {
      console.log('[Phase 104.4] Dev bypass enabled, skipping token verification');
    } else {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch (err) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }

      uid = decodedToken.uid;
    }

    // 2. Parse request body
    const body = await req.json();
    const { projectId, taskId } = body;

    if (!projectId || !taskId) {
      return NextResponse.json(
        { error: 'projectId and taskId are required' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    const projectDoc = await adminDb.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectData = projectDoc.data();

    // In emulator mode, skip ownership check (dev-user bypass)
    const isEmulatorMode = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

    if (!isEmulatorMode && projectData?.ownerUid && projectData.ownerUid !== uid) {
      console.error('[Phase 104.4] Ownership mismatch:', {
        projectOwner: projectData.ownerUid,
        requestingUser: uid,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Phase 104.4] Auth check passed:', { uid, projectId, isEmulatorMode });

    // 4. Get task details
    const taskDoc = await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)
      .get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDoc.data();

    // 5. Find or create queued_action
    const actionsRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('queued_actions');

    const existingActionQuery = await actionsRef
      .where('taskId', '==', taskId)
      .where('status', 'in', ['pending', 'in_progress'])
      .limit(1)
      .get();

    let actionId: string;

    if (!existingActionQuery.empty) {
      // Use existing action
      actionId = existingActionQuery.docs[0].id;
    } else {
      // Create new action
      const newActionRef = actionsRef.doc();
      actionId = newActionRef.id;

      await newActionRef.set({
        id: actionId,
        projectId,
        type: 'execute_task',
        phaseId: task?.phaseId,
        taskId,
        taskTitle: task?.title || 'Untitled Task',
        status: 'pending',
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        lastError: null,
      });
    }

    // 6. Mark action as in_progress
    await actionsRef.doc(actionId).update({
      status: 'in_progress',
      startedAt: FieldValue.serverTimestamp(),
    });

    // 7. Mark task as in_progress
    await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)
      .update({
        status: 'in_progress',
        updatedAt: Date.now(),
      });

    // 8. Execute task with Code Agent
    console.log(`[Phase 104.4] Executing task ${taskId}: ${task?.title}`);

    // Call Code Agent API directly (server-side internal call)
    try {
      // Import the code-agent handler
      const { callOpenAI } = await import('@/lib/llm/callOpenAI');
      const { CODE_AGENT_SYSTEM_PROMPT } = await import('@/lib/agent/prompts/codeAgentSystemPrompt');
      const { extractJsonFromText } = await import('@/lib/llm/extractJsonFromText');
      const { validateCodeAgentResponse } = await import('@/lib/llm/validateCodeAgentResponse');

      // Build user prompt
      const userPrompt = `المهمة: ${task?.title || 'Untitled'}

الوصف: ${task?.description || 'لا يوجد وصف'}

Stack:
- Frontend: Next.js 14 + TypeScript
- Backend: Firebase Functions v2
- Database: Firestore

اكتب الكود الكامل المطلوب لتنفيذ هذه المهمة. استخدم JSON Schema المطلوب فقط.`;

      console.log('[Phase 104.4] Calling OpenAI...');

      // Call LLM
      const llmResponse = await callOpenAI([
        { role: 'system', content: CODE_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      console.log('[Phase 104.4] LLM raw response:', llmResponse.substring(0, 200));

      // Extract and validate JSON
      const jsonData = extractJsonFromText(llmResponse);
      const codeResponse = validateCodeAgentResponse(jsonData);

      console.log('[Phase 104.4] Validated response:', {
        summary: codeResponse.summary,
        patchesCount: codeResponse.patches.length,
      });

      // Store patches in code_patches collection
      const projectRef = adminDb.collection('projects').doc(projectId);
      for (const patch of codeResponse.patches) {
        await projectRef.collection('code_patches').add({
          taskId,
          path: patch.path,
          action: patch.action,
          content: patch.content,
          createdAt: Date.now(),
          status: 'pending',
        });
      }

      // Send assistant message with generated code
      const firstPatch = codeResponse.patches[0];
      const codeSnippet = firstPatch?.content
        ? firstPatch.content.substring(0, 500) + (firstPatch.content.length > 500 ? '\n...' : '')
        : 'No code generated';

      await projectRef.collection('agent_messages').add({
        role: 'assistant',
        content:
          `🤖 **Code Agent**\n\n` +
          `**ملخص:**\n${codeResponse.summary}\n\n` +
          `**الملفات المُنشأة/المعدلة:** ${codeResponse.patches.length}\n\n` +
          `**أول ملف:** \`${firstPatch?.path || 'N/A'}\`\n\n` +
          '```typescript\n' +
          codeSnippet +
          '\n```\n\n' +
          (codeResponse.notes ? `_${codeResponse.notes}_` : ''),
        createdAt: Date.now(),
        metadata: {
          source: 'code_agent',
          taskId,
          patchesCount: codeResponse.patches.length,
        },
      });

      // Mark task as completed
      await adminDb
        .collection('projects')
        .doc(projectId)
        .collection('tasks')
        .doc(taskId)
        .update({
          status: 'completed',
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });

      // Mark action as completed
      await actionsRef.doc(actionId).update({
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[Phase 104.4] Task ${taskId} completed with Code Agent`);
    } catch (codeAgentError) {
      console.error('[Phase 104.4] Code Agent error:', codeAgentError);

      // Mark action as failed
      await actionsRef.doc(actionId).update({
        status: 'failed',
        lastError: codeAgentError instanceof Error ? codeAgentError.message : 'Unknown error',
      });

      // Add error message to chat
      await adminDb
        .collection('projects')
        .doc(projectId)
        .collection('agent_messages')
        .add({
          role: 'system',
          content: `❌ Error executing task: ${task?.title}\n\n${codeAgentError instanceof Error ? codeAgentError.message : 'Unknown error'}`,
          createdAt: Date.now(),
        });
    }

    // 9. Return success
    return NextResponse.json({
      ok: true,
      actionId,
      taskId,
      message: 'Task execution started (skeleton implementation)',
    });
  } catch (error) {
    console.error('[Phase 104.4] Error in run-next-task:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
