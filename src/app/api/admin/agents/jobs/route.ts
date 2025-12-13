/**
 * Agent Jobs API
 * CRUD operations for agent job queue
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';
import { auditAdmin } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

const JobSchema = z.object({
  kind: z.enum(['predict', 'remediate', 'report', 'guard']),
  payload: z.record(z.string(), z.any()).default({}),
});

/**
 * GET /api/admin/agents/jobs
 * List recent agent jobs
 */
export async function GET() {
  await assertAdminReq();

  try {
    const db = getFirestore();
    
    const snap = await db
      .collection('agent_jobs')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const jobs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ jobs }, { status: 200 });

  } catch (error) {
    console.error('[AgentJobs GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/agents/jobs
 * Create new agent job
 */
export async function POST(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const body = await req.json();
    const validated = JobSchema.parse(body);

    const db = getFirestore();

    // Create job
    const doc = await db.collection('agent_jobs').add({
      ...validated,
      status: 'queued',
      createdAt: Date.now(),
      requestedBy: uid
    });

    // Log to audit
    await auditAdmin('agent_job_created', uid, undefined, {
      jobId: doc.id,
      kind: validated.kind,
      action: validated.payload['action']
    }, req);

    return Response.json(
      { ok: true, id: doc.id },
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[AgentJobs POST] Error:', error);
    return Response.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/agents/jobs?id=xxx
 * Cancel/delete a job
 */
export async function DELETE(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return Response.json(
        { error: 'Job ID required' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const jobRef = db.collection('agent_jobs').doc(jobId);
    const job = await jobRef.get();

    if (!job.exists) {
      return Response.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Only allow deleting queued jobs
    if (job.data()?.status !== 'queued') {
      return Response.json(
        { error: 'Can only cancel queued jobs' },
        { status: 400 }
      );
    }

    await jobRef.update({
      status: 'rejected',
      error: 'Cancelled by admin',
      updatedAt: Date.now()
    });

    // Log to audit
    await auditAdmin('agent_job_cancelled', uid, undefined, {
      jobId
    }, req);

    return Response.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error('[AgentJobs DELETE] Error:', error);
    return Response.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}

