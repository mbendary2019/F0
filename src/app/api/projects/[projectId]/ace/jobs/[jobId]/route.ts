// src/app/api/projects/[projectId]/ace/jobs/[jobId]/route.ts
// =============================================================================
// Phase 150.3.6 – GET job status for polling
// =============================================================================

import { NextResponse } from 'next/server';
import { getFirestoreAdmin } from '@/lib/server/firebase';
import type { AceJob } from '@/types/ace';

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string; jobId: string } }
) {
  const { projectId, jobId } = params;

  console.log('[150.3][ACE_API] Checking job status', { projectId, jobId });

  try {
    const db = getFirestoreAdmin();

    const jobRef = db
      .collection('projects')
      .doc(projectId)
      .collection('aceJobs')
      .doc(jobId);

    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const job: AceJob = {
      id: jobDoc.id,
      ...jobDoc.data(),
    } as AceJob;

    console.log('[150.3][ACE_API] Job status', {
      jobId,
      status: job.status,
      runId: job.runId,
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error('[150.3][ACE_API] Failed to get job:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
