/**
 * Runbooks API
 * CRUD operations for automated response playbooks
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { getFirestore } from 'firebase-admin/firestore';
import { auditAdmin } from '@/lib/admin/audit';

const RunbookSchema = z.object({
  name: z.string().min(3).max(100),
  trigger: z.string().min(3).max(200),
  steps: z.array(z.string().min(3)).min(1).max(10),
  cooldown: z.number().min(0).max(1440).optional(),
  enabled: z.boolean().default(true),
});

/**
 * GET /api/admin/runbooks
 * List all runbooks
 */
export async function GET() {
  await assertAdminReq();

  try {
    const db = getFirestore();
    
    const snap = await db
      .collection('runbooks')
      .orderBy('name')
      .get();

    const runbooks = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ runbooks }, { status: 200 });

  } catch (error) {
    console.error('[Runbooks GET] Error:', error);
    return Response.json(
      { error: 'Failed to fetch runbooks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/runbooks
 * Create new runbook
 */
export async function POST(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const body = await req.json();
    const validated = RunbookSchema.parse(body);

    const db = getFirestore();

    // Create runbook
    const doc = await db.collection('runbooks').add({
      ...validated,
      createdBy: uid,
      createdAt: Date.now(),
      triggerCount: 0
    });

    // Log to audit
    await auditAdmin('runbook_created', uid, undefined, {
      runbookId: doc.id,
      name: validated.name,
      trigger: validated.trigger
    }, req);

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

    console.error('[Runbooks POST] Error:', error);
    return Response.json(
      { error: 'Failed to create runbook' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/runbooks?id=xxx
 * Update runbook
 */
export async function PATCH(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const { searchParams } = new URL(req.url);
    const runbookId = searchParams.get('id');

    if (!runbookId) {
      return Response.json(
        { error: 'Runbook ID required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validated = RunbookSchema.partial().parse(body);

    const db = getFirestore();
    const runbookRef = db.collection('runbooks').doc(runbookId);
    const runbook = await runbookRef.get();

    if (!runbook.exists) {
      return Response.json(
        { error: 'Runbook not found' },
        { status: 404 }
      );
    }

    await runbookRef.update({
      ...validated,
      updatedBy: uid,
      updatedAt: Date.now()
    });

    // Log to audit
    await auditAdmin('runbook_updated', uid, undefined, {
      runbookId,
      changes: Object.keys(validated)
    }, req);

    return Response.json({ ok: true }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[Runbooks PATCH] Error:', error);
    return Response.json(
      { error: 'Failed to update runbook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/runbooks?id=xxx
 * Delete runbook
 */
export async function DELETE(req: NextRequest) {
  const { uid } = await assertAdminReq();

  try {
    const { searchParams } = new URL(req.url);
    const runbookId = searchParams.get('id');

    if (!runbookId) {
      return Response.json(
        { error: 'Runbook ID required' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const runbookRef = db.collection('runbooks').doc(runbookId);
    const runbook = await runbookRef.get();

    if (!runbook.exists) {
      return Response.json(
        { error: 'Runbook not found' },
        { status: 404 }
      );
    }

    await runbookRef.delete();

    // Log to audit
    await auditAdmin('runbook_deleted', uid, undefined, {
      runbookId,
      name: runbook.data()?.name
    }, req);

    return Response.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error('[Runbooks DELETE] Error:', error);
    return Response.json(
      { error: 'Failed to delete runbook' },
      { status: 500 }
    );
  }
}

