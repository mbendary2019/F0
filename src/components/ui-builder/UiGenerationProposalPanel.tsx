// src/components/ui-builder/UiGenerationProposalPanel.tsx
// =============================================================================
// Phase 163.4 – UI Generation Proposal Panel
// Displays component tree and file plan, allows approve/reject
// =============================================================================

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Check,
  X,
  Play,
  Loader2,
  Wand2,
  LayoutGrid,
  Component,
  Layers,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types (mirrored from orchestrator)
// =============================================================================

type UiGenerationStatus =
  | 'pending'
  | 'analyzing'
  | 'generating'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'building'
  | 'completed'
  | 'failed';

interface UiComponentNode {
  id: string;
  name: string;
  type: 'page' | 'layout' | 'component' | 'section' | 'element';
  description?: string;
  props?: Record<string, unknown>;
  children?: UiComponentNode[];
  suggestedPath?: string;
  dependencies?: string[];
  imports?: string[];
  visualHints?: {
    layout?: 'flex' | 'grid' | 'block';
    spacing?: 'tight' | 'normal' | 'loose';
    colors?: string[];
    typography?: string[];
  };
}

interface UiFilePlan {
  componentId: string;
  path: string;
  action: 'create' | 'modify';
  estimatedLines?: number;
  dependencies?: string[];
}

interface UiGenerationProposal {
  id: string;
  requestId: string;
  projectId: string;
  status: UiGenerationStatus;
  createdAt: string;
  updatedAt: string;
  analysisNotes?: string;
  componentTree: UiComponentNode[];
  filePlan: UiFilePlan[];
  planId?: string;
  taskIds?: string[];
  errorMessage?: string;
}

interface UiGenerationProposalPanelProps {
  proposal: UiGenerationProposal;
  onApprove?: (proposalId: string) => Promise<void>;
  onReject?: (proposalId: string, reason?: string) => Promise<void>;
  className?: string;
}

// =============================================================================
// ComponentTreeNode - Recursive tree view
// =============================================================================

interface ComponentTreeNodeProps {
  node: UiComponentNode;
  level?: number;
}

