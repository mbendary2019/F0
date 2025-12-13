// src/app/api/projects/[projectId]/snapshot/route.ts
// Phase 123: Project Snapshot API
// GET - Load snapshot, POST - Save snapshot

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[projectId]/snapshot
 * Load project snapshot from Firestore
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    // Get snapshot from Firestore
    const snapshotDoc = await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('snapshot')
      .get();

    if (!snapshotDoc.exists) {
      return NextResponse.json(
        { error: 'No snapshot found' },
        { status: 404 }
      );
    }

    const data = snapshotDoc.data();

    return NextResponse.json({
      success: true,
      snapshot: data?.snapshot || null,
      updatedAt: data?.updatedAt || null,
    });
  } catch (error) {
    console.error('[snapshot/GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load snapshot' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/snapshot
 * Save project snapshot to Firestore
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { snapshot, userId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot data required' },
        { status: 400 }
      );
    }

    // Save snapshot to Firestore
    const now = new Date().toISOString();
    const snapshotRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('snapshot');

    // Get existing to track version
    const existing = await snapshotRef.get();
    const version = existing.exists ? (existing.data()?.version || 0) + 1 : 1;

    await snapshotRef.set({
      snapshot,
      userId: userId || 'anonymous',
      version,
      createdAt: existing.exists ? existing.data()?.createdAt : now,
      updatedAt: now,
    });

    console.log(`[snapshot/POST] Saved snapshot for project ${projectId} v${version}`);

    return NextResponse.json({
      success: true,
      docId: projectId,
      version,
    });
  } catch (error) {
    console.error('[snapshot/POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save snapshot' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/snapshot
 * Delete project snapshot
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required' },
        { status: 400 }
      );
    }

    await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('meta')
      .doc('snapshot')
      .delete();

    return NextResponse.json({
      success: true,
      message: 'Snapshot deleted',
    });
  } catch (error) {
    console.error('[snapshot/DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete snapshot' },
      { status: 500 }
    );
  }
}
