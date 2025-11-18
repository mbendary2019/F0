/**
 * Phase 38 - Graph Extract Scheduler
 * Periodically extracts relationships from audit logs
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { extractFromAudit, extractModelRelationships } from '../graph/entityExtractor';

export const graphExtract = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      console.log('[graphExtract] Starting entity extraction');
      await extractFromAudit();
      await extractModelRelationships();
      console.log('[graphExtract] Entity extraction completed successfully');
    } catch (error) {
      console.error('[graphExtract] Error:', error);
      throw error;
    }
  }
);
