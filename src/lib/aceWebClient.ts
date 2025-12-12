// src/lib/aceWebClient.ts
// =============================================================================
// Phase 150.3 – ACE Web Client for API calls
// Phase 150.3.7 – Job-based flow with polling
// =============================================================================

import type { AceRun, AceJob, TriggerAceRunRequest, TriggerAceJobResponse } from '@/types/ace';

/**
 * Fetch ACE runs for a project
 */
export async function fetchAceRuns(projectId: string): Promise<AceRun[]> {
  console.log('[150.3][ACE_WEB] Fetching ACE runs...', { projectId });

  const res = await fetch(`/api/projects/${projectId}/ace/runs`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[150.3][ACE_WEB] Failed to fetch runs:', error);
    throw new Error(error.error || 'Failed to fetch ACE runs');
  }

  const runs = await res.json();
  console.log('[150.3][ACE_WEB] Loaded ACE runs:', runs.length);
  return runs;
}

/**
 * Create an ACE job (to be executed by Desktop)
 * Returns jobId for polling
 */
export async function triggerAceJob(
  projectId: string,
  options: TriggerAceRunRequest = {}
): Promise<TriggerAceJobResponse> {
  console.log('[150.3][ACE_WEB] Creating ACE job...', { projectId, options });

  const res = await fetch(`/api/projects/${projectId}/ace/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[150.3][ACE_WEB] Failed to create job:', error);
    throw new Error(error.error || 'Failed to create ACE job');
  }

  const result = await res.json();
  console.log('[150.3][ACE_WEB] ACE job created:', result.jobId);
  return result;
}

/**
 * Get job status by ID
 */
export async function getJobStatus(
  projectId: string,
  jobId: string
): Promise<AceJob> {
  const res = await fetch(`/api/projects/${projectId}/ace/jobs/${jobId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to get job status');
  }

  return res.json();
}

/**
 * Poll job until completion or timeout
 */
export async function pollJobUntilComplete(
  projectId: string,
  jobId: string,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    onStatusChange?: (job: AceJob) => void;
  } = {}
): Promise<AceJob> {
  const {
    timeoutMs = 120_000, // 2 minutes
    intervalMs = 3000,   // 3 seconds
    onStatusChange,
  } = options;

  const startTime = Date.now();
  let lastStatus = '';

  console.log('[150.3][ACE_WEB] Starting job poll...', { jobId, timeoutMs });

  while (Date.now() - startTime < timeoutMs) {
    try {
      const job = await getJobStatus(projectId, jobId);

      // Notify on status change
      if (job.status !== lastStatus) {
        lastStatus = job.status;
        console.log('[150.3][ACE_WEB] Job status changed:', job.status);
        onStatusChange?.(job);
      }

      // Check if completed or failed
      if (job.status === 'completed' || job.status === 'failed') {
        console.log('[150.3][ACE_WEB] Job finished:', {
          status: job.status,
          runId: job.runId,
          error: job.error,
        });
        return job;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error('[150.3][ACE_WEB] Poll error:', error);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Timeout
  console.warn('[150.3][ACE_WEB] Job poll timeout', { jobId });
  throw new Error('ACE job timed out');
}

// Legacy export for backward compatibility
export const triggerAceRun = triggerAceJob;
