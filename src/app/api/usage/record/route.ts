/**
 * POST /api/usage/record
 * Record a usage event (for testing or manual tracking)
 */

import { NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';
import { recordUsage, type UsageKind } from '@/server/usage';
import { auditLog } from '@/server/audit';
import { rateLimitGuard } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitResult = await rateLimitGuard(req, {
    points: 20, // Allow 20 usage records per minute
  });
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: rateLimitResult.error },
      { status: rateLimitResult.status }
    );
  }

  // Authentication
  const auth = await assertAuth(req, { requireActive: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { kind, amount = 1, wsId } = body;

    // Validate kind
    const validKinds: UsageKind[] = ['llm', 'api_call', 'job', 'task'];
    if (!kind || !validKinds.includes(kind)) {
      return NextResponse.json(
        { error: 'Invalid kind. Must be one of: llm, api_call, job, task' },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== 'number' || amount < 1 || amount > 10000) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a number between 1 and 10000' },
        { status: 400 }
      );
    }

    // Record usage
    await recordUsage(auth.uid!, kind, amount, wsId);

    // Audit log
    await auditLog({
      uid: auth.uid!,
      action: 'usage.record',
      resourceType: 'usage',
      resourceId: kind,
      metadata: { kind, amount, wsId },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      recorded: {
        kind,
        amount,
        wsId: wsId || null,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/usage/record] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
