/**
 * POST /api/billing/consume
 * Consume tokens from user's daily quota
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/server/firebase';
import { checkAndConsume, QuotaExceededError } from '@/lib/server/quota';

export async function POST(req: NextRequest) {
  try {
    // Verify auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await authAdmin.verifyIdToken(token);

    // Get tokens to consume
    const { tokens } = await req.json();
    const tokensNum = Number(tokens || 0);

    if (tokensNum <= 0) {
      return NextResponse.json({ error: 'invalid tokens amount' }, { status: 400 });
    }

    // Check and consume
    await checkAndConsume(decoded.uid, tokensNum);

    return NextResponse.json({ ok: true, consumed: tokensNum });
  } catch (error: any) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: 'TRIAL_QUOTA_EXCEEDED', message: 'Daily quota exceeded' },
        { status: 429 }
      );
    }

    console.error('[billing/consume] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
