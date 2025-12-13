/**
 * GET /api/marketplace/items
 * List all marketplace items
 */

import { NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await firestoreAdmin
      .collection('ops_marketplace_items')
      .orderBy('title')
      .get();

    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[marketplace/items] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
