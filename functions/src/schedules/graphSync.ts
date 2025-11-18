/**
 * Phase 38 - Graph Sync Scheduler
 * Periodically syncs graph from all sources
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { syncFromSources } from '../graph/graphBuilder';

export const graphSync = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[graphSync] Starting scheduled graph sync');
      await syncFromSources();
      console.log('[graphSync] Graph sync completed successfully');
    } catch (error) {
      console.error('[graphSync] Error:', error);
      throw error;
    }
  }
);
