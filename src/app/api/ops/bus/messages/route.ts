import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = initAdmin();
    const snap = await db
      .collection('ops_bus_messages')
      .orderBy('ts', 'desc')
      .limit(100)
      .get();
    return NextResponse.json(snap.docs.map((d) => d.data()));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
