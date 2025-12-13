/**
 * GET /api/account/export/status
 * Check status of user's data export requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Authenticate user
  const auth = await assertAuth(req, { requireActive: false });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const uid = auth.uid!;

  try {
    // Get all export requests for user
    const requestsSnapshot = await db
      .collection('dsar_requests')
      .where('uid', '==', uid)
      .where('type', '==', 'export')
      .orderBy('requestedAt', 'desc')
      .limit(10)
      .get();

    const requests = requestsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        requestedAt: data.requestedAt?.toDate().toISOString(),
        processedAt: data.processedAt?.toDate().toISOString(),
        exportUrl: data.exportUrl,
        exportExpiresAt: data.exportExpiresAt?.toDate().toISOString(),
      };
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Error fetching export status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export status' },
      { status: 500 }
    );
  }
}
