/**
 * Phase 43 - Trust Flow Scheduler
 * Periodically propagate trust through mesh graph
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { propagateTrust } from '../mesh/trustPropagation';

export const trustFlow = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    retryCount: 2,
  },
  async (event) => {
    try {
      await propagateTrust();
    } catch (error) {
      console.error('[trustFlow] Error:', error);
      throw error;
    }
  }
);
