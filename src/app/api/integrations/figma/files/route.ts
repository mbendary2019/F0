/**
 * GET /api/integrations/figma/files
 * List all Figma assets from Firestore
 */

import { NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/server/firebase';

export async function GET() {
  try {
    const snap = await firestoreAdmin
      .collection('ops_assets')
      .where('source', '==', 'figma')
      .limit(500)
      .get();

    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[figma/files] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
