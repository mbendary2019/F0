// src/app/api/log/route.ts
/**
 * Phase 49: Log Proxy Route
 * Proxy route on Next.js that forwards to Cloud Function (or Emulator)
 * This makes CORS easier and allows variables to work safely from browser
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CF_URL = process.env.NEXT_PUBLIC_CF_LOG_URL; // e.g. http://127.0.0.1:5001/<PROJECT>/us-central1/log

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
  return res;
}

export async function POST(req: NextRequest) {
  try {
    if (!CF_URL) {
      return NextResponse.json(
        { ok: false, error: 'log_cf_url_not_configured' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const r = await fetch(CF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass App Check header if using:
        // 'X-Firebase-AppCheck': req.headers.get('x-firebase-appcheck') ?? ''
      },
      body: JSON.stringify(body),
    });

    const data = await r.json().catch(() => ({ ok: false }));
    const res = NextResponse.json(data, { status: r.status });
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'proxy_failed' }, { status: 500 });
  }
}
