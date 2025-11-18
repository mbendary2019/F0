/**
 * Track Event Utility
 * Client-side function to record analytics events
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export type EventType = 'api' | 'tokens' | 'auth' | 'billing' | 'org' | 'user' | 'project' | 'message' | 'agent';

export interface TrackEventPayload {
  type: EventType;
  key: string;
  n?: number;
  orgId?: string;
  projectId?: string;
  meta?: Record<string, any>;
}

/**
 * Track an analytics event
 * Calls Firebase function to record event in Firestore
 */
export async function trackEvent(payload: TrackEventPayload): Promise<void> {
  try {
    const recordEvent = httpsCallable<TrackEventPayload, { success: boolean }>(
      functions,
      'recordEvent'
    );

    await recordEvent(payload);

    if (process.env.NODE_ENV === 'development') {
      console.log('[trackEvent]', payload);
    }
  } catch (error) {
    console.error('[trackEvent] Error:', error);
    // Don't throw - analytics failures shouldn't break user experience
  }
}

/**
 * Track user creation event
 */
export function trackUserCreated(userId: string, meta?: Record<string, any>) {
  return trackEvent({
    type: 'user',
    key: 'user_created',
    meta: { userId, ...meta },
  });
}

/**
 * Track project creation event
 */
export function trackProjectCreated(projectId: string, orgId?: string, meta?: Record<string, any>) {
  return trackEvent({
    type: 'project',
    key: 'project_created',
    projectId,
    orgId,
    meta,
  });
}

/**
 * Track message sent event
 */
export function trackMessageSent(projectId: string, meta?: Record<string, any>) {
  return trackEvent({
    type: 'message',
    key: 'message_sent',
    projectId,
    meta,
  });
}

/**
 * Track agent job event
 */
export function trackAgentJob(projectId: string, jobType: string, meta?: Record<string, any>) {
  return trackEvent({
    type: 'agent',
    key: 'agent_job',
    projectId,
    meta: { jobType, ...meta },
  });
}

/**
 * Track task completion event
 */
export function trackTaskCompleted(projectId: string, taskId: string, meta?: Record<string, any>) {
  return trackEvent({
    type: 'agent',
    key: 'task_completed',
    projectId,
    meta: { taskId, ...meta },
  });
}

/**
 * Track phase completion event
 */
export function trackPhaseCompleted(projectId: string, phaseId: string, meta?: Record<string, any>) {
  return trackEvent({
    type: 'agent',
    key: 'phase_completed',
    projectId,
    meta: { phaseId, ...meta },
  });
}
