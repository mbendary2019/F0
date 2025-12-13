/**
 * POST /api/admin/alerts/acknowledge
 * Acknowledge an alert (admin only)
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { acknowledgeAlert } from '@/server/alerts';
import { rateLimitGuard } from '@/server/rate-limit';
import { auditLog } from '@/server/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitResult = await rateLimitGuard(req);
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: rateLimitResult.error },
      { status: rateLimitResult.status }
    );
  }

  // Authentication with admin check
  const auth = await assertAuth(req, { requireActive: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Check if user has admin claim
  if (!auth.claims.admin) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'Missing alertId' },
        { status: 400 }
      );
    }

    // Acknowledge the alert
    await acknowledgeAlert(alertId, auth.uid!);

    // Audit log
    await auditLog({
      uid: auth.uid!,
      action: 'alert.acknowledge',
      resourceType: 'alert',
      resourceId: alertId,
      metadata: {},
      ipAddress:
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      alertId,
      acknowledgedBy: auth.uid,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/alerts/acknowledge] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
