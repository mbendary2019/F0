/**
 * Phase 84.6: IDE Project Validation Endpoint
 * POST /api/ide/project/validate
 * Verify that the user owns the specified project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';

export async function POST(req: NextRequest) {
  try {
    // Phase 84.7: Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: 'PROJECT_ID_REQUIRED' },
        { status: 400 }
      );
    }

    // Verify ownership
    await requireProjectOwner(user, projectId);

    // Success
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('POST /api/ide/project/validate error:', err);

    // Handle specific errors
    if (err.message === 'NO_TOKEN' || err.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 401 }
      );
    }

    if (err.message === 'NOT_OWNER') {
      return NextResponse.json(
        { ok: false, error: 'NOT_OWNER' },
        { status: 403 }
      );
    }

    if (err.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
