/**
 * Phase 90.2: Save Project Plan to Firestore
 * POST /api/agent/save-plan
 *
 * Saves generated project plan (phases + tasks) to Firestore
 * for tracking, execution, and real-time progress monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import type { ProjectPlan, Phase, Task } from '../plan-project/route';

const db = adminDb;

// Phase 90.2: Firestore document types
export interface PhaseDocument {
  id: string;
  title: string;
  order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  createdAt: FirebaseFirestore.Timestamp;
  startedAt?: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
  tasksCount: number;
  completedTasksCount: number;
}

export interface TaskDocument {
  id: string;
  phaseId: string;
  title: string;
  agent: 'UI_AGENT' | 'DB_AGENT' | 'IDE_AGENT' | 'BACKEND_AGENT' | 'DEPLOY_AGENT';
  type: string;
  input: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  logs: string[];
  output?: any;
  createdAt: FirebaseFirestore.Timestamp;
  startedAt?: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const user = await requireUser(req);

    // 2. Parse request body
    const body = await req.json();
    const { projectId, plan } = body as {
      projectId: string;
      plan: ProjectPlan;
    };

    if (!projectId || !plan?.phases) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId or plan.phases' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    await requireProjectOwner(user, projectId);

    console.log(`[Save Plan] Saving plan for project ${projectId} with ${plan.phases.length} phases`);

    // 4. Get project reference
    const projectRef = db.collection('projects').doc(projectId);

    // Verify project exists
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 5. Use batched write for atomic operation
    const batch = db.batch();

    let totalTasksCount = 0;

    // 6. Save each phase and its tasks
    for (const phase of plan.phases) {
      const phaseRef = projectRef.collection('phases').doc(phase.id);

      const phaseDoc: PhaseDocument = {
        id: phase.id,
        title: phase.title,
        order: phase.order,
        status: 'PENDING',
        createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
        tasksCount: phase.tasks.length,
        completedTasksCount: 0,
      };

      batch.set(phaseRef, phaseDoc);

      console.log(`[Save Plan] Phase ${phase.id}: ${phase.tasks.length} tasks`);

      // Save tasks for this phase
      for (const task of phase.tasks) {
        const taskRef = projectRef.collection('tasks').doc(task.id);

        const taskDoc: TaskDocument = {
          id: task.id,
          phaseId: phase.id,
          title: task.title,
          agent: task.agent,
          type: task.type,
          input: task.input,
          status: 'NEW',
          logs: [],
          createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
        };

        batch.set(taskRef, taskDoc);
        totalTasksCount++;
      }
    }

    // 7. Update project document with plan metadata
    batch.update(projectRef, {
      hasPlan: true,
      planGeneratedAt: FieldValue.serverTimestamp(),
      phasesCount: plan.phases.length,
      tasksCount: totalTasksCount,
      planStatus: 'PENDING', // PENDING, IN_PROGRESS, COMPLETED, FAILED
    });

    // 8. Commit batch
    await batch.commit();

    console.log(`[Save Plan] Successfully saved ${plan.phases.length} phases and ${totalTasksCount} tasks`);

    // 9. Return success response
    return NextResponse.json({
      ok: true,
      saved: {
        phases: plan.phases.length,
        tasks: totalTasksCount,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Save Plan] Error:', error);

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
