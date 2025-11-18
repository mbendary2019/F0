/**
 * Anomaly Insights API
 * Returns recent insights from anomaly detection
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

export async function GET(req: NextRequest) {
  try {
    await assertAdminReq();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const severity = searchParams.get('severity') as 'low' | 'medium' | 'high' | null;

    // Build query
    let query = db.collection('anomaly_events')
      .orderBy('ts', 'desc')
      .limit(limit);

    if (severity) {
      query = query.where('severity', '==', severity) as any;
    }

    const snap = await query.get();

    const insights = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.insight?.title || `${data.metric} anomaly`,
        severity: data.severity || 'low',
        description: data.insight?.description || data.reason,
        possibleCauses: data.insight?.causes || [],
        suggestedActions: data.insight?.actions || [],
        metric: data.metric,
        window: data.window,
        score: data.score,
        ts: data.ts,
        acknowledged: data.acknowledged || false
      };
    });

    return Response.json({ insights }, { status: 200 });
  } catch (error: any) {
    console.error('[anomaly/insights] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch insights' },
      { status: error.status || 500 }
    );
  }
}

/**
 * Acknowledge an insight
 */
export async function POST(req: NextRequest) {
  try {
    await assertAdminReq();

    const { id } = await req.json();

    if (!id) {
      return Response.json(
        { error: 'Missing insight ID' },
        { status: 400 }
      );
    }

    await db.collection('anomaly_events').doc(id).update({
      acknowledged: true,
      acknowledgedAt: Date.now()
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[anomaly/insights POST] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to acknowledge insight' },
      { status: error.status || 500 }
    );
  }
}

