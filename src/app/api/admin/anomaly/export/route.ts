/**
 * Anomaly Events Export API
 * Export anomaly events as CSV
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

// CSV conversion helper
function toCSV(rows: any[]) {
  if (!rows.length) return 'id,ts,timestamp,metric,window,score,severity,reason,acknowledged\n';
  const headers = ['id','ts','timestamp','metric','window','score','severity','reason','acknowledged'];
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => esc((r as any)[h])).join(','));
  return lines.join('\n');
}

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

    // Build query
    let query: FirebaseFirestore.Query = db.collection('anomaly_events')
      .orderBy('ts', 'desc')
      .limit(1000);

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
      const tsTo = new Date(to).getTime() + 86399999;
      query = query.where('ts', '<=', tsTo);
    }

    // Execute query
    const snap = await query.get();

    const events = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ts: data.ts,
        timestamp: new Date(data.ts).toISOString(),
        metric: data.metric,
        window: data.window,
        score: data.score,
        severity: data.severity,
        reason: data.reason,
        acknowledged: data.acknowledged || false
      };
    });

    // Convert to CSV
    const csv = toCSV(events);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="anomaly_events_${Date.now()}.csv"`
      }
    });
  } catch (error: any) {
    console.error('[anomaly/export] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to export events' },
      { status: error.status || 500 }
    );
  }
}

