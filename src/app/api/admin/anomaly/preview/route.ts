/**
 * Anomaly Detection Preview API
 * Test detectors on recent data without storing results
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

// Import detector functions (will need to be available on server)
// For now, we'll return a placeholder response

export async function GET(req: NextRequest) {
  try {
    await assertAdminReq();

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric') || 'errors';
    const window = searchParams.get('window') || '5m';
    const sensitivity = parseInt(searchParams.get('sensitivity') || '3');

    // Parse window to milliseconds
    const windowMs = window === '1m' ? 60_000 :
                     window === '5m' ? 5 * 60_000 :
                     15 * 60_000;

    const now = Date.now();
    const since = now - windowMs;

    // Fetch recent data
    const snap = await db
      .collection('admin_audit')
      .where('ts', '>=', since)
      .orderBy('ts')
      .get();

    // Bucket by minute
    const buckets = new Map<number, number>();
    snap.docs.forEach(doc => {
      const ts = doc.get('ts');
      const bucket = Math.floor(ts / 60_000) * 60_000;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });

    const points = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t, v }));

    // For preview, just return the data points
    // In production, this would run the detectors
    return Response.json({
      metric,
      window,
      sensitivity,
      points,
      dataPoints: points.length,
      preview: {
        message: 'Detector preview - would run Z-Score and EWMA here',
        sufficient: points.length >= 8,
        lastValue: points[points.length - 1]?.v ?? null
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('[anomaly/preview] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to preview detection' },
      { status: error.status || 500 }
    );
  }
}

