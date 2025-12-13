// F0 License API - Validate License

import { NextRequest, NextResponse } from 'next/server';
import { licenseManager } from '@/lib/license/manager';
import { verifyActivationReceipt } from '@/lib/license/signature';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, signature } = body;

    if (!key) {
      return NextResponse.json({ ok: false, error: 'License key is required' }, { status: 400 });
    }

    // Validate license
    const result = await licenseManager.validate(key);

    // If signature provided, verify it (offline validation)
    if (signature && result.license) {
      const receipt = body; // Full receipt should be in body
      const isValid = verifyActivationReceipt(receipt);

      return NextResponse.json({
        ok: true,
        valid: result.valid && isValid,
        license: result.license,
        offlineValidation: true,
      });
    }

    // Online validation
    return NextResponse.json({
      ok: true,
      valid: result.valid,
      license: result.license,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Error validating license:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}


