/**
 * GET/POST /api/branding
 * Manage dynamic branding settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

const ENV_KEY = process.env.BRANDING_ENV || 'prod';

export async function GET() {
  try {
    const doc = await firestoreAdmin
      .collection('ops_branding')
      .doc(ENV_KEY)
      .get();

    const data = doc.exists ? doc.data() : {};

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[branding] GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const user = await authAdmin.verifyIdToken(token);

    // Check admin
    if (!user.admin) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Update branding
    const body = await req.json();
    await firestoreAdmin.collection('ops_branding').doc(ENV_KEY).set(body, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[branding] POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
