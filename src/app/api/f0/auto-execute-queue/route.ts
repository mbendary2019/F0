/**
 * Phase 95.2: Auto Execute Queue (Unified Actions)
 * POST /api/f0/auto-execute-queue
 *
 * Automatically picks and executes the next pending action from ops_actions.
 * This is the "one-click" automation endpoint.
 *
 * Updated to use unified ops_actions collection (Phase 95.1):
 * - Reads from ops_actions collection (global, not subcollection)
 * - Uses updateActionStatus for proper state tracking
 * - Supports all action types with switch/case
 * - Uses incrementActionAttempts for retry logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { callOpenAI } from '@/lib/llm/callOpenAI';
import { CODE_AGENT_SYSTEM_PROMPT } from '@/lib/agent/prompts/codeAgentSystemPrompt';
import { extractJsonFromText } from '@/lib/llm/extractJsonFromText';
import { validateCodeAgentResponse } from '@/lib/llm/validateCodeAgentResponse';
import { updateTaskStatus, updateTaskQaStatus, type TaskStatus, type QaStatus } from '@/lib/server/projectPlan';
import {
  getNextPendingAction,
  updateActionStatus,
  incrementActionAttempts,
  enqueueTaskExecution,
  enqueueAction,
  type F0Action,
  type ActionType,
  type QaMode,
  type RunTestsPayload,
} from '@/lib/server/actions';
import {
  runCombinedQa,
  type CombinedQaResult,
} from '@/lib/server/qa';
import { touchPreviewHeartbeat } from '@/lib/server/previewHeartbeat';

export const dynamic = 'force-dynamic';

// Dev bypass helper
function isDevEnv() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
  );
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user (with dev bypass)
    let uid = 'dev-user';

    if (isDevEnv()) {
      console.log('[Auto Execute Queue] Dev bypass enabled, skipping token verification');
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
    const { projectId, useOpsCollection = true, actionType } = body;

    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
    }

    // Determine which collection to use for project data (default to ops_projects)
    const collectionName = useOpsCollection ? 'ops_projects' : 'projects';
    console.log(`[Auto Execute Queue] Using collection: ${collectionName}`);

    // 3. Verify project exists (ownership check is optional in dev)
    const projectDoc = await adminDb.collection(collectionName).doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    const projectData = projectDoc.data();

    // In emulator mode, skip ownership check (dev-user bypass)
    const isEmulatorMode = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

    if (!isEmulatorMode && projectData?.ownerUid && projectData.ownerUid !== uid) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Auto Execute Queue] Auth check passed:', { uid, projectId, isEmulatorMode });

    // 4. Get next pending action from unified ops_actions collection
    let action = await getNextPendingAction({
      projectId,
      type: actionType as ActionType | undefined,
    });

    // No pending actions - try to find a pending task and create action for it
    if (!action) {
      console.log('[Auto Execute Queue] No pending actions, looking for pending tasks...');

      const projectRef = adminDb.collection(collectionName).doc(projectId);

      // Find first pending task
      const pendingTasksQuery = await projectRef
        .collection('tasks')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (pendingTasksQuery.empty) {
        return NextResponse.json({
          ok: true,
          executed: false,
          message: 'No pending actions or tasks in queue',
        });
      }

      // Found a pending task - create an action for it
      const taskDoc = pendingTasksQuery.docs[0];
      const taskData = taskDoc.data();

      console.log('[Auto Execute Queue] Found pending task:', taskDoc.id, taskData.title);

      // Enqueue task execution action using new unified system
      action = await enqueueTaskExecution({
        projectId,
        taskId: taskDoc.id,
        taskTitle: taskData.title,
        phaseId: taskData.phaseId,
        source: 'auto',
        createdBy: uid,
      });

      console.log('[Auto Execute Queue] Created action for task:', action.id);
    }

    // Mark action as running
    await updateActionStatus({
      actionId: action.id,
      status: 'running',
    });

    console.log('[Auto Execute Queue] Executing action:', {
      actionId: action.id,
      type: action.type,
      taskId: action.taskId,
    });

    const projectRef = adminDb.collection(collectionName).doc(projectId);

    // 5. Execute the action based on type (switch/case)
    switch (action.type) {
      case 'execute_task':
        return await executeTaskAction(action, projectRef, projectId, collectionName);

      case 'run_tests':
        return await executeRunTestsAction(action, projectRef, projectId, collectionName);

      case 'deploy':
        return await executeDeployAction(action, projectRef, projectId);

      case 'analyze_logs':
        return await executeAnalyzeLogsAction(action, projectRef, projectId);

      case 'open_pr':
        return await executeOpenPrAction(action, projectRef, projectId);

      case 'git_commit':
        return await executeGitCommitAction(action, projectRef, projectId);

      case 'git_push':
        return await executeGitPushAction(action, projectRef, projectId);

      case 'send_notification':
        return await executeSendNotificationAction(action, projectRef, projectId);

      default:
        // Unsupported action type
        await updateActionStatus({
          actionId: action.id,
          status: 'failed',
          errorMessage: `Unsupported action type: ${action.type}`,
        });

        return NextResponse.json(
          { ok: false, error: `Unsupported action type: ${action.type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Auto Execute Queue] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// Action Executors
// ============================================

/**
 * Execute Task Action - Main task execution with Code Agent
 */
