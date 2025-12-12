// src/components/agents/PendingActionsPanel.tsx
// =============================================================================
// Phase 156.3 – PendingActionsPanel v2
// Enhanced UI with filters, risk levels, tooltips, and better UX
// =============================================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Check,
  X,
  Terminal,
  GitBranch,
  Globe,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Code,
  Filter,
  Info,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface PendingAction {
  id: string;
  message: {
    kind: string;
    from: string;
    to: string;
    context: {
      projectId: string;
      taskId?: string;
      planId?: string;
      userMode?: 'beginner' | 'pro' | 'expert';
    };
    payload: unknown;
    safety?: {
      level: 'low' | 'medium' | 'high';
    };
  };
  reason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

type AgentFilter = 'all' | 'shell' | 'git' | 'browser' | 'code';
type RiskFilter = 'all' | 'high' | 'medium' | 'low';

interface PendingActionsPanelProps {
  projectId: string;
  onApprove?: (actionId: string) => void;
  onReject?: (actionId: string) => void;
  className?: string;
  showFilters?: boolean;
}

const RISK_COLORS = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const RISK_ICONS = {
  high: <AlertCircle className="h-3 w-3" />,
  medium: <AlertTriangle className="h-3 w-3" />,
  low: <CheckCircle2 className="h-3 w-3" />,
};

const AGENT_ICONS = {
  shell: <Terminal className="h-4 w-4" />,
  git: <GitBranch className="h-4 w-4" />,
  browser: <Globe className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  default: <ShieldAlert className="h-4 w-4" />,
};

const RISK_TOOLTIPS = {
  shell: {
    high: 'This command could modify or delete system files. Review carefully before approving.',
    medium: 'This command may modify project files or run tests. Generally safe but review the command.',
    low: 'Safe command that only reads data or runs non-destructive operations.',
  },
  git: {
    high: 'This operation could affect your Git history. Make sure you want to proceed.',
    medium: 'This operation will modify your repository but can be reversed.',
    low: 'Safe Git operation (read-only or standard workflow).',
  },
  browser: {
    high: 'This will run on a production URL. Ensure the flow is correct.',
    medium: 'This will run on a staging/test environment.',
    low: 'This will run on localhost - safe for testing.',
  },
  code: {
    high: 'Large-scale code changes affecting multiple core files.',
    medium: 'Moderate code changes.',
    low: 'Minor code changes.',
  },
};

export function PendingActionsPanel({
  projectId,
  onApprove,
  onReject,
  className = '',
  showFilters = true,
}: PendingActionsPanelProps) {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch pending actions
  const fetchActions = async () => {
    try {
      setError(null);
      const res = await fetch(`/api/agents/pending-actions?projectId=${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch pending actions');
      }

      setActions(data.actions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[PendingActionsPanel] Error:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();

    // Poll every 3 seconds for updates
    const interval = setInterval(fetchActions, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Filter actions
  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      // Agent filter
      if (agentFilter !== 'all' && action.message.to !== agentFilter) {
        return false;
      }
      // Risk filter
      const risk = action.message.safety?.level ?? 'medium';
      if (riskFilter !== 'all' && risk !== riskFilter) {
        return false;
      }
      return true;
    });
  }, [actions, agentFilter, riskFilter]);

  const handleApprove = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      const res = await fetch('/api/agents/pending-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, action: 'approve' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve action');
      }

      // Remove from local state
      setActions((prev) => prev.filter((a) => a.id !== actionId));
      onApprove?.(actionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      const res = await fetch('/api/agents/pending-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, action: 'reject' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject action');
      }

      // Remove from local state
      setActions((prev) => prev.filter((a) => a.id !== actionId));
      onReject?.(actionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setProcessingId(null);
    }
  };

  const getActionIcon = (action: PendingAction) => {
    const to = action.message.to as keyof typeof AGENT_ICONS;
    return AGENT_ICONS[to] || AGENT_ICONS.default;
  };

  const getActionLabel = (action: PendingAction) => {
    const payload = action.message.payload as Record<string, unknown>;
    const task = payload?.task as Record<string, unknown> | undefined;

    if (task?.label) {
      return String(task.label);
    }

    return action.message.kind;
  };

  const getCommandPreview = (action: PendingAction) => {
    const payload = action.message.payload as Record<string, unknown>;
    const task = payload?.task as Record<string, unknown> | undefined;
    const input = task?.input as Record<string, unknown> | undefined;

    if (input?.command) return String(input.command);
    if (input?.url) return String(input.url);
    if (payload?.decision) return `Decision: ${payload.decision}`;

    return null;
  };

  const getRiskLevel = (action: PendingAction): 'high' | 'medium' | 'low' => {
    return action.message.safety?.level ?? 'medium';
  };

  const getTooltip = (action: PendingAction): string => {
    const to = action.message.to as keyof typeof RISK_TOOLTIPS;
    const risk = getRiskLevel(action);
    return RISK_TOOLTIPS[to]?.[risk] || 'Review this action before proceeding.';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return null; // Don't show panel if no pending actions
  }

  return (
    <Card className={`border-yellow-500/50 bg-yellow-500/5 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            Pending Approvals ({actions.length})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchActions}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        {showFilters && actions.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Agent Filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <div className="flex gap-1">
                {(['all', 'shell', 'git', 'browser', 'code'] as AgentFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    variant={agentFilter === filter ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setAgentFilter(filter)}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-muted-foreground">Risk:</span>
              <div className="flex gap-1">
                {(['all', 'high', 'medium', 'low'] as RiskFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    variant={riskFilter === filter ? 'default' : 'ghost'}
                    size="sm"
                    className={`h-6 px-2 text-xs ${
                      filter !== 'all' && riskFilter === filter ? RISK_COLORS[filter] : ''
                    }`}
                    onClick={() => setRiskFilter(filter)}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded">
            {error}
          </div>
        )}

        {filteredActions.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No actions match the current filters.
          </div>
        )}

        {filteredActions.map((action) => {
          const risk = getRiskLevel(action);
          const commandPreview = getCommandPreview(action);
          const isExpanded = expandedId === action.id;

          return (
            <div
              key={action.id}
              className={`p-3 bg-background rounded-lg border transition-all ${
                risk === 'high' ? 'border-red-500/30' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`mt-0.5 ${risk === 'high' ? 'text-red-500' : 'text-yellow-600'}`}>
                    {getActionIcon(action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {getActionLabel(action)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 ${RISK_COLORS[risk]}`}
                      >
                        {RISK_ICONS[risk]}
                        <span className="ml-1">{risk}</span>
                      </Badge>
                    </div>

                    {/* Command Preview */}
                    {commandPreview && (
                      <div className="mt-1.5 p-2 bg-slate-900/50 rounded text-xs font-mono text-slate-300 truncate">
                        {commandPreview}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground mt-1.5">
                      {action.reason}
                    </div>

                    {/* Tooltip / Expanded Info */}
                    <button
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 mt-1"
                      onClick={() => setExpandedId(isExpanded ? null : action.id)}
                    >
                      <Info className="h-3 w-3" />
                      {isExpanded ? 'Hide details' : 'What does this mean?'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                        {getTooltip(action)}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {action.message.to}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => handleReject(action.id)}
                    disabled={processingId === action.id}
                    title="Reject this action"
                  >
                    {processingId === action.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(action.id)}
                    disabled={processingId === action.id}
                    title="Approve and execute this action"
                  >
                    {processingId === action.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

console.log('[156.3][UI] PendingActionsPanel v2 loaded');
