/**
 * Phase 115.1: Preview Heartbeat
 *
 * Helper to trigger auto-refresh signals for DevicePreviewPane.
 * Uses Firestore as a simple event bus to avoid WebSocket complexity.
 *
 * Firestore path: ops_projects/{projectId}/_meta/preview
 */

import { getFirestoreAdmin } from '@/lib/server/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export type PreviewHeartbeatReason =
  | 'task_executed'
  | 'qa_completed'
  | 'deployment'
  | 'manual';

export interface TouchPreviewHeartbeatOptions {
  projectId: string;
  reason: PreviewHeartbeatReason;
}

/**
 * Touch the preview heartbeat document to trigger auto-refresh
 * on any subscribed DevicePreviewPane components.
 */
export async function touchPreviewHeartbeat(options: TouchPreviewHeartbeatOptions): Promise<void> {
  const { projectId, reason } = options;

  if (!projectId) {
    console.warn('[Preview Heartbeat] No projectId provided, skipping');
    return;
  }

  try {
    const db = getFirestoreAdmin();

    const ref = db
      .collection('ops_projects')
      .doc(projectId)
      .collection('_meta')
      .doc('preview');

    await ref.set(
      {
        lastTriggeredAt: FieldValue.serverTimestamp(),
        lastReason: reason,
      },
      { merge: true }
    );

    console.log(`[Preview Heartbeat] Triggered for project ${projectId}: ${reason}`);
  } catch (error) {
    // Don't throw - this is a non-critical operation
    console.error('[Preview Heartbeat] Error:', error);
  }
}
