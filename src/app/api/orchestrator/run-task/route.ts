/**
 * Phase 91.2: Run Task with Specialized Agents
 * POST /api/orchestrator/run-task
 *
 * Executes a task using the appropriate specialized agent
 * Updates task status and logs execution results
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { askAgent } from '@/lib/agents';

const db = getFirestore(adminApp);

// Agent-specific system prompts
const AGENT_PROMPTS = {
  UI_AGENT: `You are F0 UI Agent - Expert in React/Next.js UI development.

**Your Role:**
- Design beautiful, accessible UI components
- Use modern React patterns (hooks, composition)
- Apply Tailwind CSS for styling
- Follow shadcn/ui patterns when applicable
- Generate complete, production-ready code

**Output Format:**
Return a JSON object with:
{
  "files": [
    {
      "path": "src/components/ComponentName.tsx",
      "content": "// Full component code here"
    }
  ],
  "summary": "Brief description of what was created"
}

NO explanations outside JSON. Code must be complete and ready to use.`,

  DB_AGENT: `You are F0 Database Agent - Expert in database schema design.

**Your Role:**
- Design efficient, normalized database schemas
- Define Firestore collections and documents
- Specify relationships and indexes
- Include validation rules
- Consider scalability and performance

**Output Format:**
Return a JSON object with:
{
  "schema": {
    "collections": [
      {
        "name": "collectionName",
        "fields": {
          "fieldName": "type"
        },
        "indexes": [],
        "rules": ""
      }
    ]
  },
  "summary": "Schema design explanation"
}

NO explanations outside JSON.`,

  BACKEND_AGENT: `You are F0 Backend Agent - Expert in API development.

**Your Role:**
- Create REST API endpoints
- Implement business logic
- Handle authentication and authorization
- Add error handling and validation
- Generate production-ready API code

**Output Format:**
Return a JSON object with:
{
  "files": [
    {
      "path": "src/app/api/endpoint/route.ts",
      "content": "// Full API code here"
    }
  ],
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/endpoint",
      "description": ""
    }
  ],
  "summary": "API implementation summary"
}

NO explanations outside JSON. Code must be complete.`,

  IDE_AGENT: `You are F0 IDE Agent - Expert in project setup and configuration.

**Your Role:**
- Setup project structure
- Configure build tools
- Add dependencies to package.json
- Create config files (.env, tsconfig.json, etc.)
- Setup tooling (ESLint, Prettier, etc.)

**Output Format:**
Return a JSON object with:
{
  "files": [
    {
      "path": "package.json",
      "content": "{...}"
    }
  ],
  "commands": [
    "npm install package-name"
  ],
  "summary": "Setup instructions"
}

NO explanations outside JSON.`,

  DEPLOY_AGENT: `You are F0 Deploy Agent - Expert in deployment configuration.

**Your Role:**
- Create deployment configs (Vercel, Firebase, etc.)
- Setup environment variables
- Configure CI/CD pipelines
- Add deployment scripts
- Ensure production readiness

**Output Format:**
Return a JSON object with:
{
  "files": [
    {
      "path": "vercel.json",
      "content": "{...}"
    }
  ],
  "steps": [
    "Step-by-step deployment instructions"
  ],
  "summary": "Deployment configuration summary"
}

NO explanations outside JSON.`,
};

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const user = await requireUser(req);

    // 2. Parse request
    const body = await req.json();
    const { projectId, taskId } = body;

    if (!projectId || !taskId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId or taskId' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    await requireProjectOwner(user, projectId);

    console.log(`[Run Task] Executing task ${taskId} for project ${projectId}`);

    // 4. Fetch task document
    const taskRef = db
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId);

    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = taskDoc.data();

    // 5. Verify task is IN_PROGRESS
    if (task?.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Task status is ${task?.status}, expected IN_PROGRESS` },
        { status: 400 }
      );
    }

    console.log(`[Run Task] Task details: ${task.agent} - ${task.type} - ${task.title}`);

    // 6. Get agent-specific system prompt
    const agentPrompt = AGENT_PROMPTS[task.agent as keyof typeof AGENT_PROMPTS] ||
      'You are F0 Agent. Execute the task and return structured output.';

    // 7. Build user message with task context
    const userMessage = `
**Task:** ${task.title}

**Type:** ${task.type}

**Instructions:**
${task.input}

**Additional Context:**
- Project ID: ${projectId}
- Phase: ${task.phaseId}

Execute this task and return the result in the specified JSON format.
`;

    // 8. Add log entry
    await taskRef.update({
      logs: FieldValue.arrayUnion(
        `[${new Date().toISOString()}] Calling ${task.agent} with instructions`
      ),
    });

    // 9. Call specialized agent
    console.log(`[Run Task] Calling ${task.agent}...`);

    const result = await askAgent(userMessage, {
      projectId,
      lang: 'en',
    });

    const output = result.visible.trim();

    console.log(`[Run Task] Agent response length: ${output.length} characters`);

    // 10. Try to parse JSON output
    let parsedOutput = null;
    try {
      // Try to extract JSON from markdown code block
      const jsonMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsedOutput = JSON.parse(jsonMatch[1].trim());
      } else {
        parsedOutput = JSON.parse(output);
      }
    } catch (parseError) {
      console.warn('[Run Task] Could not parse output as JSON, storing as text');
      parsedOutput = { rawOutput: output };
    }

    // 11. Mark task as DONE
    await taskRef.update({
      status: 'DONE',
      completedAt: FieldValue.serverTimestamp(),
      output: parsedOutput,
      logs: FieldValue.arrayUnion(
        `[${new Date().toISOString()}] Task completed successfully`
      ),
    });

    console.log(`[Run Task] Task ${taskId} completed successfully`);

    // 12. Check if phase is complete
    await updatePhaseProgress(projectId, task.phaseId);

    // 13. Return success response
    return NextResponse.json({
      ok: true,
      taskId,
      status: 'DONE',
      output: parsedOutput,
    });

  } catch (error: any) {
    console.error('[Run Task] Error:', error);

    // Try to mark task as FAILED
    try {
      const { projectId, taskId } = await req.json();
      if (projectId && taskId) {
        const taskRef = db
          .collection('projects')
          .doc(projectId)
          .collection('tasks')
          .doc(taskId);

        await taskRef.update({
          status: 'FAILED',
          completedAt: FieldValue.serverTimestamp(),
          logs: FieldValue.arrayUnion(
            `[${new Date().toISOString()}] Task failed: ${error.message}`
          ),
        });
      }
    } catch (updateError) {
      console.error('[Run Task] Failed to update task status:', updateError);
    }

    // Handle authentication errors
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

    return NextResponse.json(
      { error: 'Task execution failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper: Update phase progress and status
 */
async function updatePhaseProgress(projectId: string, phaseId: string) {
  try {
    if (!phaseId) return;

    const phaseRef = db
      .collection('projects')
      .doc(projectId)
      .collection('phases')
      .doc(phaseId);

    const phaseDoc = await phaseRef.get();
    if (!phaseDoc.exists) return;

    const phase = phaseDoc.data();

    // Count completed tasks in this phase
    const tasksSnapshot = await db
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .where('phaseId', '==', phaseId)
      .where('status', '==', 'DONE')
      .get();

    const completedTasksCount = tasksSnapshot.size;

    // Update phase
    const updates: any = {
      completedTasksCount,
    };

    // If all tasks completed, mark phase as DONE
    if (phase?.tasksCount && completedTasksCount >= phase.tasksCount) {
      updates.status = 'DONE';
      updates.completedAt = FieldValue.serverTimestamp();
      console.log(`[Update Phase] Phase ${phaseId} completed!`);
    }

    await phaseRef.update(updates);

  } catch (error) {
    console.error('[Update Phase] Error updating phase progress:', error);
  }
}
