import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const { db } = initAdmin();
    const doc = await db.collection('ops_econ_objectives').doc('router').get();

    if (!doc.exists) {
      return NextResponse.json({
        objective: 'balanced',
        weights: { cost: 0.25, latency: 0.25, reward: 0.4, risk: 0.1 },
        lastScore: null,
        ts: null,
      });
    }

    return NextResponse.json(doc.data());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
