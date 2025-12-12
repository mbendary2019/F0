// desktop/src/lib/runtime/testsSync.ts
// =============================================================================
// Phase 150.5.4 – Desktop → Firestore Tests Sync
// Writes tests stats to Firestore for Web IDE to read
// =============================================================================

import { getFirestore, Timestamp, doc, setDoc } from 'firebase/firestore';
import type { TestsStatus } from '../../../../src/shared/runtime/projectRuntime';

/**
 * Tests stats data
 */
export interface TestsStatsData {
  status: TestsStatus;
  coverage?: number | null;
  lastRunAt?: Date | null;
  suites?: {
    passed?: number;
    failed?: number;
    skipped?: number;
  };
}

/**
 * Update tests stats in Firestore
 * Called after Desktop test runner completes
 */
export async function updateTestsStatsToFirestore(
  projectId: string,
  stats: TestsStatsData
): Promise<void> {
  try {
    const db = getFirestore();
    const testsRef = doc(db, 'projects', projectId, 'tests', 'latest');

    await setDoc(testsRef, {
      status: stats.status,
      coverage: stats.coverage ?? null,
      lastRunAt: stats.lastRunAt ? Timestamp.fromDate(stats.lastRunAt) : null,
      suites: stats.suites ?? null,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log('[150.5][DESKTOP][TESTS_SYNC] Stats updated', {
      projectId,
      status: stats.status,
      coverage: stats.coverage,
    });
  } catch (error) {
    console.error('[150.5][DESKTOP][TESTS_SYNC] Failed to update stats:', error);
    throw error;
  }
}

/**
 * Mark tests as running
 */
export async function markTestsRunning(projectId: string): Promise<void> {
  try {
    const db = getFirestore();
    const testsRef = doc(db, 'projects', projectId, 'tests', 'latest');

    await setDoc(testsRef, {
      status: 'not_run', // Will be updated when complete
      lastRunAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log('[150.5][DESKTOP][TESTS_SYNC] Tests marked as running', { projectId });
  } catch (error) {
    console.error('[150.5][DESKTOP][TESTS_SYNC] Failed to mark running:', error);
  }
}

/**
 * Record test run result
 */
export async function recordTestRunResult(
  projectId: string,
  passed: boolean,
  coverage?: number,
  suites?: { passed?: number; failed?: number; skipped?: number }
): Promise<void> {
  const status: TestsStatus = passed ? 'ok' : 'failing';

  await updateTestsStatsToFirestore(projectId, {
    status,
    coverage,
    lastRunAt: new Date(),
    suites,
  });
}

export default {
  updateTestsStatsToFirestore,
  markTestsRunning,
  recordTestRunResult,
};
