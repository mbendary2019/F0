// src/app/api/agents/audit-logs/route.ts
// =============================================================================
// Phase 156.5 – Audit Logs API Route
// GET: Get audit logs and stats for a project
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory audit log store (for development)
// In production, this would use Firestore
interface AuditLogEntry {
  id: string;
  projectId: string;
  userId?: string;
  actionType: 'shell' | 'browser' | 'git' | 'code' | 'fix';
  payloadSummary: string;
  riskLevel: 'low' | 'medium' | 'high';
  decision: 'approved' | 'rejected' | 'blocked' | 'auto';
  decidedBy: 'user' | 'policy' | 'system';
  planId?: string;
  createdAt: string;
  decidedAt?: string;
  reason?: string;
}

// Global in-memory store for development
declare global {
  // eslint-disable-next-line no-var
  var __auditLogStore: AuditLogEntry[] | undefined;
}

function getAuditLogStore(): AuditLogEntry[] {
  if (!global.__auditLogStore) {
    global.__auditLogStore = [];
  }
  return global.__auditLogStore;
}

export function addAuditLog(entry: Omit<AuditLogEntry, 'id'>): string {
  const store = getAuditLogStore();
  const id = `audit_${Math.random().toString(36).slice(2, 10)}`;
  const fullEntry: AuditLogEntry = {
    ...entry,
    id,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  store.push(fullEntry);
  console.log('[156.5][AUDIT] Added log:', id, entry.decision, entry.actionType);
  return id;
}

export async function GET(request: NextRequest) {
  console.log('[156.5][API] GET /api/agents/audit-logs');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    const store = getAuditLogStore();

    // Filter by projectId and sort by createdAt desc
    const projectLogs = store
      .filter((log) => log.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    // Calculate stats
    const allProjectLogs = store.filter((log) => log.projectId === projectId);
    const stats = {
      approved: allProjectLogs.filter((l) => l.decision === 'approved').length,
      rejected: allProjectLogs.filter((l) => l.decision === 'rejected').length,
      blocked: allProjectLogs.filter((l) => l.decision === 'blocked').length,
      auto: allProjectLogs.filter((l) => l.decision === 'auto').length,
      total: allProjectLogs.length,
    };

    return NextResponse.json({
      success: true,
      logs: projectLogs,
      stats,
    });
  } catch (error) {
    console.error('[156.5][API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

console.log('[156.5][API] audit-logs route loaded');
