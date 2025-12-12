// src/app/api/projects/[projectId]/ace/runs/route.ts
// =============================================================================
// Phase 150.3.6 – GET ACE runs for a project from Firestore
// =============================================================================

import { NextResponse } from 'next/server';
import { getFirestoreAdmin } from '@/lib/server/firebase';
import type { AceRun } from '@/types/ace';

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;

  console.log('[150.3][ACE_API] Fetching ACE runs', { projectId });

  try {
    const db = getFirestoreAdmin();

    // Query runs ordered by finishedAt descending
    const runsRef = db
      .collection('projects')
      .doc(projectId)
      .collection('aceRuns')
      .orderBy('finishedAt', 'desc')
      .limit(20);

    const snapshot = await runsRef.get();

    const runs: AceRun[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AceRun[];

    console.log('[150.3][ACE_API] Returning runs', {
      projectId,
      count: runs.length,
    });

    return NextResponse.json(runs);
  } catch (error) {
    console.error('[150.3][ACE_API] Failed to fetch runs:', error);
    // Return empty array on error (might be missing index)
    return NextResponse.json([]);
  }
}
