/**
 * Phase 87.2: Code Agent API with Real LLM Integration
 * POST /api/f0/code-agent
 *
 * Executes a task using the Code Agent (LLM-powered code generation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { CodeAgentTaskRequest, CodeAgentResponse } from '@/types/codeAgent';
import type { F0Task } from '@/types/project';
import { callOpenAI } from '@/lib/llm/callOpenAI';
import { CODE_AGENT_SYSTEM_PROMPT } from '@/lib/agent/prompts/codeAgentSystemPrompt';
import { extractJsonFromText } from '@/lib/llm/extractJsonFromText';
import { validateCodeAgentResponse } from '@/lib/llm/validateCodeAgentResponse';
import OpenAI from 'openai';

// Lazy initialization of OpenAI client to avoid build-time errors
let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[Code Agent] OPENAI_API_KEY is not configured');
  }

  _openai = new OpenAI({ apiKey });
  return _openai;
}

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
      console.log('[Code Agent] Dev bypass enabled, skipping token verification');
    } else {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }

      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch (err) {
        return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
      }

      uid = decodedToken.uid;
    }

    // 2. Parse request body
    const body = await req.json();
    const { projectId, taskId, stream } = body;

    if (!projectId || !taskId) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_PROJECT_ID_OR_TASK_ID' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    const projectDoc = await adminDb.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    const projectData = projectDoc.data();

    // In emulator mode, skip ownership check (dev-user bypass)
    const isEmulatorMode = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

    if (!isEmulatorMode && projectData?.ownerUid && projectData.ownerUid !== uid) {
      console.error('[Code Agent] Ownership mismatch:', {
        projectOwner: projectData.ownerUid,
        requestingUser: uid,
      });
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Code Agent] Auth check passed:', { uid, projectId, isEmulatorMode });

    // 4. Get task details
    const projectRef = adminDb.collection('projects').doc(projectId);
    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return NextResponse.json(
        { ok: false, error: 'TASK_NOT_FOUND' },
        { status: 404 }
      );
    }

    const task = taskSnap.data() as F0Task;

    // 5. Mark task as in_progress
    await taskRef.update({
      status: 'in_progress',
      updatedAt: Date.now(),
    });

    console.log('[Code Agent] Task marked as in_progress:', task.title);

    // 6. Send system message: Agent started working
    await projectRef.collection('agent_messages').add({
      role: 'system',
      content: `🚀 Code Agent بدأ ينفّذ المهمة: ${task.title}`,
      createdAt: Date.now(),
    });

    // 7. Build Code Agent request payload
    const requestPayload: CodeAgentTaskRequest = {
      projectId,
      taskId,
      taskTitle: task.title,
      taskDescription: task.description,
      stack: {
        frontend: 'Next.js 14 + TypeScript',
        backend: 'Firebase Functions v2',
        db: 'Firestore',
      },
      files: [], // TODO: Add real files later
      mode: 'implement_task',
    };

    console.log('[Code Agent] Request payload:', requestPayload);

    // 8. If streaming is requested, return ReadableStream
    if (stream === true) {
      console.log('[Code Agent] Streaming mode enabled');

      const userPrompt = `المهمة: ${task.title}

الوصف: ${task.description || 'لا يوجد وصف'}

Stack:
- Frontend: Next.js 14 + TypeScript
- Backend: Firebase Functions v2
- Database: Firestore

اكتب الكود الكامل المطلوب لتنفيذ هذه المهمة. استخدم JSON Schema المطلوب فقط.`;

      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            const streamResponse = await getOpenAIClient().chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: CODE_AGENT_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.2,
              max_tokens: 4000,
              response_format: { type: 'json_object' },
              stream: true,
            });

            let fullContent = '';

            for await (const chunk of streamResponse) {
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                // Send chunk to client
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: delta })}\n\n`));
              }
            }

            // After streaming completes, process the full response
            try {
              const jsonData = extractJsonFromText(fullContent);
              const codeResponse = validateCodeAgentResponse(jsonData);

              // Store patches
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

              // Send final message to chat
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
                  source: 'code_agent_streaming',
                  taskId,
                  patchesCount: codeResponse.patches.length,
                },
              });

              // Mark task as completed
              await taskRef.update({
                status: 'completed',
                completedAt: Date.now(),
                updatedAt: Date.now(),
              });

              // Mark queued_action as completed if exists
              const actionsSnap = await projectRef
                .collection('queued_actions')
                .where('taskId', '==', taskId)
                .where('status', '==', 'in_progress')
                .limit(1)
                .get();

              if (!actionsSnap.empty) {
                await actionsSnap.docs[0].ref.update({
                  status: 'completed',
                  completedAt: FieldValue.serverTimestamp(),
                });
              }

              // Send done signal
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, summary: codeResponse.summary, patchesCount: codeResponse.patches.length })}\n\n`));
            } catch (parseError: any) {
              console.error('[Code Agent] Parse error after streaming:', parseError);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: parseError.message })}\n\n`));
            }

            controller.close();
          } catch (error: any) {
            console.error('[Code Agent] Streaming error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 8. Call real LLM to generate code (non-streaming path)
    let codeResponse: CodeAgentResponse;

    try {
      const userPrompt = `المهمة: ${task.title}

الوصف: ${task.description || 'لا يوجد وصف'}

Stack:
- Frontend: Next.js 14 + TypeScript
- Backend: Firebase Functions v2
- Database: Firestore

اكتب الكود الكامل المطلوب لتنفيذ هذه المهمة. استخدم JSON Schema المطلوب فقط.`;

      console.log('[Code Agent] Calling OpenAI...');

      const llmResponse = await callOpenAI([
        { role: 'system', content: CODE_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      console.log('[Code Agent] LLM raw response:', llmResponse.substring(0, 200));

      // Extract and validate JSON
      const jsonData = extractJsonFromText(llmResponse);
      codeResponse = validateCodeAgentResponse(jsonData);

      console.log('[Code Agent] Validated response:', {
        summary: codeResponse.summary,
        patchesCount: codeResponse.patches.length,
      });
    } catch (llmError: any) {
      console.error('[Code Agent] LLM error:', llmError);

      // Fallback to skeleton code if LLM fails
      const fallbackCode = `// TODO: Implement task: ${task.title}
// Description: ${task.description || 'No description'}

export function ${task.title.toLowerCase().replace(/\s+/g, '_')}() {
  console.log('Implementing: ${task.title}');

  // Implementation will be generated by Code Agent
  throw new Error('Not implemented yet');
}`;

      codeResponse = {
        summary: `خطأ في توليد الكود: ${llmError.message}. تم إنشاء كود مبدئي بدلاً منه.`,
        patches: [
          {
            path: `src/tasks/${task.title.toLowerCase().replace(/\s+/g, '_')}.ts`,
            action: 'create',
            content: fallbackCode,
          },
        ],
        notes: 'تم إنشاء كود مبدئي بسبب خطأ في الـ LLM.',
      };
    }

    // 9. Store patches in code_patches collection
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

    console.log('[Code Agent] Patches stored in code_patches collection');

    // 10. Send assistant message with generated code
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

    console.log('[Code Agent] Generated code sent to chat');

    // 10. Mark task as completed
    await taskRef.update({
      status: 'completed',
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[Code Agent] Task marked as completed');

    // 11. If there's a queued_action for this task, mark it completed too
    const actionsSnap = await projectRef
      .collection('queued_actions')
      .where('taskId', '==', taskId)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get();

    if (!actionsSnap.empty) {
      await actionsSnap.docs[0].ref.update({
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
      });
      console.log('[Code Agent] Queued action marked as completed');
    }

    // 12. Return success response
    return NextResponse.json({
      ok: true,
      projectId,
      taskId,
      codeSummary: codeResponse.summary,
      patchesCount: codeResponse.patches.length,
    });
  } catch (err: any) {
    console.error('[Code Agent] Error:', err);

    return NextResponse.json(
      { ok: false, error: err?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}
