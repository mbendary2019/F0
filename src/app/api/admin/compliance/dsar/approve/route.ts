/**
 * POST /api/admin/compliance/dsar/approve
 * Approve a DSAR deletion request (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';
import { startDeletion } from '@/server/dsar';
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
    const { requestId, notes } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId required' }, { status: 400 });
    }

    // Get request
    const reqDoc = await db.collection('dsar_requests').doc(requestId).get();

    if (!reqDoc.exists) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const reqData = reqDoc.data()!;

    // Only allow approving pending deletion requests
    if (reqData.type !== 'deletion') {
      return NextResponse.json(
        { error: 'Only deletion requests require approval' },
        { status: 400 }
      );
    }

    if (reqData.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve request with status: ${reqData.status}` },
        { status: 400 }
      );
    }

    // Update request
    await db.collection('dsar_requests').doc(requestId).update({
      status: 'processing',
      approvedBy: adminUid,
      approvedAt: new Date(),
      adminNotes: notes,
    });

    // Start deletion process (with grace period)
    await startDeletion({
      uid: reqData.uid,
      reqId: requestId,
      reason: reqData.metadata?.reason || 'User requested account deletion',
    });

    // Audit log
    await recordAuditLog({
      uid: adminUid,
      action: 'dsar.deletion.approve',
      resource: `dsar_requests/${requestId}`,
      status: 'success',
      metadata: {
        requestId,
        targetUid: reqData.uid,
        notes,
      },
    });

    const gracePeriodDays = Number(process.env.DELETION_GRACE_PERIOD_DAYS || 30);

    return NextResponse.json({
      success: true,
      message: `Deletion approved. User ${reqData.uid} will be deleted after ${gracePeriodDays}-day grace period.`,
      gracePeriodDays,
    });
  } catch (error: any) {
    console.error('Error approving deletion request:', error);

    await recordAuditLog({
      uid: adminUid,
      action: 'dsar.deletion.approve',
      resource: 'dsar_requests',
      status: 'error',
      metadata: { error: error.message },
    });

    return NextResponse.json(
      { error: 'Failed to approve deletion request' },
      { status: 500 }
    );
  }
}
