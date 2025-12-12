// desktop/src/lib/runtime/aceRunSync.ts
// =============================================================================
// Phase 150.5.4 – Desktop → Firestore ACE Run Sync
// Writes ACE run results to Firestore for Web IDE to read
// =============================================================================

import { getFirestore, Timestamp, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { AceRunSource } from '../../../../src/shared/runtime/projectRuntime';

/**
 * ACE run result data
 */
export interface AceRunResult {
  filesProcessed: number;
  totalApplied: number;
  totalErrors: number;
  targetedIssues?: number;
  totalSkipped?: number;
  projectRoot?: string;
}

/**
 * Options for recording ACE run
 */
export interface RecordAceRunOptions {
  projectId: string;
  result: AceRunResult;
  startedAt: Date;
  finishedAt: Date;
  issuesBefore?: number;
  issuesAfter?: number;
  source: AceRunSource;
  jobId?: string; // If triggered from web job
}

/**
 * Record an ACE run to Firestore
 * Called after Desktop completes an ACE run
 */
export async function recordAceRunToFirestore(
  opts: RecordAceRunOptions
): Promise<string> {
  const {
    projectId,
    result,
    startedAt,
    finishedAt,
    issuesBefore,
    issuesAfter,
    source,
    jobId,
  } = opts;

  try {
    const db = getFirestore();

    // Create new run document
    const runsRef = collection(db, 'projects', projectId, 'aceRuns');
    const newDocRef = doc(runsRef);

    const runData = {
      startedAt: Timestamp.fromDate(startedAt),
      finishedAt: Timestamp.fromDate(finishedAt),
      filesProcessed: result.filesProcessed,
      totalApplied: result.totalApplied,
      totalErrors: result.totalErrors,
      targetedIssues: result.targetedIssues ?? null,
      totalSkipped: result.totalSkipped ?? 0,
      issuesBefore: issuesBefore ?? null,
      issuesAfter: issuesAfter ?? null,
      projectRoot: result.projectRoot ?? null,
      source,
      ...(jobId && { jobId }),
    };

    await setDoc(newDocRef, runData);

    console.log('[150.5][DESKTOP][ACE_SYNC] Run written', {
      projectId,
      runId: newDocRef.id,
      source,
      totalApplied: result.totalApplied,
      totalErrors: result.totalErrors,
      jobId,
    });

    // If this was triggered by a web job, update the job with runId
    if (jobId) {
      try {
        const jobRef = doc(db, 'projects', projectId, 'aceJobs', jobId);
        await updateDoc(jobRef, {
          runId: newDocRef.id,
          status: 'completed',
          completedAt: Timestamp.now().toDate().toISOString(),
        });
        console.log('[150.5][DESKTOP][ACE_SYNC] Job updated with runId', { jobId, runId: newDocRef.id });
      } catch (jobError) {
        console.error('[150.5][DESKTOP][ACE_SYNC] Failed to update job:', jobError);
      }
    }

    return newDocRef.id;
  } catch (error) {
    console.error('[150.5][DESKTOP][ACE_SYNC] Failed to write run:', error);
    throw error;
  }
}

/**
 * Mark a web job as failed
 */
export async function markAceJobFailed(
  projectId: string,
  jobId: string,
  error: string
): Promise<void> {
  try {
    const db = getFirestore();
    const jobRef = doc(db, 'projects', projectId, 'aceJobs', jobId);

    await updateDoc(jobRef, {
      status: 'failed',
      error,
      completedAt: Timestamp.now().toDate().toISOString(),
    });

    console.log('[150.5][DESKTOP][ACE_SYNC] Job marked as failed', { projectId, jobId, error });
  } catch (e) {
    console.error('[150.5][DESKTOP][ACE_SYNC] Failed to mark job as failed:', e);
  }
}

export default {
  recordAceRunToFirestore,
  markAceJobFailed,
};
