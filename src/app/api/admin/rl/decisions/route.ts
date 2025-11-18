/**
 * RL Decisions API
 * List and manage cognitive copilot decisions
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';
import { auditAdmin } from '@/lib/admin/audit';

const ApprovalSchema = z.object({
  decision_id: z.string().min(1),
  approved: z.boolean(),
  reason: z.string().optional()
});

/**
 * GET /api/admin/rl/decisions
 * List decisions with optional filters
 */
export async function GET(req: NextRequest) {
  await assertAdminReq();

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const risk = searchParams.get('risk');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getFirestore();
    let query: FirebaseFirestore.Query = db.collection('rl_decisions');

    // Apply filters
    if (action) {
      query = query.where('action', '==', action);
    }
    if (risk) {
      query = query.where('risk', '==', risk);
    }
    if (status) {
      query = query.where('approval_status', '==', status);
    }

    // Order and limit
    query = query.orderBy('timestamp', 'desc').limit(limit);

    const snap = await query.get();
    const decisions = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // Calculate stats
    const stats = {
      total: decisions.length,
      by_action: {} as Record<string, number>,
      by_risk: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      avg_reward: 0,
      positive_outcomes: 0
    };

    let rewardSum = 0;
    let rewardCount = 0;

    decisions.forEach((d: any) => {
      // Count by action
      stats.by_action[d.action] = (stats.by_action[d.action] || 0) + 1;

      // Count by risk
      stats.by_risk[d.risk] = (stats.by_risk[d.risk] || 0) + 1;

      // Count by status
      stats.by_status[d.approval_status] = (stats.by_status[d.approval_status] || 0) + 1;

      // Average reward
      if (d.reward != null) {
        rewardSum += d.reward;
        rewardCount += 1;
        if (d.reward > 0) {
          stats.positive_outcomes += 1;
        }
      }
    });

    stats.avg_reward = rewardCount > 0 ? rewardSum / rewardCount : 0;

    return Response.json({ decisions, stats }, { status: 200 });
  } catch (error) {
    console.error('[RL Decisions GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rl/decisions
 * Approve or reject a pending decision
 */
export async function POST(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const body = ApprovalSchema.parse(await req.json());
    const db = getFirestore();

    // Get decision
    const decisionRef = db.collection('rl_decisions').doc(body.decision_id);
    const decisionDoc = await decisionRef.get();

    if (!decisionDoc.exists) {
      return Response.json(
        { error: 'Decision not found' },
        { status: 404 }
      );
    }

    const decision = decisionDoc.data();

    // Check if decision is pending
    if (decision?.approval_status !== 'pending') {
      return Response.json(
        { error: 'Decision is not pending approval' },
        { status: 400 }
      );
    }

    // Update decision
    const newStatus = body.approved ? 'approved' : 'rejected';
    await decisionRef.update({
      approval_status: newStatus,
      approval_reason: body.reason,
      approved_by: uid,
      approved_at: Date.now()
    });

    // If approved, execute
    if (body.approved) {
      // Capture pre-metrics
      const totalsDoc = await db.collection('observability_cache').doc('totals').get();
      const totals = totalsDoc?.exists ? totalsDoc.data() : {};
      const calls = Number(totals?.calls24h || 1);
      const errors = Number(totals?.errors24h || 0);

      const pre_metrics = {
        timestamp: Date.now(),
        error_rate: errors / calls,
        p95: Number(totals?.p95 || 0),
        throughput: calls
      };

      // Create agent job
      await db.collection('agent_jobs').add({
        kind: 'remediate',
        payload: {
          action: decision?.action,
          target: decision?.target,
          actorUid: uid,
          decision_id: body.decision_id
        },
        status: 'queued',
        createdAt: Date.now(),
        requestedBy: uid
      });

      // Update decision
      await decisionRef.update({
        executed: true,
        executed_at: Date.now(),
        pre_metrics
      });
    }

    // Audit log
    await auditAdmin(
      `rl_decision_${newStatus}`,
      uid,
      body.decision_id,
      { action: decision?.action, reason: body.reason },
      req
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[RL Decisions POST] Error:', error);
    return Response.json(
      { error: 'Failed to update decision' },
      { status: 500 }
    );
  }
}


