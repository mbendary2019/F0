// src/app/api/agents/pending-actions/route.ts
// =============================================================================
// Phase 156.3 – Pending Actions API Route (Enhanced)
// GET: List pending actions for a project
// POST: Approve or reject a pending action (with audit logging)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getSafeOrchestratorBus,
  getPendingActionsStore,
} from '@/lib/agents/orchestratorBus';
import { addAuditLog } from '../audit-logs/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('[156.3][API] GET /api/agents/pending-actions');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    const safeBus = getSafeOrchestratorBus();
    const actions = await safeBus.getPendingActions(projectId);

    return NextResponse.json({
      success: true,
      actions,
      count: actions.length,
    });
  } catch (error) {
    console.error('[156.3][API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[156.3][API] POST /api/agents/pending-actions');

  try {
    const body = await request.json();
    const { actionId, action } = body;

    if (!actionId) {
      return NextResponse.json(
        { success: false, error: 'actionId is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const safeBus = getSafeOrchestratorBus();
    const pendingStore = getPendingActionsStore();

    // Get the pending action details for audit logging
    const pendingAction = await pendingStore.get(actionId);

    if (action === 'approve') {
      const success = await safeBus.approveAndExecute(actionId);

      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Action not found or already processed' },
          { status: 404 }
        );
      }

      // Log to audit
      if (pendingAction) {
        const msg = pendingAction.message;
        const payload = msg.payload as Record<string, unknown>;
        const task = payload?.task as Record<string, unknown> | undefined;
        const input = task?.input as Record<string, unknown> | undefined;

        addAuditLog({
          projectId: msg.context.projectId,
          userId: msg.context.userId,
          actionType: getActionType(msg.to),
          payloadSummary: getPayloadSummary(input, payload),
          riskLevel: (msg.safety?.level as 'low' | 'medium' | 'high') ?? 'medium',
          decision: 'approved',
          decidedBy: 'user',
          planId: msg.context.planId,
          createdAt: pendingAction.createdAt,
          decidedAt: new Date().toISOString(),
          reason: pendingAction.reason,
        });
      }

      console.log('[156.3][API] Action approved and executed:', actionId);
      return NextResponse.json({
        success: true,
        message: 'Action approved and executed',
        actionId,
      });
    } else {
      await safeBus.rejectAction(actionId);

      // Log to audit
      if (pendingAction) {
        const msg = pendingAction.message;
        const payload = msg.payload as Record<string, unknown>;
        const task = payload?.task as Record<string, unknown> | undefined;
        const input = task?.input as Record<string, unknown> | undefined;

        addAuditLog({
          projectId: msg.context.projectId,
          userId: msg.context.userId,
          actionType: getActionType(msg.to),
          payloadSummary: getPayloadSummary(input, payload),
          riskLevel: (msg.safety?.level as 'low' | 'medium' | 'high') ?? 'medium',
          decision: 'rejected',
          decidedBy: 'user',
          planId: msg.context.planId,
          createdAt: pendingAction.createdAt,
          decidedAt: new Date().toISOString(),
          reason: pendingAction.reason,
        });
      }

      console.log('[156.3][API] Action rejected:', actionId);
      return NextResponse.json({
        success: true,
        message: 'Action rejected',
        actionId,
      });
    }
  } catch (error) {
    console.error('[156.3][API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

function getActionType(to: string): 'shell' | 'browser' | 'git' | 'code' | 'fix' {
  switch (to) {
    case 'shell':
      return 'shell';
    case 'browser':
      return 'browser';
    case 'git':
      return 'git';
    case 'code':
      return 'code';
    default:
      return 'code';
  }
}

function getPayloadSummary(
  input: Record<string, unknown> | undefined,
  payload: Record<string, unknown>
): string {
  if (input?.command) return String(input.command).slice(0, 100);
  if (input?.url) return String(input.url).slice(0, 100);
  if (payload?.decision) return `Decision: ${payload.decision}`;
  return 'Action';
}

console.log('[156.3][API] pending-actions route loaded');
