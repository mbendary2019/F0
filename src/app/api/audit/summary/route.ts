export * from '@/app/api/dynamic';
/**
 * GET /api/audit/summary
 * Audit dashboard KPIs and metrics (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  // Require admin
  const auth = await assertAuth(req, { requireAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') || 30);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Parallel queries for better performance
    const [
      auditLogsSnapshot,
      dsarRequestsSnapshot,
      alertsSnapshot,
      deletionQueueSnapshot,
    ] = await Promise.all([
      db.collection('audit_logs').where('ts', '>=', since).get(),
      db.collection('dsar_requests').where('requestedAt', '>=', since).get(),
      db.collection('alerts').where('createdAt', '>=', since).get(),
      db.collection('deletion_queue').where('createdAt', '>=', since).get(),
    ]);

    // Process audit logs
    const auditLogs = auditLogsSnapshot.docs.map((d) => d.data());
    const auditByAction: Record<string, number> = {};
    const auditByStatus: Record<string, number> = {};
    let complianceEvents = 0;
    let securityEvents = 0;

    for (const log of auditLogs) {
      // Count by action
      auditByAction[log.action] = (auditByAction[log.action] || 0) + 1;

      // Count by status
      auditByStatus[log.status] = (auditByStatus[log.status] || 0) + 1;

      // Count compliance vs security
      if (
        log.action.startsWith('dsar.') ||
        log.action.startsWith('retention.') ||
        log.action.startsWith('export.')
      ) {
        complianceEvents++;
      } else if (
        log.action.startsWith('auth.') ||
        log.action.startsWith('mfa.') ||
        log.action.startsWith('security.')
      ) {
        securityEvents++;
      }
    }

    // Process DSAR requests
    const dsarRequests = dsarRequestsSnapshot.docs.map((d) => d.data());
    const dsarByType: Record<string, number> = {};
    const dsarByStatus: Record<string, number> = {};
    let autoApproved = 0;

    for (const req of dsarRequests) {
      dsarByType[req.type] = (dsarByType[req.type] || 0) + 1;
      dsarByStatus[req.status] = (dsarByStatus[req.status] || 0) + 1;

      if (req.metadata?.autoApproved) {
        autoApproved++;
      }
    }

    // Process alerts
    const alerts = alertsSnapshot.docs.map((d) => d.data());
    const alertsBySeverity: Record<string, number> = {};

    for (const alert of alerts) {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    }

    // Process deletion queue
    const deletions = deletionQueueSnapshot.docs.map((d) => d.data());
    const deletionsByStatus: Record<string, number> = {};

    for (const del of deletions) {
      deletionsByStatus[del.status] = (deletionsByStatus[del.status] || 0) + 1;
    }

    // Calculate daily breakdown for charts
    const dailyBreakdown: Record<string, { date: string; count: number }> = {};

    for (const log of auditLogs) {
      const date = log.ts?.toDate()?.toISOString().split('T')[0] || 'unknown';
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = { date, count: 0 };
      }
      dailyBreakdown[date].count++;
    }

    const dailyData = Object.values(dailyBreakdown).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      summary: {
        totalAuditLogs: auditLogs.length,
        totalDsarRequests: dsarRequests.length,
        totalAlerts: alerts.length,
        totalDeletions: deletions.length,
        complianceEvents,
        securityEvents,
        autoApprovedDsars: autoApproved,
      },
      breakdowns: {
        auditByAction,
        auditByStatus,
        dsarByType,
        dsarByStatus,
        alertsBySeverity,
        deletionsByStatus,
      },
      timeSeries: {
        daily: dailyData,
      },
      period: {
        days,
        since: since.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit summary' },
      { status: 500 }
    );
  }
}