async function executeTaskAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string,
  collectionName: string
): Promise<NextResponse> {
  let taskId = action.taskId;

  // If no taskId but have payload.taskTitle, try to find the task
  if (!taskId && action.payload?.taskTitle) {
    const tasksQuery = await projectRef
      .collection('tasks')
      .where('title', '==', action.payload.taskTitle)
      .limit(1)
      .get();

    if (!tasksQuery.empty) {
      taskId = tasksQuery.docs[0].id;
      console.log('[Auto Execute Queue] Found taskId from taskTitle:', taskId);
    }
  }

  // If still no taskId, try to get the first pending task
  if (!taskId) {
    const pendingTasksQuery = await projectRef
      .collection('tasks')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (!pendingTasksQuery.empty) {
      taskId = pendingTasksQuery.docs[0].id;
      console.log('[Auto Execute Queue] Using first pending task:', taskId);
    }
  }

  if (!taskId) {
    await updateActionStatus({
      actionId: action.id,
      status: 'failed',
      errorMessage: 'No taskId provided and could not find matching task',
    });
    return NextResponse.json(
      { ok: false, error: 'No taskId provided and could not find matching task' },
      { status: 400 }
    );
  }

  // Get task details
  let taskDoc = await projectRef.collection('tasks').doc(taskId).get();
  let taskFound = taskDoc.exists;

  // If task not found by ID, try to find by title
  if (!taskFound && action.payload?.taskTitle) {
    console.log(
      `[Auto Execute Queue] Task ${taskId} not found, searching by title: ${action.payload.taskTitle}`
    );
    const tasksQuery = await projectRef
      .collection('tasks')
      .where('title', '==', action.payload.taskTitle)
      .limit(1)
      .get();

    if (!tasksQuery.empty) {
      taskDoc = tasksQuery.docs[0] as any;
      taskId = taskDoc.id;
      taskFound = true;
      console.log('[Auto Execute Queue] Found task by title:', taskId);
    }
  }

  // If still not found, try first pending task
  if (!taskFound) {
    console.log('[Auto Execute Queue] Task not found by ID or title, trying first pending task');
    const pendingTasksQuery = await projectRef
      .collection('tasks')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (!pendingTasksQuery.empty) {
      taskDoc = pendingTasksQuery.docs[0] as any;
      taskId = taskDoc.id;
      taskFound = true;
      console.log('[Auto Execute Queue] Using first pending task:', taskId);
    }
  }

  if (!taskFound) {
    await updateActionStatus({
      actionId: action.id,
      status: 'failed',
      errorMessage: 'Task not found',
    });
    return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
  }

  const task = taskDoc.data();

  // Mark task as in_progress
  await updateTaskStatus({
    projectId,
    taskId,
    status: 'in_progress' as TaskStatus,
    collectionName,
  });

  // Execute with Code Agent
  try {
    const userPrompt = `المهمة: ${task?.title || 'Untitled'}

الوصف: ${task?.description || 'لا يوجد وصف'}

Stack:
- Frontend: Next.js 14 + TypeScript
- Backend: Firebase Functions v2
- Database: Firestore

اكتب الكود الكامل المطلوب لتنفيذ هذه المهمة. استخدم JSON Schema المطلوب فقط.`;

    console.log('[Auto Execute Queue] Calling OpenAI...');

    const llmResponse = await callOpenAI([
      { role: 'system', content: CODE_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    console.log('[Auto Execute Queue] LLM response received');

    // Extract and validate JSON
    const jsonData = extractJsonFromText(llmResponse);
    const codeResponse = validateCodeAgentResponse(jsonData);

    console.log('[Auto Execute Queue] Code generated:', {
      summary: codeResponse.summary,
      patchesCount: codeResponse.patches.length,
    });

    // Store patches
    for (const patch of codeResponse.patches) {
      await projectRef.collection('code_patches').add({
        taskId,
        actionId: action.id,
        path: patch.path,
        action: patch.action,
        content: patch.content,
        createdAt: Date.now(),
        status: 'pending',
      });
    }

    // Send message to chat
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
        source: 'code_agent_auto',
        taskId,
        actionId: action.id,
        patchesCount: codeResponse.patches.length,
      },
    });

    // Mark task as completed
    await updateTaskStatus({
      projectId,
      taskId,
      status: 'completed' as TaskStatus,
      collectionName,
    });

    // Mark action as succeeded
    await updateActionStatus({
      actionId: action.id,
      status: 'succeeded',
      resultSummary: codeResponse.summary,
      output: {
        patchesCount: codeResponse.patches.length,
        files: codeResponse.patches.map((p) => p.path),
      },
    });

    console.log('[Auto Execute Queue] Task completed successfully');

    // Phase 115.1: Trigger preview heartbeat for auto-refresh
    await touchPreviewHeartbeat({
      projectId,
      reason: 'task_executed',
    });

    // Phase 96.2: Auto-enqueue run_tests action after successful task execution
    // Only for code-generating tasks (refactor mode or if patches were generated)
    const taskMode = task?.mode || 'refactor';
    const shouldRunQa = codeResponse.patches.length > 0 && ['refactor', 'deploy'].includes(taskMode);

    if (shouldRunQa) {
      console.log('[Auto Execute Queue] Auto-enqueueing run_tests action for QA (static mode)...');
      await enqueueAction({
        projectId,
        type: 'run_tests',
        source: 'auto',
        taskId,
        payload: {
          qaMode: 'static' as QaMode, // Phase 96.2: Specify QA mode
          reason: 'post_task_execution',
          executedActionId: action.id,
          patchesCount: codeResponse.patches.length,
          filesChanged: codeResponse.patches.map((p) => p.path),
        } as RunTestsPayload,
      });
    }

    return NextResponse.json({
      ok: true,
      executed: true,
      actionId: action.id,
      taskId,
      summary: codeResponse.summary,
      patchesCount: codeResponse.patches.length,
      qaQueued: shouldRunQa,
    });
  } catch (codeAgentError) {
    console.error('[Auto Execute Queue] Code Agent error:', codeAgentError);

    // Increment attempts and check if should retry
    const retryInfo = await incrementActionAttempts({
      actionId: action.id,
      errorMessage: codeAgentError instanceof Error ? codeAgentError.message : 'Unknown error',
    });

    // Mark task as blocked
    await updateTaskStatus({
      projectId,
      taskId,
      status: 'blocked' as TaskStatus,
      collectionName,
    });

    // Add error message
    await projectRef.collection('agent_messages').add({
      role: 'system',
      content: `❌ Error executing task: ${task?.title}\n\n${codeAgentError instanceof Error ? codeAgentError.message : 'Unknown error'}\n\nAttempt ${retryInfo.attempts}/${retryInfo.maxAttempts}${retryInfo.shouldRetry ? ' - Will retry automatically' : ' - No more retries'}`,
      createdAt: Date.now(),
    });

    return NextResponse.json(
      {
        ok: false,
        error: codeAgentError instanceof Error ? codeAgentError.message : 'Unknown error',
        attempts: retryInfo.attempts,
        maxAttempts: retryInfo.maxAttempts,
        willRetry: retryInfo.shouldRetry,
      },
      { status: 500 }
    );
  }
}

