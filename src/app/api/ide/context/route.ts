/**
 * IDE Workspace Context Endpoint
 * Phase 84.7: Captures and stores workspace context from VS Code extension
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Workspace context from IDE
 */
export interface IdeWorkspaceContext {
  projectId: string;
  sessionId: string;
  openedFiles: { path: string; languageId?: string }[];
  currentFile?: { path: string; languageId?: string };
  changedFiles?: { path: string; status: 'modified' | 'added' | 'deleted' }[];
  packageJson?: {
    path: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  timestamp?: number;
}

/**
 * POST /api/ide/context
 * Stores workspace context for an IDE session
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { projectId, sessionId } = body as IdeWorkspaceContext;

    if (!projectId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing projectId or sessionId' },
        { status: 400 }
      );
    }

    // Add timestamp if not provided
    const context: IdeWorkspaceContext = {
      ...body,
      timestamp: body.timestamp || Date.now(),
    };

    // Store context in Firestore
    const contextRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('ideSessions')
      .doc(sessionId)
      .collection('context')
      .doc('latest');

    await contextRef.set(context, { merge: true });

    // Also update session metadata with context timestamp
    const sessionRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('ideSessions')
      .doc(sessionId);

    await sessionRef.set(
      {
        lastContextUpdate: context.timestamp,
        hasContext: true,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      contextId: 'latest',
      timestamp: context.timestamp,
    });
  } catch (error) {
    console.error('Error saving IDE context:', error);
    return NextResponse.json(
      { error: 'Failed to save context', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ide/context?projectId=xxx&sessionId=xxx
 * Retrieves the latest workspace context for a session
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const sessionId = searchParams.get('sessionId');

    if (!projectId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing projectId or sessionId query params' },
        { status: 400 }
      );
    }

    // Retrieve context from Firestore
    const contextRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('ideSessions')
      .doc(sessionId)
      .collection('context')
      .doc('latest');

    const contextSnap = await contextRef.get();

    if (!contextSnap.exists) {
      return NextResponse.json(
        { error: 'No context found for this session' },
        { status: 404 }
      );
    }

    const context = contextSnap.data() as IdeWorkspaceContext;

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (error) {
    console.error('Error retrieving IDE context:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve context', details: String(error) },
      { status: 500 }
    );
  }
}
