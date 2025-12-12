// desktop/src/lib/runtime/securitySync.ts
// =============================================================================
// Phase 150.5.4 – Desktop → Firestore Security Sync
// Writes security stats to Firestore for Web IDE to read
// =============================================================================

import { getFirestore, Timestamp, doc, setDoc } from 'firebase/firestore';
import type { SecuritySeverity } from '../../../../src/shared/runtime/projectRuntime';

/**
 * Security stats data
 */
export interface SecurityStatsData {
  totalAlerts: number;
  hasBlocking: boolean;
  bySeverity?: {
    low?: number;
    medium?: number;
    high?: number;
    critical?: number;
  };
}

/**
 * Update security stats in Firestore
 * Called after Desktop security watchdog runs
 */
export async function updateSecurityStatsToFirestore(
  projectId: string,
  stats: SecurityStatsData
): Promise<void> {
  try {
    const db = getFirestore();
    const securityRef = doc(db, 'projects', projectId, 'security', 'latest');

    await setDoc(securityRef, {
      totalAlerts: stats.totalAlerts,
      hasBlocking: stats.hasBlocking,
      bySeverity: stats.bySeverity ?? null,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log('[150.5][DESKTOP][SECURITY_SYNC] Stats updated', {
      projectId,
      totalAlerts: stats.totalAlerts,
      hasBlocking: stats.hasBlocking,
    });
  } catch (error) {
    console.error('[150.5][DESKTOP][SECURITY_SYNC] Failed to update stats:', error);
    throw error;
  }
}

/**
 * Clear security alerts when resolved
 */
export async function clearSecurityAlerts(projectId: string): Promise<void> {
  try {
    const db = getFirestore();
    const securityRef = doc(db, 'projects', projectId, 'security', 'latest');

    await setDoc(securityRef, {
      totalAlerts: 0,
      hasBlocking: false,
      bySeverity: null,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log('[150.5][DESKTOP][SECURITY_SYNC] Alerts cleared', { projectId });
  } catch (error) {
    console.error('[150.5][DESKTOP][SECURITY_SYNC] Failed to clear alerts:', error);
  }
}

export default {
  updateSecurityStatsToFirestore,
  clearSecurityAlerts,
};
