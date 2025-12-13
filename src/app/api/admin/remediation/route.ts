/**
 * Remediation Rules API
 * CRUD operations for self-healing rules
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const db = adminDb;

const RemediationRuleSchema = z.object({
  metric: z.enum(['calls', 'errors', 'latency_p95']),
  comparator: z.enum(['>=', '>', '<', '<=']),
  threshold: z.number().min(0),
  action: z.enum(['disable_endpoint', 'reduce_rate', 'restart_function']),
  target: z.string().optional(),
  reduceByPct: z.number().min(1).max(90).optional(),
  enabled: z.boolean().default(true)
});

/**
 * GET - List all remediation rules
 */
export async function GET(req: NextRequest) {
  try {
    await assertAdminReq();

    const { searchParams } = new URL(req.url);
    const enabled = searchParams.get('enabled');

    let query: FirebaseFirestore.Query = db.collection('remediation_rules').orderBy('metric');

    if (enabled === 'true') {
      query = query.where('enabled', '==', true);
    } else if (enabled === 'false') {
      query = query.where('enabled', '==', false);
    }

    const snap = await query.get();
    const rules = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ rules }, { status: 200 });
  } catch (error: any) {
    console.error('[remediation GET] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch rules' },
      { status: error.status || 500 }
    );
  }
}

/**
 * POST - Create new remediation rule
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await assertAdminReq();

    const body = await req.json();
    const data = RemediationRuleSchema.parse(body);

    // Validate action-specific requirements
    if (data.action === 'disable_endpoint' && !data.target) {
      return Response.json(
        { error: 'target is required for disable_endpoint action' },
        { status: 400 }
      );
    }

    if (data.action === 'reduce_rate') {
      if (!data.target) {
        return Response.json(
          { error: 'target is required for reduce_rate action' },
          { status: 400 }
        );
      }
      if (!data.reduceByPct) {
        return Response.json(
          { error: 'reduceByPct is required for reduce_rate action' },
          { status: 400 }
        );
      }
    }

    if (data.action === 'restart_function' && !data.target) {
      return Response.json(
        { error: 'target is required for restart_function action' },
        { status: 400 }
      );
    }

    const ruleDoc = {
      ...data,
      createdBy: uid,
      createdAt: Date.now(),
      lastTriggered: null
    };

    const docRef = await db.collection('remediation_rules').add(ruleDoc);

    // Log to audit trail
    await db.collection('admin_audit').add({
      ts: Date.now(),
      action: 'create_remediation_rule',
      actorUid: uid,
      meta: {
        ruleId: docRef.id,
        rule: data
      }
    });

    return Response.json(
      { ok: true, id: docRef.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[remediation POST] Error:', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return Response.json(
      { error: error.message || 'Failed to create rule' },
      { status: error.status || 500 }
    );
  }
}

/**
 * PATCH - Update remediation rule
 */
export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await assertAdminReq();

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = RemediationRuleSchema.partial().parse(body);

    const ruleRef = db.collection('remediation_rules').doc(ruleId);
    const ruleDoc = await ruleRef.get();

    if (!ruleDoc.exists) {
      return Response.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    await ruleRef.update({
      ...data,
      updatedBy: uid,
      updatedAt: Date.now()
    });

    // Log to audit trail
    await db.collection('admin_audit').add({
      ts: Date.now(),
      action: 'update_remediation_rule',
      actorUid: uid,
      meta: {
        ruleId,
        updates: data
      }
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[remediation PATCH] Error:', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return Response.json(
      { error: error.message || 'Failed to update rule' },
      { status: error.status || 500 }
    );
  }
}

/**
 * DELETE - Delete remediation rule
 */
export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await assertAdminReq();

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const ruleRef = db.collection('remediation_rules').doc(ruleId);
    const ruleDoc = await ruleRef.get();

    if (!ruleDoc.exists) {
      return Response.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    await ruleRef.delete();

    // Log to audit trail
    await db.collection('admin_audit').add({
      ts: Date.now(),
      action: 'delete_remediation_rule',
      actorUid: uid,
      meta: {
        ruleId,
        rule: ruleDoc.data()
      }
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[remediation DELETE] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to delete rule' },
      { status: error.status || 500 }
    );
  }
}