/**
 * Phase 96.2 + 96.3: Run Tests Action - Execute QA checks on task code
 *
 * Supports different QA modes:
 * - 'static': Run tsc/lint/tests only
 * - 'ai': Run AI code review only (Phase 96.3)
 * - 'both': Run static + AI checks (Phase 96.3)
 */
async function executeRunTestsAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string,
  collectionName: string = 'ops_projects'
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing run_tests action:', action.id);

  const taskId = action.taskId;
  const payload = (action.payload || {}) as RunTestsPayload;
  const qaMode: QaMode = payload.qaMode ?? 'static';

  try {
    // 1. Get task details if available
    let task: any = null;
    if (taskId) {
      const taskSnap = await projectRef.collection('tasks').doc(taskId).get();
      if (taskSnap.exists) {
        task = { id: taskSnap.id, ...taskSnap.data() };
      }
    }

    // 2. Get recent code patches for this task (if any)
    let filesChanged: string[] = payload.filesChanged || [];
    let codePatches: { path: string; content: string }[] = [];

    if (taskId) {
      const patchesSnap = await projectRef
        .collection('code_patches')
        .where('taskId', '==', taskId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      if (!patchesSnap.empty) {
        // Extract file paths if not already provided
        if (filesChanged.length === 0) {
          filesChanged = patchesSnap.docs.map((d) => d.data().path);
        }

        // Extract code content for AI review
        codePatches = patchesSnap.docs.map((d) => ({
          path: d.data().path,
          content: d.data().newText || d.data().diff || '',
        }));
      }
    }

    const patchesInfo = filesChanged.length > 0
      ? `Files modified: ${filesChanged.slice(0, 5).join(', ')}${filesChanged.length > 5 ? ` (+${filesChanged.length - 5} more)` : ''}`
      : '';

    // 3. Execute QA using runCombinedQa (supports all modes: static, ai, both)
    console.log(`[Auto Execute Queue] Running QA with mode: ${qaMode}`);

    const qaResult = await runCombinedQa({
      projectId,
      taskId,
      filesChanged,
      qaMode,
      codePatches,
      locale: 'ar', // Default to Arabic
      runTsc: true,
      runLint: true,
      runTests: false, // Don't run full tests by default
    });

    const qaStatus: QaStatus = qaResult.ok ? 'passed' : 'failed';
    const qaReason = payload.reason || 'manual';
    const executedActionId = payload.executedActionId;

    // 4. Update action status
    await updateActionStatus({
      actionId: action.id,
      status: qaResult.ok ? 'succeeded' : 'failed',
      resultSummary: qaResult.summary,
      output: {
        qaMode,
        qaStatus,
        taskId,
        reason: qaReason,
        executedActionId,
        filesChanged,
        duration: qaResult.duration,
        overallScore: qaResult.overallScore,
        staticChecks: qaResult.static?.checks,
        aiScore: qaResult.ai?.score,
        aiIssuesCount: qaResult.ai?.issues?.length ?? 0,
      },
    });

    // 5. Update task QA status in Firestore (with details for modal)
    if (taskId) {
      await updateTaskQaStatus({
        projectId,
        taskId,
        qaStatus,
        qaSummary: qaResult.summary,
        qaDetails: qaResult.details, // Phase 96.3: Store detailed report
        qaScore: qaResult.overallScore,
        collectionName, // Use correct collection
      });
    }

    // 6. Build message content based on QA mode
    const messageLines: string[] = [
      `🧪 **QA Check Complete (${qaMode.toUpperCase()})**`,
      '',
      `**Task:** ${task?.title || 'N/A'}`,
      `**Status:** ${qaStatus === 'passed' ? '✅ Passed' : '❌ Failed'}`,
      `**Mode:** ${qaMode}`,
    ];

    if (qaResult.overallScore !== undefined) {
      messageLines.push(`**Score:** ${qaResult.overallScore}/100`);
    }

    messageLines.push('');

    if (patchesInfo) {
      messageLines.push(`**${patchesInfo}**`);
      messageLines.push('');
    }

    // Add static QA results
    if (qaResult.static) {
      messageLines.push(`**Static QA:** ${qaResult.static.ok ? '✅' : '❌'}`);
      if (qaResult.static.checks) {
        const checks = qaResult.static.checks;
        if (checks.tsc) messageLines.push(`  - TypeScript: ${checks.tsc.ok ? '✅' : `❌ ${checks.tsc.errorCount} errors`}`);
        if (checks.lint) messageLines.push(`  - ESLint: ${checks.lint.ok ? '✅' : `❌ ${checks.lint.errorCount} errors, ${checks.lint.warningCount} warnings`}`);
        if (checks.test) messageLines.push(`  - Tests: ${checks.test.ok ? '✅' : '❌'} (${checks.test.passed} passed, ${checks.test.failed} failed)`);
      }
    }

    // Add AI review results
    if (qaResult.ai) {
      messageLines.push('');
      messageLines.push(`**AI Review:** ${qaResult.ai.ok ? '✅' : '❌'} (Score: ${qaResult.ai.score ?? 0}/100)`);
      if (qaResult.ai.issues && qaResult.ai.issues.length > 0) {
        const errorCount = qaResult.ai.issues.filter(i => i.severity === 'error').length;
        const warningCount = qaResult.ai.issues.filter(i => i.severity === 'warning').length;
        const infoCount = qaResult.ai.issues.filter(i => i.severity === 'info').length;
        messageLines.push(`  - Issues: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`);
      }
    }

    messageLines.push('');
    if (qaResult.duration) {
      messageLines.push(`_Duration: ${qaResult.duration}ms_`);
    }
    messageLines.push(`_${qaReason === 'post_task_execution' ? 'Auto-triggered after task completion' : 'Manual QA check'}_`);

    await projectRef.collection('agent_messages').add({
      role: 'assistant',
      content: messageLines.join('\n'),
      createdAt: Date.now(),
      metadata: {
        source: 'qa_auto',
        taskId,
        actionId: action.id,
        qaStatus,
        qaMode,
        duration: qaResult.duration,
        overallScore: qaResult.overallScore,
      },
    });

    console.log(`[Auto Execute Queue] QA completed for task ${taskId}: ${qaStatus} (mode: ${qaMode}, score: ${qaResult.overallScore})`);

    // Phase 115.1: Trigger preview heartbeat for auto-refresh after QA
    await touchPreviewHeartbeat({
      projectId,
      reason: 'qa_completed',
    });

    return NextResponse.json({
      ok: true,
      executed: true,
      actionId: action.id,
      taskId,
      qaStatus,
      qaMode,
      message: 'QA check completed',
      duration: qaResult.duration,
      overallScore: qaResult.overallScore,
    });
  } catch (err: any) {
    const errorMessage = err?.message ?? 'Unknown error while running QA';

    console.error('[Auto Execute Queue] QA error:', errorMessage);

    // Update action as failed
    await updateActionStatus({
      actionId: action.id,
      status: 'failed',
      errorMessage,
    });

    // Update task QA status as failed
    if (taskId) {
      await updateTaskQaStatus({
        projectId,
        taskId,
        qaStatus: 'failed',
        qaSummary: `QA Check Failed: ${errorMessage}`,
        collectionName, // Use correct collection
      });
    }

    // Add error message to chat
    await projectRef.collection('agent_messages').add({
      role: 'system',
      content: `❌ **QA Check Failed (${qaMode.toUpperCase()})**\n\n${errorMessage}`,
      createdAt: Date.now(),
    });

    return NextResponse.json(
      {
        ok: false,
        executed: false,
        error: errorMessage,
        qaMode,
      },
      { status: 500 }
    );
  }
}

