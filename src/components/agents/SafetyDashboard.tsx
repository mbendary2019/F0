// src/components/agents/SafetyDashboard.tsx
// =============================================================================
// Phase 156.5 – Safety Dashboard
// Shows audit log stats, recent activity, and safety metrics
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Terminal,
  GitBranch,
  Globe,
  Code,
  Loader2,
  RefreshCw,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface SafetyStats {
  approved: number;
  rejected: number;
  blocked: number;
  auto: number;
  total: number;
}

interface SafetyDashboardProps {
  projectId: string;
  className?: string;
}

const ACTION_ICONS = {
  shell: <Terminal className="h-4 w-4" />,
  browser: <Globe className="h-4 w-4" />,
  git: <GitBranch className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  fix: <Code className="h-4 w-4" />,
};

const DECISION_COLORS = {
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  blocked: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  auto: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const DECISION_ICONS = {
  approved: <CheckCircle className="h-3 w-3" />,
  rejected: <XCircle className="h-3 w-3" />,
  blocked: <AlertTriangle className="h-3 w-3" />,
  auto: <Activity className="h-3 w-3" />,
};

export function SafetyDashboard({ projectId, className = '' }: SafetyDashboardProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const res = await fetch(`/api/agents/audit-logs?projectId=${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[SafetyDashboard] Error:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Poll every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="text-sm text-red-500 py-4">
          {error}
        </CardContent>
      </Card>
    );
  }

  const safetyScore = stats
    ? Math.round(((stats.approved + stats.auto) / Math.max(stats.total, 1)) * 100)
    : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-fuchsia-500" />
              Safety Dashboard
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} className="h-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Approved</span>
              </div>
              <div className="text-2xl font-bold text-green-300">
                {stats?.approved ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Rejected</span>
              </div>
              <div className="text-2xl font-bold text-red-300">
                {stats?.rejected ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2 text-orange-400 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium">Blocked</span>
              </div>
              <div className="text-2xl font-bold text-orange-300">
                {stats?.blocked ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium">Auto</span>
              </div>
              <div className="text-2xl font-bold text-blue-300">
                {stats?.auto ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
              <div className="flex items-center gap-2 text-fuchsia-400 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Safety Score</span>
              </div>
              <div className="text-2xl font-bold text-fuchsia-300">
                {safetyScore}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No audit logs yet. Actions will appear here when agents run.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-900/50 border border-slate-800"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-slate-400">
                      {ACTION_ICONS[log.actionType]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {log.payloadSummary}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {log.reason && <span>{log.reason} • </span>}
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 ${DECISION_COLORS[log.decision]}`}
                    >
                      {DECISION_ICONS[log.decision]}
                      <span className="ml-1">{log.decision}</span>
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {log.actionType}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Type Breakdown */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actions by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['shell', 'git', 'browser', 'code'] as const).map((type) => {
                const count = logs.filter((l) => l.actionType === type).length;
                const approved = logs.filter(
                  (l) => l.actionType === type && l.decision === 'approved'
                ).length;

                return (
                  <div
                    key={type}
                    className="p-3 rounded-lg bg-slate-900/50 border border-slate-800"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {ACTION_ICONS[type]}
                      <span className="text-xs font-medium capitalize">{type}</span>
                    </div>
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {approved} approved
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

console.log('[156.5][UI] SafetyDashboard loaded');
