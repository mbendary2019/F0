import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const policyGuardUrl = process.env.POLICY_GUARD_URL;

    if (!policyGuardUrl) {
      return NextResponse.json(
        { error: 'POLICY_GUARD_URL not configured' },
        { status: 500 }
      );
    }

    const res = await fetch(policyGuardUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
