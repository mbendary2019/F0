// F0 Billing API - Credits Management

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { creditsManager } from '@/lib/billing/credits';

export const dynamic = 'force-dynamic';

/**
 * GET - Get user's credit balance
 */
export async function GET(req: NextRequest) {
  try {
    // Verify token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Get credits
    const credits = await creditsManager.getCredits(decodedToken.uid);

    return NextResponse.json({
      ok: true,
      credits,
    });
  } catch (error: any) {
    console.error('Error getting credits:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Consume credits
 */
export async function POST(req: NextRequest) {
  try {
    // Verify token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Parse request body
    const body = await req.json();
    const { sinkId, quantity = 1 } = body;

    if (!sinkId) {
      return NextResponse.json({ ok: false, error: 'sinkId is required' }, { status: 400 });
    }

    // Consume credits
    const success = await creditsManager.consumeCredits(decodedToken.uid, sinkId, quantity);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Insufficient credits' },
        { status: 402 } // Payment Required
      );
    }

    // Get updated balance
    const credits = await creditsManager.getCredits(decodedToken.uid);

    return NextResponse.json({
      ok: true,
      consumed: true,
      credits,
    });
  } catch (error: any) {
    console.error('Error consuming credits:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}


