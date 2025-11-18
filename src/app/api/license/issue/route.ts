// F0 License API - Issue License (Admin Only)

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { licenseManager } from '@/lib/license/manager';
import type { Plan } from '@/lib/license/types';

export async function POST(req: NextRequest) {
  try {
    // Verify admin token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Check if user is admin
    if (!decodedToken.admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { plan, seats, issuedTo, expiresAt, metadata } = body;

    // Validate inputs
    if (!plan || !['pro', 'team', 'enterprise'].includes(plan)) {
      return NextResponse.json({ ok: false, error: 'Invalid plan' }, { status: 400 });
    }

    if (!seats || seats < 1) {
      return NextResponse.json({ ok: false, error: 'Invalid seats count' }, { status: 400 });
    }

    if (!issuedTo) {
      return NextResponse.json({ ok: false, error: 'issuedTo is required' }, { status: 400 });
    }

    // Issue license
    const license = await licenseManager.issue({
      plan: plan as Plan,
      seats,
      issuedTo,
      expiresAt,
      createdBy: decodedToken.uid,
      metadata,
    });

    return NextResponse.json({
      ok: true,
      license,
    });
  } catch (error: any) {
    console.error('Error issuing license:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}


