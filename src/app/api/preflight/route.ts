import { NextRequest, NextResponse } from 'next/server';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

const functions = getFunctions(app);
const onPreflightCheck = httpsCallable(functions, 'onPreflightCheck');

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 422 });
    }

    // Call Firebase Cloud Function
    const result = await onPreflightCheck({ projectId });
    const data = result.data as { ok: boolean; missing: string[]; message: string };

    return NextResponse.json({
      ready: data.ok,
      ok: data.ok,
      missing: data.missing,
      message: data.message,
      issues: data.missing.map(key => `Missing: ${key}`)
    });
  } catch (error: any) {
    console.error('Preflight check failed:', error);
    return NextResponse.json({
      ready: false,
      ok: false,
      message: error?.message || 'Preflight check failed',
      issues: ['Failed to run preflight check']
    }, { status: 500 });
  }
}
