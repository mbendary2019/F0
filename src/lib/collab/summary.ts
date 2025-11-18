'use client';

import { useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseClient';

export type SummaryOptions = {
  roomId: string;
  enabled: boolean;
  windowMs?: number; // Default: 60000 (1 minute)
  intervalMs?: number; // Default: 60000 (1 minute)
};

/**
 * Hook to automatically summarize chat messages every minute
 *
 * Usage:
 * ```ts
 * useAutoSummary({
 *   roomId: 'my-room',
 *   enabled: true,
 *   windowMs: 60000,  // Summarize last 60 seconds
 *   intervalMs: 60000 // Run every 60 seconds
 * });
 * ```
 */
export function useAutoSummary(options: SummaryOptions) {
  const { roomId, enabled, windowMs = 60_000, intervalMs = 60_000 } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !roomId) {
      // Clean up timer if disabled
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Function to call Cloud Function
    async function runSummarization() {
      if (isRunningRef.current) {
        console.warn('[summary] Already running, skipping...');
        return;
      }

      try {
        isRunningRef.current = true;
        const summarizeRoom = httpsCallable(functions, 'summarizeRoom');

        console.info(`[summary] Summarizing room: ${roomId} (window: ${windowMs}ms)`);
        const result = await summarizeRoom({ roomId, windowMs });

        console.info('[summary] Summary created:', result.data);
      } catch (error: any) {
        if (error?.code === 'unauthenticated') {
          console.error('[summary] Not authenticated. Please sign in.');
        } else if (error?.code === 'permission-denied') {
          console.error('[summary] Permission denied. Check Firestore rules.');
        } else {
          console.warn('[summary] Summarization failed:', error?.message || error);
        }
      } finally {
        isRunningRef.current = false;

        // Schedule next run
        timerRef.current = setTimeout(runSummarization, intervalMs);
      }
    }

    // Start first run after initial delay
    console.info(`[summary] Auto-summary enabled for room: ${roomId} (interval: ${intervalMs}ms)`);
    timerRef.current = setTimeout(runSummarization, intervalMs);

    // Cleanup on unmount or options change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isRunningRef.current = false;
    };
  }, [roomId, enabled, windowMs, intervalMs]);
}

/**
 * Manual summarization function
 * Call this to trigger summarization on-demand
 */
export async function summarizeNow(roomId: string, windowMs: number = 60_000) {
  try {
    const summarizeRoom = httpsCallable(functions, 'summarizeRoom');
    const result = await summarizeRoom({ roomId, windowMs });
    return result.data;
  } catch (error: any) {
    console.error('[summary] Manual summarization failed:', error);
    throw error;
  }
}
