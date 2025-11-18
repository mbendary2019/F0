/**
 * POST /api/admin/compliance/dsar/deny
 * Deny a DSAR deletion request (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/server/audit';

export async function POST(req: NextRequest) {
  // Require admin
  const auth = await assertAuth(req, { requireAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminUid = auth.uid!;

  try {
    const body = await req.json();
    const { requestId, reason } = body;

    if (!requestId || !reason) {
      return NextResponse.json(
        { error: 'requestId and reason required' },
        { status: 400 }
      );
    }

    // Get request
    const reqDoc = await db.collection('dsar_requests').doc(requestId).get();

    if (!reqDoc.exists) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const reqData = reqDoc.data()!;

    if (reqData.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot deny request with status: ${reqData.status}` },
        { status: 400 }
      );
    }

    // Update request
    await db.collection('dsar_requests').doc(requestId).update({
      status: 'denied',
      deniedBy: adminUid,
      deniedAt: new Date(),
      denialReason: reason,
    });

    // Audit log
    await recordAuditLog({
      uid: adminUid,
      action: 'dsar.deletion.deny',
      resource: `dsar_requests/${requestId}`,
      status: 'success',
      metadata: {
        requestId,
        targetUid: reqData.uid,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Deletion request denied',
    });
  } catch (error: any) {
    console.error('Error denying deletion request:', error);

    await recordAuditLog({
      uid: adminUid,
      action: 'dsar.deletion.deny',
      resource: 'dsar_requests',
      status: 'error',
      metadata: { error: error.message },
    });

    return NextResponse.json(
      { error: 'Failed to deny deletion request' },
      { status: 500 }
    );
  }
}
