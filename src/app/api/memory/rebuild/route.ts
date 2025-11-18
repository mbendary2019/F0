// =============================================================
// Phase 59 — Cognitive Memory Mesh - Rebuild API
// REST endpoint for triggering graph rebuild
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { buildEdgesForWorkspace } from '@/lib/memory/linkBuilder';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  let jobDoc: any = null;

  try {
    const body = await req.json();
    const { workspaceId, options } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // TODO: Add authentication check here
    // const session = await getServerSession();
    // if (!session?.user?.isAdmin) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    // }

    // Create job log entry
    jobDoc = db.collection('ops_memory_jobs').doc(jobId);
    await jobDoc.set({
      workspaceId,
      status: 'running',
      startedAt: new Date(),
      options: options || null,
    });

    // Execute rebuild
    const result = await buildEdgesForWorkspace(workspaceId, options);

    // Calculate duration
    const durationMs = Date.now() - startTime;
    const totalEdges = (result.semantic || 0) + (result.temporal || 0) + (result.feedback || 0);

    // Update job log with success
    await jobDoc.update({
      status: 'success',
      endedAt: new Date(),
      durationMs,
      counts: {
        semantic: result.semantic || 0,
        temporal: result.temporal || 0,
        feedback: result.feedback || 0,
        totalEdges,
      },
    });

    return NextResponse.json({
      success: true,
      workspaceId,
      result,
      jobId,
      durationMs,
    });
  } catch (error: any) {
    console.error('[memory/rebuild] Error:', error);

    // Update job log with error
    if (jobDoc) {
      try {
        await jobDoc.update({
          status: 'error',
          endedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage: error.message || 'Unknown error',
        });
      } catch (logError) {
        console.error('[memory/rebuild] Failed to log error:', logError);
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      endpoint: '/api/memory/rebuild',
      method: 'POST',
      description: 'Rebuild memory graph for a workspace',
      note: 'Admin access required (not enforced in this implementation)',
      parameters: {
        workspaceId: 'string (required)',
        options: {
          semantic: {
            threshold: 'number (optional, default 0.85)',
            maxNeighbors: 'number (optional, default 12)',
          },
          temporal: {
            halfLifeDays: 'number (optional, default 21)',
          },
          feedback: {
            minWeight: 'number (optional, default 0.2)',
          },
          ttlDays: 'number (optional, default 90)',
        },
      },
      example: {
        workspaceId: 'workspace_123',
        options: {
          semantic: { threshold: 0.85, maxNeighbors: 12 },
          temporal: { halfLifeDays: 21 },
          ttlDays: 90,
        },
      },
    },
    { status: 200 }
  );
}
