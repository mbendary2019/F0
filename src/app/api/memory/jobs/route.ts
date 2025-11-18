// =============================================================
// Phase 59 — Cognitive Memory Mesh - Jobs API
// REST endpoint for job history and monitoring
// GET: List jobs (by workspace, optional status filter)
// POST: Create new job (rebuild graph)
// =============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db, Timestamp, FieldValue } from '@/server/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseSearchParams(req: NextRequest) {
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function GET(req: NextRequest) {
  try {
    const { workspaceId, limit = '20', status } = parseSearchParams(req);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId query parameter is required' }, { status: 400 });
    }

    // Query ops_memory_jobs collection
    let query = db()
      .collection('ops_memory_jobs')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(Number(limit));

    const snapshot = await query.get();

    // Map and optionally filter by status
    let items = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Calculate duration if both timestamps exist
      let durationMs = data.durationMs;
      if (!durationMs && data.startedAt && data.finishedAt) {
        const start = data.startedAt?.toDate?.() || new Date(data.startedAt);
        const end = data.finishedAt?.toDate?.() || new Date(data.finishedAt);
        durationMs = end.getTime() - start.getTime();
      }

      return {
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
      };
    });

    // Filter by status if provided
    if (status) {
      items = items.filter((item: any) => item.status === status);
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error('[memory/jobs] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { workspaceId, type = 'rebuild_graph', ttlHours = 24 } = body || {};

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // TODO: Add authentication check
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const now = Timestamp.now();
    const expireAt = Timestamp.fromMillis(now.toMillis() + ttlHours * 3600 * 1000);

    const payload = {
      workspaceId,
      type,
      status: 'queued' as const,
      createdAt: now,
      updatedAt: now,
      expire_at: expireAt, // TTL for auto-cleanup
      metrics: null,
      progress: 0,
      startedAt: null,
      finishedAt: null,
      requestedBy: 'system', // TODO: Fill from auth session
    };

    const ref = await db().collection('ops_memory_jobs').add(payload);

    return NextResponse.json(
      {
        success: true,
        id: ref.id,
        ...payload,
        createdAt: payload.createdAt.toDate().toISOString(),
        updatedAt: payload.updatedAt.toDate().toISOString(),
        expire_at: payload.expire_at.toDate().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[memory/jobs] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
