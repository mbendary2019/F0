/**
 * Anomaly Detection Tuning API
 * Manage sensitivity and detection parameters
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { adminDb } from '@/lib/firebaseAdmin';

const db = adminDb;

/**
 * Get tuning configurations
 */
export async function GET(req: NextRequest) {
  try {
    await assertAdminReq();

    const snap = await db.collection('anomaly_tuning').get();

    const configs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ configs }, { status: 200 });
  } catch (error: any) {
    console.error('[anomaly/tuning GET] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch tuning configs' },
      { status: error.status || 500 }
    );
  }
}

/**
 * Save tuning configurations
 */
export async function POST(req: NextRequest) {
  try {
    await assertAdminReq();

    const { configs } = await req.json();

    if (!Array.isArray(configs)) {
      return Response.json(
        { error: 'Invalid configs format' },
        { status: 400 }
      );
    }

    // Save each config
    const batch = db.batch();

    for (const config of configs) {
      const docId = `${config.metric}_${config.window}`;
      const ref = db.collection('anomaly_tuning').doc(docId);
      
      batch.set(ref, {
        metric: config.metric,
        window: config.window,
        sensitivity: config.sensitivity,
        fusionWeights: config.fusionWeights,
        minSupport: config.minSupport,
        updatedAt: Date.now()
      }, { merge: true });
    }

    await batch.commit();

    return Response.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[anomaly/tuning POST] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to save tuning configs' },
      { status: error.status || 500 }
    );
  }
}

