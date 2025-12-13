/**
 * POST /api/marketplace/install
 * Request installation of a marketplace item (proxies to Cloud Function)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const user = await authAdmin.verifyIdToken(token);

    const { itemId } = await req.json();
    if (!itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    }

    // This would typically call the Cloud Function requestInstall
    // For now, we'll do a simple direct implementation

    const itemDoc = await firestoreAdmin
      .collection('ops_marketplace_items')
      .doc(itemId)
      .get();

    if (!itemDoc.exists) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Log install request
    await firestoreAdmin.collection('ops_audit').add({
      type: 'marketplace.install',
      itemId,
      uid: user.uid,
      email: user.email || 'unknown',
      ts: new Date(),
    });

    return NextResponse.json({ ok: true, itemId });
  } catch (error: any) {
    console.error('[marketplace/install] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
