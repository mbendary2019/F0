/**
 * Alert Rules Management API
 * CRUD operations for alert rules
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const AlertRuleSchema = z.object({
  name: z.string().min(3),
  metric: z.enum(['errors_per_min', 'calls_per_min', 'latency_p95']),
  threshold: z.number().min(0),
  window: z.enum(['1m', '5m', '15m']),
  action: z.enum(['slack', 'browser']),
  enabled: z.boolean(),
});

/**
 * GET - List all alert rules
 */
export async function GET() {
  await assertAdminReq();

  try {
    const db = getFirestore();
    const snap = await db
      .collection('alert_rules')
      .orderBy('name')
      .get();

    const rules = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ rules }, { status: 200 });
  } catch (error) {
    console.error('[alerts/rules GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch alert rules' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new alert rule
 */
export async function POST(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const body = await req.json();
    const data = AlertRuleSchema.parse(body);

    const db = getFirestore();
    const doc = await db.collection('alert_rules').add({
      ...data,
      createdBy: uid,
      createdAt: Date.now()
    });

    return Response.json(
      { ok: true, id: doc.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[alerts/rules POST] Error:', error);
    return Response.json(
      { error: 'Failed to create alert rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete alert rule
 */
export async function DELETE(req: NextRequest) {
  await assertAdminReq();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    await db.collection('alert_rules').doc(id).delete();

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[alerts/rules DELETE] Error:', error);
    return Response.json(
      { error: 'Failed to delete alert rule' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update alert rule
 */
export async function PATCH(req: NextRequest) {
  await assertAdminReq();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = AlertRuleSchema.partial().parse(body);

    const db = getFirestore();
    await db.collection('alert_rules').doc(id).update({
      ...data,
      updatedAt: Date.now()
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[alerts/rules PATCH] Error:', error);
    return Response.json(
      { error: 'Failed to update alert rule' },
      { status: 500 }
    );
  }
}

