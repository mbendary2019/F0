/**
 * Timeline ViewModel Builders (Phase 62 Day 1)
 *
 * High-level functions to build view models from Firestore documents.
 * These are used by API endpoints to transform raw data into UI-ready structures.
 */

import type { AnyEvent, TimelineItem, SessionSummary } from "./types";
import { toTimelineItem, summarizeSession } from "./normalizers";

/**
 * Document with ID and data
 */
export type DocWithData<T = AnyEvent> = {
  id: string;
  data: T;
};

/**
 * Build timeline view model from Firestore documents
 *
 * Transforms raw event documents into normalized timeline items,
 * sorted by timestamp (newest first).
 *
 * @param docs - Firestore documents with event data
 * @returns Array of timeline items sorted by timestamp descending
 *
 * @example
 * ```typescript
 * const snap = await db.collection("ops_events")
 *   .orderBy("ts", "desc")
 *   .limit(50)
 *   .get();
 *
 * const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
 * const items = buildTimelineVM(docs);
 * ```
 */
export function buildTimelineVM(docs: DocWithData[]): TimelineItem[] {
  return docs
    .map((d) => toTimelineItem(d.id, d.data))
    .sort((a, b) => b.ts - a.ts); // Sort by timestamp descending (newest first)
}

/**
 * Build session summary view model from Firestore documents
 *
 * Aggregates all events for a session into a summary with statistics.
 * Events are sorted by timestamp (oldest first) to show flow.
 *
 * @param docs - Firestore documents for a single session
 * @returns Session summary with events and stats
 *
 * @example
 * ```typescript
 * const snap = await db.collection("ops_events")
 *   .where("sessionId", "==", sessionId)
 *   .orderBy("ts", "asc")
 *   .get();
 *
 * const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
 * const summary = buildSessionSummaryVM(docs);
 * ```
 */
export function buildSessionSummaryVM(docs: DocWithData[]): SessionSummary {
  const items = docs.map((d) => toTimelineItem(d.id, d.data));
  return summarizeSession(items);
}

/**
 * Build multiple session summaries from timeline items
 *
 * Groups items by session ID and creates a summary for each session.
 * Useful for displaying multiple sessions at once.
 *
 * @param items - Timeline items (can be from multiple sessions)
 * @returns Array of session summaries sorted by start time (newest first)
 *
 * @example
 * ```typescript
 * const items = buildTimelineVM(allDocs);
 * const sessions = buildMultipleSessionsVM(items);
 * ```
 */
export function buildMultipleSessionsVM(
  items: TimelineItem[]
): SessionSummary[] {
  // Group by session ID
  const grouped = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const existing = grouped.get(item.sessionId) || [];
    existing.push(item);
    grouped.set(item.sessionId, existing);
  }

  // Create summary for each session
  const summaries: SessionSummary[] = [];
  for (const [sessionId, sessionItems] of grouped.entries()) {
    summaries.push(summarizeSession(sessionItems));
  }

  // Sort by start time (newest first)
  return summaries.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

/**
 * Build paginated timeline response
 *
 * Helper to create API response with pagination metadata.
 *
 * @param items - Timeline items
 * @param lastDocId - ID of last document for next cursor
 * @returns Paginated response
 */
export function buildPaginatedResponse(
  items: TimelineItem[],
  lastDocId: string | null
): {
  items: TimelineItem[];
  nextCursor: string | null;
  count: number;
} {
  return {
    items,
    nextCursor: lastDocId,
    count: items.length,
  };
}

/**
 * Enrich timeline items with additional context
 *
 * Adds computed fields and cross-references between events.
 * For example, linking validations to their retrievals.
 *
 * @param items - Timeline items
 * @returns Enriched items
 */
export function enrichTimelineItems(items: TimelineItem[]): TimelineItem[] {
  // Sort by timestamp for context
  const sorted = [...items].sort((a, b) => a.ts - b.ts);

  // Add index for sequence
  const enriched = sorted.map((item, index) => ({
    ...item,
    meta: {
      ...item.meta,
      sequence: index + 1,
      totalInSession: sorted.length,
    },
  }));

  return enriched;
}

/**
 * Get session statistics summary
 *
 * Quick stats without full event details.
 * Useful for overview dashboards.
 *
 * @param docs - Firestore documents
 * @returns Statistics only
 */
export function getSessionStatsOnly(docs: DocWithData[]): {
  sessionId: string;
  durationMs?: number;
  eventCount: number;
  validationCount: number;
  avgScore?: number;
} {
  const summary = buildSessionSummaryVM(docs);

  return {
    sessionId: summary.sessionId,
    durationMs: summary.durationMs,
    eventCount: summary.events.length,
    validationCount: summary.stats.validations.count,
    avgScore: summary.stats.validations.avgScore,
  };
}
