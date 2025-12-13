/**
 * POST /api/admin/alerts/test
 * Test alert creation and notification (admin only)
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { alert } from '@/server/alerts';
import { rateLimitGuard } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitResult = await rateLimitGuard(req, {
    points: 5, // Only allow 5 test alerts per minute
  });
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
    const { severity = 'warning', message = 'Test alert from admin endpoint' } = body;

    // Validate severity
    const validSeverities = ['info', 'warning', 'critical'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity. Must be: info, warning, or critical' },
        { status: 400 }
      );
    }

    // Create test alert
    const alertId = await alert(
      {
        severity,
        kind: 'custom',
        message,
        context: {
          test: true,
          triggeredBy: auth.uid,
          timestamp: new Date().toISOString(),
        },
      },
      {
        slack: true,
        email: severity === 'critical', // Only send email for critical test alerts
      }
    );

    return NextResponse.json({
      success: true,
      alertId,
      message: 'Test alert created and notifications sent',
      notifications: {
        slack: Boolean(process.env.SLACK_WEBHOOK_URL),
        email: severity === 'critical' && Boolean(process.env.SENDGRID_API_KEY),
      },
    });
  } catch (error: any) {
    console.error('[POST /api/admin/alerts/test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create test alert' },
      { status: 500 }
    );
  }
}
