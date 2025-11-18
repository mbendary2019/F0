/**
 * Anomaly Events API
 * Query historical anomaly events with filtering
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
    
    // Parse filters
    const metric = searchParams.get('metric');
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    let query: FirebaseFirestore.Query = db.collection('anomaly_events')
      .orderBy('ts', 'desc')
      .limit(limit);

    // Apply filters
    if (metric) {
      query = query.where('metric', '==', metric);
    }

    if (severity) {
      query = query.where('severity', '==', severity);
    }

    if (acknowledged === 'true') {
      query = query.where('acknowledged', '==', true);
    } else if (acknowledged === 'false') {
      query = query.where('acknowledged', '==', false);
    }

    if (from) {
      const tsFrom = new Date(from).getTime();
      query = query.where('ts', '>=', tsFrom);
    }

    if (to) {
      const tsTo = new Date(to).getTime() + 86399999; // End of day
      query = query.where('ts', '<=', tsTo);
    }

    // Execute query
    const snap = await query.get();

    const events = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ events }, { status: 200 });
  } catch (error: any) {
    console.error('[anomaly/events] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch events' },
      { status: error.status || 500 }
    );
  }
}