/**
 * Deploy Action - Deploy to hosting
 */
async function executeDeployAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing deploy action:', action.id);

  // TODO: Implement actual deployment
  // For now, mark as succeeded with placeholder

  await updateActionStatus({
    actionId: action.id,
    status: 'succeeded',
    resultSummary: 'Deployment not yet implemented',
    output: {
      environment: action.payload?.environment || 'preview',
      target: action.payload?.target || 'vercel',
    },
  });

  await projectRef.collection('agent_messages').add({
    role: 'system',
    content: `🚀 **Deploy**\n\nDeployment for project ${projectId} not yet implemented.\n\nTarget: ${action.payload?.target || 'vercel'}\nEnvironment: ${action.payload?.environment || 'preview'}\n\nAction ID: ${action.id}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    executed: true,
    actionId: action.id,
    message: 'Deployment not yet implemented',
  });
}

/**
 * Analyze Logs Action - Analyze error logs
 */
async function executeAnalyzeLogsAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing analyze_logs action:', action.id);

  // TODO: Implement actual log analysis
  // For now, mark as succeeded with placeholder

  await updateActionStatus({
    actionId: action.id,
    status: 'succeeded',
    resultSummary: 'Log analysis not yet implemented',
    output: {
      logSource: action.payload?.logSource || 'firebase',
      timeRange: action.payload?.timeRange || 'day',
    },
  });

  await projectRef.collection('agent_messages').add({
    role: 'system',
    content: `📊 **Analyze Logs**\n\nLog analysis for project ${projectId} not yet implemented.\n\nSource: ${action.payload?.logSource || 'firebase'}\nTime Range: ${action.payload?.timeRange || 'day'}\n\nAction ID: ${action.id}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    executed: true,
    actionId: action.id,
    message: 'Log analysis not yet implemented',
  });
}

