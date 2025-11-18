/**
 * Admin Metrics Summary API
 * Returns dashboard metrics or audit logs based on query params
 */

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getSummaryMetrics, queryAudit } from '@/lib/admin/observability';

export async function GET(req: Request) {
  await assertAdminReq();

  const { searchParams } = new URL(req.url);
  const auditMode = searchParams.get('audit') === '1';

  try {
    if (auditMode) {
      // Return audit logs with filters
      const filters = {
        action: searchParams.get('action') ?? undefined,
        actor: searchParams.get('actor') ?? undefined,
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
      };

      const audit = await queryAudit(filters);
      return Response.json({ audit }, { status: 200 });
    }

    // Return dashboard metrics
    const data = await getSummaryMetrics();
    return Response.json(data, { status: 200 });
  } catch (error) {
    console.error('[admin/metrics/summary] Error:', error);
    return Response.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

