/**
 * Phase 103: F0 JSON Processor
 * Processes [F0_JSON] output from Agent and creates:
 * - Project phases
 * - Project tasks
 * - Project memory (Phase 94.3: structured memory sections)
 * - Queues next_actions for execution
 *
 * UPDATED: Uses saveProjectPlan with:
 * - Stable IDs (phase-1, phase-2, etc.) to avoid duplicates
 * - Status protection (preserves in_progress/completed tasks)
 * - No deletion of existing work
 *
 * Phase 94.3: Added structured memory support
 * - Initializes memory sections from F0_JSON (AGREED_SCOPE, TECH_STACK)
 * - Applies memory_updates from agent responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreAdmin } from '@/lib/server/firebase';
import { saveProjectPlan, type AgentPhase, type AgentTask } from '@/lib/server/projectPlan';
import {
  initializeMemoryFromF0Json,
  applyMemoryUpdatesFromJson,
  type MemoryUpdateJson,
} from '@/lib/server/projectMemory';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

interface F0JsonPhase {
  id: string;
  title: string;
  goals?: string[];
  features: string[];
  risks?: string[];
}

interface F0JsonNextAction {
  type: 'preflight' | 'execute_task';
  phase?: string;
  taskId?: string;
  taskTitle?: string;
}

interface F0JsonInput {
  projectId: string;
  lang: 'ar' | 'en';
  intent: 'plan' | 'continue' | 'refine';
  summary: string;
  target_users?: string[];
  platforms?: string[];
  clarity_score?: number;
  assumptions?: {
    frontend?: string;
    backend?: string;
    db?: string;
    auth?: string;
    payments?: string;
    realtime_data?: string;
  };
  phases: F0JsonPhase[];
  next_actions?: F0JsonNextAction[];
  memory_updates?: MemoryUpdateJson[]; // Phase 94.3: structured memory updates
  useOpsCollection?: boolean; // Phase 93.5: write to ops_projects instead of projects
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as F0JsonInput;

    // Phase 93.5: Choose collection based on toggle
    const collectionName = body.useOpsCollection ? 'ops_projects' : 'projects';

    console.log('[f0/process-json] Received:', {
      projectId: body.projectId,
      intent: body.intent,
      phasesCount: body.phases?.length,
      collection: collectionName,
    });

    if (!body.projectId || !body.phases) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId or phases' },
        { status: 400 }
      );
    }

    const db = getFirestoreAdmin();
    const projectId = body.projectId;

    // 1️⃣ Update Project Memory (legacy format for backward compatibility)
    console.log(`[f0/process-json] Updating project memory in ${collectionName}...`);

    const projectRef = db.collection(collectionName).doc(projectId);

    await projectRef.set(
      {
        memory: {
          summary: body.summary,
          target_users: body.target_users || [],
          platforms: body.platforms || [],
          clarity_score: body.clarity_score || 1.0,
          assumptions: body.assumptions || {},
          lastUpdated: Date.now(),
        },
      },
      { merge: true }
    );

    // 1.5️⃣ Phase 94.3: Initialize structured memory sections
    console.log('[f0/process-json] Initializing structured memory sections...');
    await initializeMemoryFromF0Json({
      projectId,
      summary: body.summary,
      target_users: body.target_users,
      platforms: body.platforms,
      assumptions: body.assumptions,
      collectionName,
    });

    // 1.6️⃣ Phase 94.3: Apply any explicit memory_updates from agent
    if (body.memory_updates && body.memory_updates.length > 0) {
      console.log(`[f0/process-json] Applying ${body.memory_updates.length} memory updates...`);
      await applyMemoryUpdatesFromJson({
        projectId,
        updates: body.memory_updates,
        updatedBy: 'agent',
        collectionName,
      });
    }

    // 2️⃣ + 3️⃣ Create/Update Phases and Tasks using saveProjectPlan
    // This uses stable IDs and preserves status of in-progress/completed work
    console.log('[f0/process-json] Saving plan with stable IDs and status protection...');

    // Convert F0JsonPhases to AgentPhases
    const agentPhases: AgentPhase[] = body.phases.map((phase, index) => ({
      id: `phase-${index + 1}`, // Stable ID
      index: index + 1,
      title: phase.title,
    }));

    // Convert features to AgentTasks
    const agentTasks: AgentTask[] = [];
    body.phases.forEach((phase, phaseIndex) => {
      const phaseId = `phase-${phaseIndex + 1}`;
      phase.features.forEach((feature, featureIndex) => {
        agentTasks.push({
          id: `${phaseId}-task-${featureIndex + 1}`, // Stable ID
          phaseId,
          title: feature,
          description: `Implement: ${feature}`,
          mode: 'refactor',
          priority: featureIndex === 0 ? 'high' : 'medium',
          difficulty: 'medium',
        });
      });
    });

    // Save using the smart update function (preserves existing status)
    await saveProjectPlan({
      projectId,
      phases: agentPhases,
      tasks: agentTasks,
      collectionName, // Pass collection name
    });

    console.log(`[f0/process-json] Saved ${agentPhases.length} phases and ${agentTasks.length} tasks (smart update)`);

    // Also save extra phase metadata (goals, features, risks) that saveProjectPlan doesn't handle
    const phaseMetadataPromises = body.phases.map(async (phase, index) => {
      const phaseId = `phase-${index + 1}`;
      const phaseRef = projectRef.collection('phases').doc(phaseId);

      await phaseRef.set(
        {
          goals: phase.goals || [],
          features: phase.features || [],
          risks: phase.risks || [],
        },
        { merge: true }
      );
    });

    await Promise.all(phaseMetadataPromises);

    // 4️⃣ Queue Next Actions
    console.log('[f0/process-json] Queuing next actions...');

    if (body.next_actions && body.next_actions.length > 0) {
      const actionsRef = projectRef.collection('queued_actions');

      const actionPromises = body.next_actions.map(async (action, index) => {
        const actionId = `action_${Date.now()}_${index}`;

        // Try to find taskId from taskTitle if not provided
        let taskId = action.taskId;
        if (!taskId && action.taskTitle && action.phase) {
          // Search for the task by title and phase
          const tasksSnap = await projectRef
            .collection('tasks')
            .where('phaseId', '==', action.phase)
            .where('title', '==', action.taskTitle)
            .limit(1)
            .get();

          if (!tasksSnap.empty) {
            taskId = tasksSnap.docs[0].id;
          }
        }

        await actionsRef.doc(actionId).set({
          id: actionId,
          type: action.type,
          phaseId: action.phase || null, // Renamed to phaseId for consistency, handle undefined
          taskId: taskId || null,
          taskTitle: action.taskTitle || null,
          status: 'pending',
          createdAt: Date.now(),
        });
      });

      await Promise.all(actionPromises);

      console.log(`[f0/process-json] Queued ${body.next_actions.length} actions`);
    }

    // 5️⃣ Update Project Metadata
    await projectRef.set(
      {
        lastProcessedAt: Date.now(),
        hasPhases: true,
        hasTasks: true,
        projectType: body.platforms?.includes('web') ? 'web-app' : 'mixed',
        platforms: body.platforms || [],
      },
      { merge: true }
    );

    console.log(`[f0/process-json] Processing complete ✅ (collection: ${collectionName})`);

    return NextResponse.json({
      ok: true,
      projectId,
      collection: collectionName,
      phasesCreated: body.phases.length,
      tasksCreated: agentTasks.length,
      actionsQueued: body.next_actions?.length || 0,
      memoryUpdatesApplied: body.memory_updates?.length || 0,
    });
  } catch (err: any) {
    console.error('[f0/process-json] Error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error in f0/process-json',
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
