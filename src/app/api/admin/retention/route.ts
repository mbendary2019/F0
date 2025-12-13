/**
 * GET /api/admin/retention
 * POST /api/admin/retention
 * Dynamic retention policy configuration (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { db } from '@/lib/firebase-admin';
import { recordAuditLog } from '@/server/audit';

export const dynamic = 'force-dynamic';

export interface RetentionRule {
  collection: string;
  days: number;
  autoClean: boolean;
}

/**
 * GET - List all retention rules
 */
export async function GET(req: NextRequest) {
  // Require admin
  const auth = await assertAuth(req, { requireAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const configDoc = await db.collection('config').doc('retention_policies').get();

    const rules: RetentionRule[] = configDoc.exists
      ? (configDoc.data()?.rules || [])
      : [];

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Error fetching retention rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch retention rules' },
      { status: 500 }
    );
  }
}

/**
 * POST - Update retention rules
 */
export async function POST(req: NextRequest) {
  // Require admin
  const auth = await assertAuth(req, { requireAdmin: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminUid = auth.uid!;

  try {
    const body = await req.json();
    const { rules } = body as { rules: RetentionRule[] };

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { error: 'rules must be an array' },
        { status: 400 }
      );
    }

    // Validate rules
    for (const rule of rules) {
      if (
        !rule.collection ||
        typeof rule.days !== 'number' ||
        typeof rule.autoClean !== 'boolean'
      ) {
        return NextResponse.json(
          { error: 'Invalid rule format. Required: collection (string), days (number), autoClean (boolean)' },
          { status: 400 }
        );
      }

      if (rule.days < 1) {
        return NextResponse.json(
          { error: 'Retention days must be at least 1' },
          { status: 400 }
        );
      }
    }

    // Update config
    await db
      .collection('config')
      .doc('retention_policies')
      .set({ rules }, { merge: true });

    // Audit log
    await recordAuditLog({
      uid: adminUid,
      action: 'retention.config.update',
      resource: 'config/retention_policies',
      status: 'success',
      metadata: {
        rulesCount: rules.length,
        rules,
      },
    });

    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    console.error('Error updating retention rules:', error);

    await recordAuditLog({
      uid: adminUid,
      action: 'retention.config.update',
      resource: 'config/retention_policies',
      status: 'error',
      metadata: { error: error.message },
    });

    return NextResponse.json(
      { error: 'Failed to update retention rules' },
      { status: 500 }
    );
  }
}