function ComponentTreeNode({ node, level = 0 }: ComponentTreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  const getTypeIcon = (type: UiComponentNode['type']) => {
    switch (type) {
      case 'page':
        return <LayoutGrid className="h-4 w-4 text-blue-400" />;
      case 'layout':
        return <Layers className="h-4 w-4 text-purple-400" />;
      case 'component':
        return <Component className="h-4 w-4 text-green-400" />;
      case 'section':
        return <Folder className="h-4 w-4 text-yellow-400" />;
      case 'element':
        return <Box className="h-4 w-4 text-slate-400" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer',
          'hover:bg-slate-800/50 transition-colors',
          level > 0 && 'ml-4'
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )
        ) : (
          <span className="w-4" />
        )}

        {getTypeIcon(node.type)}

        <span className="text-sm font-medium">{node.name}</span>

        <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-slate-800 rounded">
          {node.type}
        </span>
      </div>

      {node.description && expanded && (
        <div className="text-xs text-muted-foreground ml-12 mb-1">
          {node.description}
        </div>
      )}

      {node.visualHints && expanded && (
        <div className="flex gap-1 ml-12 mb-1">
          {node.visualHints.layout && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
              {node.visualHints.layout}
            </span>
          )}
          {node.visualHints.spacing && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
              {node.visualHints.spacing}
            </span>
          )}
        </div>
      )}

      {expanded && hasChildren && (
        <div className="border-l border-slate-800 ml-4">
          {node.children!.map((child) => (
            <ComponentTreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FilePlanList - Shows files to be created
// =============================================================================

interface FilePlanListProps {
  filePlan: UiFilePlan[];
}

function FilePlanList({ filePlan }: FilePlanListProps) {
  return (
    <div className="space-y-2">
      {filePlan.map((file) => (
        <div
          key={file.componentId}
          className="flex items-center justify-between p-2 rounded-md bg-slate-800/50 border border-slate-700"
        >
          <div className="flex items-center gap-2">
            <File className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-mono">{file.path}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              file.action === 'create'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-yellow-500/20 text-yellow-400'
            )}>
              {file.action}
            </span>
            {file.estimatedLines && (
              <span className="text-xs text-muted-foreground">
                ~{file.estimatedLines} lines
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// StatusBadge
// =============================================================================

function StatusBadge({ status }: { status: UiGenerationStatus }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'bg-slate-500/20 text-slate-400' };
      case 'analyzing':
        return { label: 'Analyzing...', color: 'bg-blue-500/20 text-blue-400' };
      case 'generating':
        return { label: 'Generating...', color: 'bg-purple-500/20 text-purple-400' };
      case 'awaiting_approval':
        return { label: 'Awaiting Approval', color: 'bg-yellow-500/20 text-yellow-400' };
      case 'approved':
        return { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-400' };
      case 'rejected':
        return { label: 'Rejected', color: 'bg-red-500/20 text-red-400' };
      case 'building':
        return { label: 'Building...', color: 'bg-fuchsia-500/20 text-fuchsia-400' };
      case 'completed':
        return { label: 'Completed', color: 'bg-green-500/20 text-green-400' };
      case 'failed':
        return { label: 'Failed', color: 'bg-red-500/20 text-red-400' };
      default:
        return { label: status, color: 'bg-slate-500/20 text-slate-400' };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', config.color)}>
      {config.label}
    </span>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function UiGenerationProposalPanel({
  proposal,
  onApprove,
  onReject,
  className = '',
}: UiGenerationProposalPanelProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'tree' | 'files'>('tree');

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(proposal.id);
    } catch (error) {
      console.error('[163.4][UI] Approve error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(proposal.id);
    } catch (error) {
      console.error('[163.4][UI] Reject error:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const canApprove = proposal.status === 'awaiting_approval';
  const isProcessing = ['analyzing', 'generating', 'building'].includes(proposal.status);

  return (
    <Card className={cn('bg-slate-900 border-slate-800', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Wand2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">UI Generation Proposal</CardTitle>
              <CardDescription className="text-xs font-mono">
                {proposal.id}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={proposal.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Analysis Notes */}
        {proposal.analysisNotes && (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-sm text-muted-foreground">
              {proposal.analysisNotes}
            </p>
          </div>
        )}

        {/* Error Message */}
        {proposal.errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{proposal.errorMessage}</p>
          </div>
        )}

        {/* Plan Link */}
        {proposal.planId && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm text-emerald-400">
              Plan created: <span className="font-mono">{proposal.planId}</span>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('tree')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              activeTab === 'tree'
                ? 'bg-fuchsia-500/20 text-fuchsia-400'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Component Tree
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              activeTab === 'files'
                ? 'bg-fuchsia-500/20 text-fuchsia-400'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Files to Create ({proposal.filePlan.length})
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[200px] max-h-[400px] overflow-auto">
          {activeTab === 'tree' ? (
            <div className="space-y-1">
              {proposal.componentTree.map((node) => (
                <ComponentTreeNode key={node.id} node={node} />
              ))}
              {proposal.componentTree.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No components in proposal
                </p>
              )}
            </div>
          ) : (
            <FilePlanList filePlan={proposal.filePlan} />
          )}
        </div>
      </CardContent>

      {canApprove && (
        <CardFooter className="flex justify-end gap-2 border-t border-slate-800 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={isRejecting || isApproving}
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            Reject
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Approve & Run Plan
          </Button>
        </CardFooter>
      )}

      {isProcessing && (
        <CardFooter className="flex justify-center border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// =============================================================================
// Hook for fetching proposals
// =============================================================================

export function useUiProposals(projectId: string, status?: UiGenerationStatus) {
  const [proposals, setProposals] = useState<UiGenerationProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ projectId });
      if (status) params.append('status', status);

      const res = await fetch(`/api/ui/generate?${params}`);
      const data = await res.json();

      if (data.success) {
        setProposals(data.proposals);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const approveProposal = async (proposalId: string) => {
    const res = await fetch(`/api/ui/generate/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    const data = await res.json();
    if (data.success) {
      await fetchProposals();
    }
    return data;
  };

  const rejectProposal = async (proposalId: string, reason?: string) => {
    const res = await fetch(`/api/ui/generate/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    });
    const data = await res.json();
    if (data.success) {
      await fetchProposals();
    }
    return data;
  };

  return {
    proposals,
    loading,
    error,
    fetchProposals,
    approveProposal,
    rejectProposal,
  };
}

console.log('[163.4][UI] UiGenerationProposalPanel loaded');
