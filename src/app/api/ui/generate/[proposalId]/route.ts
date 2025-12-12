// src/app/api/ui/generate/[proposalId]/route.ts
// =============================================================================
// Phase 163.2 – UI Generation Proposal Actions
// GET: Get single proposal
// PATCH: Approve/Reject proposal
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types
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

interface UiGenerationProposal {
  id: string;
  requestId: string;
  projectId: string;
  status: UiGenerationStatus;
  createdAt: string;
  updatedAt: string;
  analysisNotes?: string;
  componentTree: unknown[];
  filePlan: unknown[];
  planId?: string;
  taskIds?: string[];
  errorMessage?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Placeholder: Create plan from proposal
// In production, this sends to PlannerAgent
async function createPlanFromProposal(
  proposal: UiGenerationProposal,
  userId: string
): Promise<string> {
  const planId = generateId('plan');
  const now = new Date().toISOString();

  // Create a plan document
  const plan = {
    id: planId,
    projectId: proposal.projectId,
    goal: `Generate UI from proposal: ${proposal.id}`,
    status: 'pending',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    sourceProposalId: proposal.id,
    filePlan: proposal.filePlan,
    componentTree: proposal.componentTree,
  };

  await db.collection('plans').doc(planId).set(plan);

  console.log('[163.2][API] Created plan:', planId, 'from proposal:', proposal.id);

  return planId;
}

// =============================================================================
// GET: Get Single Proposal
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await params;
  console.log('[163.2][API] GET proposal:', proposalId);

  try {
    const doc = await db.collection('uiGenerationProposals').doc(proposalId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const proposal = doc.data() as UiGenerationProposal;

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('[163.2][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH: Approve or Reject Proposal
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await params;
  console.log('[163.2][API] PATCH proposal:', proposalId);

  try {
    const body = await request.json();
    const { action, userId, reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get proposal
    const doc = await db.collection('uiGenerationProposals').doc(proposalId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const proposal = doc.data() as UiGenerationProposal;

    // Check if already processed
    if (proposal.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: `Proposal already ${proposal.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      // Create plan from proposal
      const planId = await createPlanFromProposal(proposal, userId || 'anonymous');

      // Update proposal
      await db.collection('uiGenerationProposals').doc(proposalId).update({
        status: 'approved',
        planId,
        updatedAt: now,
      });

      console.log('[163.2][API] Proposal approved:', proposalId, '→ Plan:', planId);

      return NextResponse.json({
        success: true,
        action: 'approved',
        proposalId,
        planId,
      });
    } else {
      // Reject proposal
      await db.collection('uiGenerationProposals').doc(proposalId).update({
        status: 'rejected',
        errorMessage: reason || 'Rejected by user',
        updatedAt: now,
      });

      console.log('[163.2][API] Proposal rejected:', proposalId);

      return NextResponse.json({
        success: true,
        action: 'rejected',
        proposalId,
      });
    }
  } catch (error) {
    console.error('[163.2][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
