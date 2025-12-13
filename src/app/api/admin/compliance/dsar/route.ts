export * from '@/app/api/dynamic';

/**
 * GET /api/admin/compliance/dsar
 * List all DSAR requests (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Require admin
  const auth = await assertAuth(req, { requireAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'export' | 'deletion'
    const status = searchParams.get('status');
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    let query = db.collection('dsar_requests').orderBy('requestedAt', 'desc');

    if (type) {
      query = query.where('type', '==', type) as any;
    }

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    const snapshot = await query.limit(limit).get();

    const requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        type: data.type,
        status: data.status,
        requestedAt: data.requestedAt?.toDate().toISOString(),
        processedAt: data.processedAt?.toDate().toISOString(),
        approvedBy: data.approvedBy,
        deniedBy: data.deniedBy,
        denialReason: data.denialReason,
        exportUrl: data.exportUrl,
        exportExpiresAt: data.exportExpiresAt?.toDate().toISOString(),
        metadata: data.metadata,
      };
    });

    return NextResponse.json({ requests, total: requests.length });
  } catch (error: any) {
    console.error('Error fetching DSAR requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DSAR requests' },
      { status: 500 }
    );
  }
}