/**
 * Open PR Action - Open a GitHub PR
 */
async function executeOpenPrAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing open_pr action:', action.id);

  // TODO: Implement actual PR creation
  // For now, mark as succeeded with placeholder

  await updateActionStatus({
    actionId: action.id,
    status: 'succeeded',
    resultSummary: 'PR creation not yet implemented',
    output: {
      branch: action.payload?.branch,
      baseBranch: action.payload?.baseBranch || 'main',
      title: action.payload?.title,
    },
  });

  await projectRef.collection('agent_messages').add({
    role: 'system',
    content: `🔀 **Open PR**\n\nPR creation for project ${projectId} not yet implemented.\n\nBranch: ${action.payload?.branch || 'N/A'}\nBase: ${action.payload?.baseBranch || 'main'}\n\nAction ID: ${action.id}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    executed: true,
    actionId: action.id,
    message: 'PR creation not yet implemented',
  });
}

/**
 * Git Commit Action - Create a git commit
 */
async function executeGitCommitAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing git_commit action:', action.id);

  // TODO: Implement actual git commit
  // For now, mark as succeeded with placeholder

  await updateActionStatus({
    actionId: action.id,
    status: 'succeeded',
    resultSummary: 'Git commit not yet implemented',
    output: {
      message: action.payload?.message,
    },
  });

  await projectRef.collection('agent_messages').add({
    role: 'system',
    content: `📝 **Git Commit**\n\nGit commit for project ${projectId} not yet implemented.\n\nMessage: ${action.payload?.message || 'N/A'}\n\nAction ID: ${action.id}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    executed: true,
    actionId: action.id,
    message: 'Git commit not yet implemented',
  });
}

