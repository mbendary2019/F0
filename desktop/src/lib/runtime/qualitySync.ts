// desktop/src/lib/runtime/qualitySync.ts
// =============================================================================
// Phase 150.5.4 – Desktop → Firestore Quality Sync
// Writes quality snapshots to Firestore for Web IDE to read
// =============================================================================

import { getFirestore, Timestamp, collection, doc, setDoc } from 'firebase/firestore';
import type { QualityStatus } from '../../../../src/shared/runtime/projectRuntime';

/**
 * Quality snapshot data from Desktop scan
 */
export interface QualitySnapshotData {
  filesScanned: number;
  totalIssues: number;
  score: number;
  status: QualityStatus;
}

/**
 * Options for recording quality snapshot
 */
export interface RecordQualitySnapshotOptions {
  projectId: string;
  source: 'scan' | 'auto_fix_after_scan';
  data: QualitySnapshotData;
}

/**
 * Record a quality snapshot to Firestore
 * Called after Desktop scans project or after auto-fix
 */
export async function recordQualitySnapshotToFirestore(
  opts: RecordQualitySnapshotOptions
): Promise<string> {
  const { projectId, source, data } = opts;

  try {
    const db = getFirestore();

    // Create new snapshot document
    const snapshotsRef = collection(db, 'projects', projectId, 'qualitySnapshots');
    const newDocRef = doc(snapshotsRef);

    await setDoc(newDocRef, {
      source,
      filesScanned: data.filesScanned,
      totalIssues: data.totalIssues,
      score: data.score,
      status: data.status,
      recordedAt: Timestamp.now(),
    });

    console.log('[150.5][DESKTOP][QUALITY_SYNC] Snapshot written', {
      projectId,
      snapshotId: newDocRef.id,
      source,
      score: data.score,
      status: data.status,
      totalIssues: data.totalIssues,
    });

    return newDocRef.id;
  } catch (error) {
    console.error('[150.5][DESKTOP][QUALITY_SYNC] Failed to write snapshot:', error);
    throw error;
  }
}

/**
 * Also update the "latest" document for quick access
 */
export async function updateLatestQualitySnapshot(
  projectId: string,
  data: QualitySnapshotData
): Promise<void> {
  try {
    const db = getFirestore();
    const latestRef = doc(db, 'projects', projectId, 'quality', 'latest');

    await setDoc(latestRef, {
      ...data,
      recordedAt: Timestamp.now(),
    }, { merge: true });

    console.log('[150.5][DESKTOP][QUALITY_SYNC] Latest snapshot updated', {
      projectId,
      score: data.score,
      status: data.status,
    });
  } catch (error) {
    console.error('[150.5][DESKTOP][QUALITY_SYNC] Failed to update latest:', error);
  }
}

export default {
  recordQualitySnapshotToFirestore,
  updateLatestQualitySnapshot,
};
