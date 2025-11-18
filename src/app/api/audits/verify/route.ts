// F0 Phase 36 - Audit Chain Verification API

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import crypto from 'crypto';

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

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * GET /api/audits/verify?day=YYYY-MM-DD
 * 
 * Verifies the audit chain integrity for a given day
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get('day');

    if (!day) {
      return NextResponse.json(
        { ok: false, error: 'Missing day parameter' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const eventsSnap = await db.collection(`audits/${day}/events`)
      .orderBy('ts', 'asc')
      .get();

    if (eventsSnap.empty) {
      return NextResponse.json({
        ok: true,
        valid: true,
        day,
        totalEvents: 0,
        message: 'No events found for this day',
      });
    }

    const brokenLinks: Array<{
      eventId: string;
      issue: string;
      expected: string;
      actual: string;
    }> = [];

    let prevHash = '';

    for (const doc of eventsSnap.docs) {
      const data = doc.data();
      const expectedChainHash = sha256(prevHash + data.payloadHash);

      // Check chain hash
      if (data.chainHash !== expectedChainHash) {
        brokenLinks.push({
          eventId: doc.id,
          issue: 'Invalid chain hash',
          expected: expectedChainHash,
          actual: data.chainHash,
        });
      }

      // Check prevHash link
      if (data.prevHash !== prevHash) {
        brokenLinks.push({
          eventId: doc.id,
          issue: 'Broken prevHash link',
          expected: prevHash,
          actual: data.prevHash,
        });
      }

      prevHash = data.chainHash;
    }

    const valid = brokenLinks.length === 0;

    return NextResponse.json({
      ok: true,
      valid,
      day,
      totalEvents: eventsSnap.size,
      brokenLinks,
      message: valid
        ? `✅ Chain integrity verified: ${eventsSnap.size} events`
        : `⚠️  Chain integrity compromised: ${brokenLinks.length} broken links found`,
    });
  } catch (error: any) {
    console.error('Error verifying audit chain:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


