import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const { db } = initAdmin();
    const snap = await db
      .collection('ops_risk_scores')
      .orderBy('ts', 'desc')
      .limit(200)
      .get();
    return NextResponse.json(snap.docs.map((d) => d.data()));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
