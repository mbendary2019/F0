// src/app/api/media/preprocess/[jobId]/route.ts
// =============================================================================
// Phase 164.6 – Media Preprocess Job Detail API
// GET: Get job and result by ID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// GET: Get Job and Result by ID
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  console.log('[164.6][API] GET job:', jobId);

  try {
    // Get job
    const jobDoc = await db.collection('mediaPreprocessJobs').doc(jobId).get();

    if (!jobDoc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = jobDoc.data();

    // Get result if available
    let result = null;
    if (job?.status === 'DONE') {
      const resultDoc = await db.collection('mediaPreprocessResults').doc(jobId).get();
      if (resultDoc.exists) {
        result = resultDoc.data();
      }
    }

    return NextResponse.json({
      success: true,
      job,
      result,
    });
  } catch (error) {
    console.error('[164.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE: Delete Job and Result
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  console.log('[164.6][API] DELETE job:', jobId);

  try {
    // Delete job
    await db.collection('mediaPreprocessJobs').doc(jobId).delete();

    // Delete result if exists
    const resultDoc = await db.collection('mediaPreprocessResults').doc(jobId).get();
    if (resultDoc.exists) {
      await db.collection('mediaPreprocessResults').doc(jobId).delete();
    }

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} deleted`,
    });
  } catch (error) {
    console.error('[164.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
