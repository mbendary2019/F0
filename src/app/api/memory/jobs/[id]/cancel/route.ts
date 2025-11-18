// =============================================================
// Phase 59 — Cognitive Memory Mesh - Job Cancel API
// POST: Cancel a running or queued job
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/server/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // TODO: Add authentication check
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const ref = db().collection('ops_memory_jobs').doc(jobId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const data = snap.data() as any;

    // Check if job can be cancelled
    if (['finished', 'failed', 'cancelled'].includes(data.status)) {
      return NextResponse.json({
        success: true,
        message: `Job already in terminal state: ${data.status}`,
        status: data.status,
      });
    }

    // Cancel the job
    await ref.update({
      status: 'cancelled',
      updatedAt: FieldValue.serverTimestamp(),
      finishedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      status: 'cancelled',
    });
  } catch (error: any) {
    console.error('[memory/jobs/:id/cancel] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
