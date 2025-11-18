// F0 License API - Activate License

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { licenseManager } from '@/lib/license/manager';
import { signActivationReceipt } from '@/lib/license/signature';

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
    const { key, deviceId, domain } = body;

    if (!key) {
      return NextResponse.json({ ok: false, error: 'License key is required' }, { status: 400 });
    }

    if (!deviceId && !domain) {
      return NextResponse.json(
        { ok: false, error: 'Either deviceId or domain is required' },
        { status: 400 }
      );
    }

    // Activate license
    const result = await licenseManager.activate({
      key,
      uid: decodedToken.uid,
      deviceId,
      domain,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    // Generate activation receipt
    const receipt = signActivationReceipt({
      licenseKey: key,
      deviceId,
      domain,
      uid: decodedToken.uid,
      activatedAt: Date.now(),
      expiresAt: result.license?.expiresAt,
    });

    return NextResponse.json({
      ok: true,
      license: result.license,
      receipt,
    });
  } catch (error: any) {
    console.error('Error activating license:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}


