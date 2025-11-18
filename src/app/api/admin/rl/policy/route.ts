/**
 * RL Policy API
 * Read and manage RL policy parameters
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';
import { auditAdmin } from '@/lib/admin/audit';

const PolicyUpdateSchema = z.object({
  learning_rate: z.number().min(0).max(1).optional(),
  exploration_alpha: z.number().min(0).max(2).optional(),
  reset: z.boolean().optional()
});

/**
 * GET /api/admin/rl/policy
 * Get current policy parameters
 */
export async function GET() {
  await assertAdminReq();

  try {
    const db = getFirestore();
    const policyDoc = await db.collection('rl_policy').doc('global').get();

    if (!policyDoc.exists) {
      return Response.json(
        { error: 'Policy not initialized' },
        { status: 404 }
      );
    }

    const policy = policyDoc.data();

    // Calculate policy stats
    const stats = {
      version: policy?.version || 0,
      trained_samples: policy?.trained_samples || 0,
      last_updated: policy?.last_updated || 0,
      actions: Object.keys(policy?.weights || {}).length
    };

    // Get recent outcomes for performance metrics
    const outcomesSnap = await db
      .collection('rl_outcomes')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const outcomes = outcomesSnap.docs.map(d => d.data());
    
    const performance = {
      total_outcomes: outcomes.length,
      avg_reward: outcomes.length > 0
        ? outcomes.reduce((sum: number, o: any) => sum + (o.reward || 0), 0) / outcomes.length
        : 0,
      positive_rate: outcomes.length > 0
        ? outcomes.filter((o: any) => (o.reward || 0) > 0).length / outcomes.length
        : 0,
      avg_error_improvement: outcomes.length > 0
        ? outcomes.reduce((sum: number, o: any) => sum + (o.error_rate_improvement || 0), 0) / outcomes.length
        : 0,
      avg_latency_improvement: outcomes.length > 0
        ? outcomes.reduce((sum: number, o: any) => sum + (o.latency_improvement || 0), 0) / outcomes.length
        : 0
    };

    return Response.json(
      {
        policy: {
          ...policy,
          // Don't send full weight matrices (too large)
          weights: Object.keys(policy?.weights || {}).map(action => ({
            action,
            dimension: policy?.weights[action]?.length || 0
          })),
          confidence: Object.keys(policy?.confidence || {}).map(action => ({
            action,
            dimension: policy?.confidence[action]?.length || 0
          }))
        },
        stats,
        performance
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RL Policy GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch policy' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/rl/policy
 * Update policy hyperparameters or reset
 */
export async function PATCH(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const body = PolicyUpdateSchema.parse(await req.json());
    const db = getFirestore();

    if (body.reset) {
      // Reset policy to initial state
      const { initPolicyParams, getFeatureDimension } = await import('@/../../functions/src/cognitive/policy');
      const newPolicy = initPolicyParams(getFeatureDimension());

      await db.collection('rl_policy').doc('global').set(newPolicy);

      await auditAdmin('rl_policy_reset', uid, 'global', {}, req);

      return Response.json({ ok: true, message: 'Policy reset' }, { status: 200 });
    }

    // Update hyperparameters (stored separately for now)
    const updates: any = {};
    if (body.learning_rate !== undefined) {
      updates.learning_rate = body.learning_rate;
    }
    if (body.exploration_alpha !== undefined) {
      updates.exploration_alpha = body.exploration_alpha;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('rl_policy').doc('global').update(updates);

      await auditAdmin('rl_policy_updated', uid, 'global', updates, req);
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[RL Policy PATCH] Error:', error);
    return Response.json(
      { error: 'Failed to update policy' },
      { status: 500 }
    );
  }
}


