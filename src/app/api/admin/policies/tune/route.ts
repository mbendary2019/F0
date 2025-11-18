/**
 * Policy Tuning API
 * Manual tuning override for admin users
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';
import { auditAdmin } from '@/lib/admin/audit';

const TuneSchema = z.object({
  alpha: z.number().min(0.1).max(1.5).optional(),
  lr: z.number().min(0.005).max(0.2).optional(),
  weights: z.record(z.string(), z.number()).optional(),
  reason: z.string().optional()
});

/**
 * POST /api/admin/policies/tune
 * Manually tune policy hyperparameters
 */
export async function POST(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const data = TuneSchema.parse(await req.json());
    const db = getFirestore();

    // Get current tuning
    const policyDoc = await db.collection('rl_policy').doc('global').get();
    const policy = policyDoc.exists ? policyDoc.data() : {};
    const currentTuning = policy?.tuning || {};

    // Merge with current values
    const newTuning = {
      alpha: data.alpha ?? currentTuning.alpha ?? 0.5,
      lr: data.lr ?? currentTuning.lr ?? 0.05,
      weights: data.weights ?? currentTuning.weights ?? {},
      updatedAt: Date.now(),
      updatedBy: uid,
      reason: data.reason || 'manual_override'
    };

    // Update policy
    await db.collection('rl_policy').doc('global').set(
      { tuning: newTuning },
      { merge: true }
    );

    // Audit log
    await auditAdmin(
      'policy_tuned_manual',
      uid,
      'global',
      {
        old: {
          alpha: currentTuning.alpha,
          lr: currentTuning.lr
        },
        new: {
          alpha: newTuning.alpha,
          lr: newTuning.lr
        },
        reason: newTuning.reason
      },
      req
    );

    return Response.json({ ok: true, tuning: newTuning }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[Policy Tune POST] Error:', error);
    return Response.json(
      { error: 'Failed to tune policy' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/policies/tune
 * Rollback to a previous policy version
 */
export async function PATCH(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const { versionId } = await req.json();

    if (!versionId) {
      return Response.json(
        { error: 'versionId required' },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // Get version
    const versionDoc = await db
      .collection('rl_policy_versions')
      .doc(versionId)
      .get();

    if (!versionDoc.exists) {
      return Response.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const version = versionDoc.data();

    // Rollback to this version
    await db.collection('rl_policy').doc('global').set(
      {
        tuning: {
          ...version?.tuning,
          updatedAt: Date.now(),
          updatedBy: uid,
          reason: `rollback_to_${version?.version}`
        },
        fromVersion: version?.version,
        rolledBackAt: Date.now()
      },
      { merge: true }
    );

    // Audit log
    await auditAdmin(
      'policy_rolled_back',
      uid,
      'global',
      {
        versionId,
        version: version?.version
      },
      req
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[Policy Rollback PATCH] Error:', error);
    return Response.json(
      { error: 'Failed to rollback policy' },
      { status: 500 }
    );
  }
}


