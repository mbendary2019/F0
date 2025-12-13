// F0 License API - Revoke License (Admin Only)

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { licenseManager } from '@/lib/license/manager';

export const dynamic = 'force-dynamic';

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
    const { key, reason } = body;

    if (!key) {
      return NextResponse.json({ ok: false, error: 'License key is required' }, { status: 400 });
    }

    // Revoke license
    await licenseManager.revoke(key, reason);

    return NextResponse.json({
      ok: true,
      message: 'License revoked successfully',
    });
  } catch (error: any) {
    console.error('Error revoking license:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}


