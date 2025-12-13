/**
 * POST /api/account/delete
 * Request account deletion (GDPR Right to be Forgotten)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/server/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Authenticate user
  const auth = await assertAuth(req, { requireActive: false });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const uid = auth.uid!;

  try {
    const body = await req.json();
    const { reason, confirmation } = body;

    // Require explicit confirmation
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return NextResponse.json(
        { error: 'Please type "DELETE MY ACCOUNT" to confirm' },
        { status: 400 }
      );
    }

    // Check for existing pending deletion requests
    const existingRequest = await db
      .collection('dsar_requests')
      .where('uid', '==', uid)
      .where('type', '==', 'deletion')
      .where('status', 'in', ['pending', 'approved'])
      .limit(1)
      .get();

    if (!existingRequest.empty) {
      return NextResponse.json(
        { error: 'You already have a pending deletion request' },
        { status: 409 }
      );
    }

    // Create DSAR deletion request (requires admin approval)
    const reqId = db.collection('dsar_requests').doc().id;
    await db.collection('dsar_requests').doc(reqId).create({
      id: reqId,
      uid,
      type: 'deletion',
      status: 'pending',
      requestedAt: new Date(),
      metadata: {
        reason: reason || 'User requested account deletion',
        userConfirmation: confirmation,
      },
    });

    // Audit log
    await recordAuditLog({
      uid,
      action: 'dsar.deletion.request',
      resource: `dsar_requests/${reqId}`,
      status: 'success',
      metadata: { requestId: reqId, reason },
    });

    const gracePeriodDays = Number(process.env.DELETION_GRACE_PERIOD_DAYS || 30);

    return NextResponse.json({
      requestId: reqId,
      status: 'pending',
      message: `Your account deletion request has been submitted for review. If approved, your account will be permanently deleted after a ${gracePeriodDays}-day grace period.`,
      gracePeriodDays,
    });
  } catch (error: any) {
    console.error('Error creating deletion request:', error);

    await recordAuditLog({
      uid,
      action: 'dsar.deletion.request',
      resource: 'dsar_requests',
      status: 'error',
      metadata: { error: error.message },
    });

    return NextResponse.json(
      { error: 'Failed to create deletion request' },
      { status: 500 }
    );
  }
}
