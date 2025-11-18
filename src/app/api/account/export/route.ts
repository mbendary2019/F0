/**
 * POST /api/account/export
 * Request user data export (GDPR DSAR)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';
import { canRequestExport } from '@/server/dsar';
import { recordAuditLog } from '@/server/audit';

export async function POST(req: NextRequest) {
  // Authenticate user
  const auth = await assertAuth(req, { requireActive: false });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const uid = auth.uid!;

  try {
    // Check cooldown period
    const canRequest = await canRequestExport(uid);
    if (!canRequest.allowed) {
      return NextResponse.json(
        { error: canRequest.reason },
        { status: 429 }
      );
    }

    // Create DSAR request
    const reqId = db.collection('dsar_requests').doc().id;
    await db.collection('dsar_requests').doc(reqId).create({
      id: reqId,
      uid,
      type: 'export',
      status: 'pending',
      requestedAt: new Date(),
    });

    // Audit log
    await recordAuditLog({
      uid,
      action: 'dsar.export.request',
      resource: `dsar_requests/${reqId}`,
      status: 'success',
      metadata: { requestId: reqId },
    });

    return NextResponse.json({
      requestId: reqId,
      status: 'pending',
      message: 'Your data export request has been received. You will receive a download link shortly.',
    });
  } catch (error: any) {
    console.error('Error creating export request:', error);

    await recordAuditLog({
      uid,
      action: 'dsar.export.request',
      resource: 'dsar_requests',
      status: 'error',
      metadata: { error: error.message },
    });

    return NextResponse.json(
      { error: 'Failed to create export request' },
      { status: 500 }
    );
  }
}
