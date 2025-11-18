/**
 * KPI Aggregation System
 * Automatically aggregates KPIs when events are created
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from './client';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Increment a KPI counter
 */
async function incrementKpi(key: string, n: number = 1): Promise<void> {
  const ref = db.collection('analytics_kpis').doc(key);
  await ref.set(
    {
      value: FieldValue.increment(n),
      lastUpdated: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Aggregate KPIs on event write
 * Triggered whenever a new document is created in ops_events
 */
export const aggregateKpisOnEvent = onDocumentCreated(
  {
    document: 'ops_events/{eventId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();

    if (!data) {
      console.warn('[aggregateKpis] No data in event');
      return;
    }

    const { type, key, n = 1 } = data;

    console.log(`[aggregateKpis] Processing event: type=${type}, key=${key}, n=${n}`);

    // Count all events
    await incrementKpi('total_events', n);

    // Count by type
    await incrementKpi(`events_by_type_${type}`, n);

    // Specific KPIs based on event key
    switch (key) {
      case 'user_created':
        await incrementKpi('total_users', n);
        break;

      case 'project_created':
        await incrementKpi('total_projects', n);
        break;

      case 'message_sent':
        await incrementKpi('total_messages', n);
        break;

      case 'agent_job':
        await incrementKpi('total_agent_jobs', n);
        break;

      case 'task_completed':
        await incrementKpi('total_tasks_completed', n);
        break;

      case 'phase_completed':
        await incrementKpi('total_phases_completed', n);
        break;

      default:
        // Generic counter for unknown event types
        await incrementKpi(`event_${key}`, n);
    }

    console.log(`✅ [aggregateKpis] KPIs updated for ${key}`);
  }
);