/**
 * Git Push Action - Push to remote
 */
async function executeGitPushAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing git_push action:', action.id);

  // TODO: Implement actual git push
  // For now, mark as succeeded with placeholder

  await updateActionStatus({
    actionId: action.id,
    status: 'succeeded',
    resultSummary: 'Git push not yet implemented',
    output: {
      branch: action.payload?.branch,
      remote: action.payload?.remote || 'origin',
    },
  });

  await projectRef.collection('agent_messages').add({
    role: 'system',
    content: `⬆️ **Git Push**\n\nGit push for project ${projectId} not yet implemented.\n\nBranch: ${action.payload?.branch || 'current'}\nRemote: ${action.payload?.remote || 'origin'}\n\nAction ID: ${action.id}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    executed: true,
    actionId: action.id,
    message: 'Git push not yet implemented',
  });
}

/**
 * Send Notification Action - Send notifications
 */
async function executeSendNotificationAction(
  action: F0Action,
  projectRef: FirebaseFirestore.DocumentReference,
  projectId: string
): Promise<NextResponse> {
  console.log('[Auto Execute Queue] Executing send_notification action:', action.id);

  // TODO: Implement actual notification sending
  // For now, mark as succeeded with placeholder

  await updateActionStatus({
    actionId: action.id,
    status: 'succeeded',
    resultSummary: 'Notification sending not yet implemented',
    output: {
      channel: action.payload?.channel,
      message: action.payload?.message,
    },
  });

  await projectRef.collection('agent_messages').add({
    role: 'system',
    content: `🔔 **Send Notification**\n\nNotification for project ${projectId} not yet implemented.\n\nChannel: ${action.payload?.channel || 'N/A'}\n\nAction ID: ${action.id}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    executed: true,
    actionId: action.id,
    message: 'Notification sending not yet implemented',
  });
}
