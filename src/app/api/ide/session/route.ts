/**
 * Phase 84.1: IDE Session Endpoint
 * Phase 84.7: Refactored to use requireUser and requireProjectOwner helpers
 * POST /api/ide/session
 * Creates a new IDE session for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/api/requireUser';
import { requireProjectOwner } from '@/lib/api/requireProjectOwner';
import type { IdeSessionRequest, IdeSessionResponse } from '@/types/ideBridge';

const db = getFirestore(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Phase 84.7: Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: IdeSessionRequest = await req.json();
    const { projectId, clientKind = 'vscode' } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId' },
        { status: 400 }
      );
    }

    // Phase 84.7: Verify project ownership
    await requireProjectOwner(user, projectId);

    // Create IDE session
    const sessionRef = db
      .collection('projects')
      .doc(projectId)
      .collection('ideSessions')
      .doc();

    const sessionData = {
      id: sessionRef.id,
      projectId,
      clientKind,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
      lastActiveAt: FieldValue.serverTimestamp(),
    };

    await sessionRef.set(sessionData);

    // Return session info
    const response: IdeSessionResponse = {
      sessionId: sessionRef.id,
      projectId,
      clientKind,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('IDE session creation error:', error);

    // Phase 84.7: Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    if (error.message === 'NOT_OWNER') {
      return NextResponse.json(
        { error: 'Access denied - Not project owner' },
        { status: 403 }
      );
    }

    if (error.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
