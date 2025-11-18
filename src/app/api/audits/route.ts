// F0 Phase 36 - Audit Events API

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * GET /api/audits
 * 
 * Query params:
 * - day: YYYY-MM-DD (optional, defaults to recent across all days)
 * - limit: number (default: 200, max: 500)
 * - action: filter by action (optional)
 * - uid: filter by actor UID (optional)
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Add authentication check
    // const user = await verifyAuth(req);
    // if (!user?.customClaims?.admin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    const { searchParams } = new URL(req.url);
    const day = searchParams.get('day');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const actionFilter = searchParams.get('action');
    const uidFilter = searchParams.get('uid');

    const db = getFirestore();
    let query: FirebaseFirestore.Query;

    if (day) {
      // Query specific day
      query = db.collection(`audits/${day}/events`);
    } else {
      // Query across all days (collection group)
      query = db.collectionGroup('events');
    }

    // Apply filters
    if (actionFilter) {
      query = query.where('action', '==', actionFilter);
    }

    if (uidFilter) {
      query = query.where('actor.uid', '==', uidFilter);
    }

    // Order and limit
    query = query.orderBy('ts', 'desc').limit(limit);

    const snap = await query.get();

    const events = snap.docs.map(doc => {
      const data = doc.data();
      const dayDoc = doc.ref.parent.parent;

      return {
        id: doc.id,
        day: dayDoc?.id || 'unknown',
        ts: data.ts?.toDate().toISOString(),
        action: data.action,
        actor: data.actor,
        target: data.target,
        ctx: data.ctx,
        payloadHash: data.payloadHash,
        prevHash: data.prevHash,
        chainHash: data.chainHash,
      };
    });

    return NextResponse.json({
      ok: true,
      events,
      total: events.length,
      day: day || 'all',
    });
  } catch (error: any) {
    console.error('Error fetching audits:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


