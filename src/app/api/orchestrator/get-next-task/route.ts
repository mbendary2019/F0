/**
 * Phase 91.1: Get Next Pending Task
 * POST /api/orchestrator/get-next-task
 *
 * Fetches the next NEW task from Firestore and marks it as IN_PROGRESS
 * Returns null if no pending tasks exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';

const db = getFirestore(adminApp);

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const user = await requireUser(req);

    // 2. Parse request
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    await requireProjectOwner(user, projectId);

    console.log(`[Get Next Task] Fetching next task for project ${projectId}`);

    // 4. Query for next NEW task (ordered by creation time)
    const tasksRef = db
      .collection('projects')
      .doc(projectId)
      .collection('tasks');

    const snapshot = await tasksRef
      .where('status', '==', 'NEW')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    // 5. No pending tasks
    if (snapshot.empty) {
      console.log(`[Get Next Task] No pending tasks found`);
      return NextResponse.json({ task: null });
    }

    // 6. Get task document
    const taskDoc = snapshot.docs[0];
    const task = taskDoc.data();

    console.log(`[Get Next Task] Found task: ${task.id} (${task.title})`);

    // 7. Mark task as IN_PROGRESS atomically
    await taskDoc.ref.update({
      status: 'IN_PROGRESS',
      startedAt: FieldValue.serverTimestamp(),
      logs: FieldValue.arrayUnion(
        `[${new Date().toISOString()}] Task started by orchestrator`
      ),
    });

    // 8. Update phase status to IN_PROGRESS if not already
    if (task.phaseId) {
      const phaseRef = db
        .collection('projects')
        .doc(projectId)
        .collection('phases')
        .doc(task.phaseId);

      const phaseDoc = await phaseRef.get();
      if (phaseDoc.exists && phaseDoc.data()?.status === 'PENDING') {
        await phaseRef.update({
          status: 'IN_PROGRESS',
          startedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[Get Next Task] Phase ${task.phaseId} started`);
      }
    }

    // 9. Return task with project context
    return NextResponse.json({
      task: {
        ...task,
        projectId, // Include project context
      },
    });

  } catch (error: any) {
    console.error('[Get Next Task] Error:', error);

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
