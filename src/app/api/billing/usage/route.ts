/**
 * GET /api/billing/usage
 * Get user's current quota usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/server/firebase';
import { getUsage } from '@/lib/server/quota';

// Force dynamic rendering (uses headers)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Verify auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await authAdmin.verifyIdToken(token);

    // Get usage
    const usage = await getUsage(decoded.uid);

    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('[billing/usage] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
