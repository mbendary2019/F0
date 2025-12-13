export * from '@/app/api/dynamic';
/**
 * GET /api/admin/alerts/list
 * List and filter alerts (admin only)
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { getRecentAlerts } from '@/server/alerts';
import { rateLimitGuard } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get recent alerts
    const alerts = await getRecentAlerts(Math.min(limit, 500));

    // Optional filters
    const severity = searchParams.get('severity');
    const kind = searchParams.get('kind');
    const status = searchParams.get('status');

    let filtered = alerts;

    if (severity) {
      filtered = filtered.filter((a) => a.severity === severity);
    }

    if (kind) {
      filtered = filtered.filter((a) => a.kind === kind);
    }

    if (status) {
      filtered = filtered.filter((a) => a.status === status);
    }

    // Calculate statistics
    const stats = {
      total: filtered.length,
      bySeverity: {
        info: filtered.filter((a) => a.severity === 'info').length,
        warning: filtered.filter((a) => a.severity === 'warning').length,
        critical: filtered.filter((a) => a.severity === 'critical').length,
      },
      byStatus: {
        open: filtered.filter((a) => a.status === 'open').length,
        ack: filtered.filter((a) => a.status === 'ack').length,
        closed: filtered.filter((a) => a.status === 'closed').length,
      },
    };

    return NextResponse.json({
      alerts: filtered,
      stats,
      filters: {
        severity: severity || null,
        kind: kind || null,
        status: status || null,
        limit,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/alerts/list] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
