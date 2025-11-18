// =============================================================
// Phase 59 — Cognitive Memory Mesh - Job Detail API
// GET: Retrieve single job by ID
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const doc = await db().collection('ops_memory_jobs').doc(jobId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const data = doc.data()!;

    // Calculate duration if both timestamps exist
    let durationMs = data.durationMs;
    if (!durationMs && data.startedAt && data.finishedAt) {
      const start = data.startedAt?.toDate?.() || new Date(data.startedAt);
      const end = data.finishedAt?.toDate?.() || new Date(data.finishedAt);
      durationMs = end.getTime() - start.getTime();
    }

    return NextResponse.json({
      success: true,
      job: {
        id: doc.id,
        workspaceId: data.workspaceId,
        type: data.type || 'rebuild_graph',
        status: data.status || 'queued',
        progress: data.progress || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt || null,
        finishedAt: data.finishedAt?.toDate?.()?.toISOString() || data.finishedAt || null,
        durationMs,
        metrics: data.metrics || null,
        requestedBy: data.requestedBy || 'system',
        errorMessage: data.errorMessage || null,
      },
    });
  } catch (error: any) {
    console.error('[memory/jobs/:id] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
