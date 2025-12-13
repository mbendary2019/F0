// src/app/api/projects/[projectId]/ace/run/route.ts
// =============================================================================
// Phase 150.3.6 – POST trigger a new ACE Job (executed by Desktop)
// =============================================================================

import { NextResponse } from 'next/server';
import { getFirestoreAdmin } from '@/lib/server/firebase';
import type { AceJob, TriggerAceRunRequest, TriggerAceJobResponse } from '@/types/ace';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;

  let body: TriggerAceRunRequest = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine
  }

  const mode = body.mode ?? 'guided';

  console.log('[150.3][ACE_API] Creating ACE job', { projectId, mode });

  try {
    const db = getFirestoreAdmin();
    const now = new Date().toISOString();

    // Create job document
    const jobRef = db
      .collection('projects')
      .doc(projectId)
      .collection('aceJobs')
      .doc();

    const job: Omit<AceJob, 'id'> = {
      type: mode,
      source: 'web',
      status: 'pending',
      createdAt: now,
      environment: 'desktop',
      notes: 'Triggered from Web IDE /live page',
      runId: null,
      error: null,
      startedAt: null,
      completedAt: null,
    };

    await jobRef.set(job);

    console.log('[150.3][ACE_API] ACE job created', {
      projectId,
      jobId: jobRef.id,
      status: 'pending',
    });

    const response: TriggerAceJobResponse = {
      jobId: jobRef.id,
      status: 'pending',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[150.3][ACE_API] Failed to create job:', error);
    return NextResponse.json(
      { error: 'Failed to create ACE job' },
      { status: 500 }
    );
  }
}
