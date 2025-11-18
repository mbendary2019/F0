/**
 * Admin Audit Export API
 * Exports audit logs as CSV
 */

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { queryAudit } from '@/lib/admin/observability';
import { toCSV } from '@/lib/admin/csv';

export async function GET(req: Request) {
  await assertAdminReq();

  const { searchParams } = new URL(req.url);
  
  try {
    const filters = {
      action: searchParams.get('action') ?? undefined,
      actor: searchParams.get('actor') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    };

    const audit = await queryAudit(filters);
    const csv = toCSV(audit);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `audit_export_${timestamp}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[admin/audit/export] Error:', error);
    return new Response('Failed to export audit logs', { status: 500 });
  }
}

