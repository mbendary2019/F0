/**
 * Timeline Normalizers (Phase 62 Day 1)
 *
 * Functions to transform raw ops_events into normalized TimelineItems
 * and aggregate them into session summaries with statistics.
 */

import type {
  AnyEvent,
  TimelineItem,
  SessionSummary,
  ValidationStats,
  CitationStats,
} from "./types";

/**
 * Convert a raw ops_event to a normalized TimelineItem
 *
 * @param docId - Firestore document ID
 * @param e - Raw event data
 * @returns Normalized timeline item
 */
export function toTimelineItem(docId: string, e: AnyEvent): TimelineItem {
  const base: TimelineItem = {
    id: docId,
    sessionId: e.sessionId,
    ts: e.ts,
    type: e.type,
    meta: {},
    label: e.type,
    severity: "info",
  };

  switch (e.type) {
    case "mesh.start": {
      const evt = e as any;
      return {
        ...base,
        label: `Mesh started`,
        meta: {
          goal: evt.goal || "",
        },
      };
    }

    case "rag.retrieve": {
      const evt = e as any;
      return {
        ...base,
        label: `RAG retrieve (k=${evt.k || "?"})`,
        meta: {
          k: evt.k,
          ms: evt.ms,
          sources: evt.sources || [],
        },
      };
    }

    case "rag.validate": {
      const evt = e as any;
      const score = typeof evt.score === "number" ? evt.score : null;
      const strategy = evt.strategy || "default";

      // Determine severity based on score
      let severity: "info" | "warn" | "error" = "info";
      if (score !== null) {
        if (score < 0.45) {
          severity = "error";
        } else if (score < 0.55) {
          severity = "warn";
        }
      }

      return {
        ...base,
        label: `Validate (${strategy})`,
        severity,
        meta: {
          score,
          subscores: evt.subscores || {},
          model: evt.model_version || "unknown",
          strategy,
        },
      };
    }

    case "mesh.consensus": {
      const evt = e as any;
      return {
        ...base,
        label: `Consensus (${evt.strategy || "default"})`,
        meta: {
          strategy: evt.strategy,
          votes: evt.votes || {},
        },
      };
    }

    case "mesh.final": {
      const evt = e as any;
      return {
        ...base,
        label: `Mesh completed`,
        meta: {
          ms_total: evt.ms_total,
          citations_count: evt.citations_count,
        },
      };
    }

    default:
      // Generic event
      return {
        ...base,
        label: `${e.type}`,
        meta: { ...e },
      };
  }
}

/**
 * Aggregate timeline items into a session summary with statistics
 *
 * @param items - Timeline items for a session
 * @returns Session summary with events and stats
 */
export function summarizeSession(items: TimelineItem[]): SessionSummary {
  if (!items.length) {
    return {
      sessionId: "",
      events: [],
      stats: {
        validations: { count: 0 },
      },
    };
  }

  const sessionId = items[0].sessionId;
  const userId = items.find((i) => i.meta?.userId)?.meta?.userId;

  // Calculate time range
  const timestamps = items.map((i) => i.ts);
  const startedAt = Math.min(...timestamps);
  const endedAt = Math.max(...timestamps);
  const durationMs = endedAt - startedAt;

  // Sort events by timestamp (ascending)
  const sortedEvents = [...items].sort((a, b) => a.ts - b.ts);

  // Calculate validation statistics
  const validationItems = items.filter((i) => i.type === "rag.validate");
  const validationStats = calculateValidationStats(validationItems);

  // Calculate citation statistics
  const citationStats = calculateCitationStats(items);

  // Calculate retrieval statistics
  const retrievalItems = items.filter((i) => i.type === "rag.retrieve");
  const retrievalStats = {
    count: retrievalItems.length,
    avgMs: retrievalItems.length
      ? retrievalItems.reduce((sum, i) => sum + (i.meta?.ms || 0), 0) /
        retrievalItems.length
      : undefined,
  };

  return {
    sessionId,
    userId,
    startedAt,
    endedAt,
    durationMs,
    events: sortedEvents,
    stats: {
      validations: validationStats,
      citations: citationStats,
      retrievals: retrievalStats,
    },
  };
}

/**
 * Calculate validation statistics from timeline items
 */
function calculateValidationStats(
  validationItems: TimelineItem[]
): ValidationStats {
  if (!validationItems.length) {
    return { count: 0 };
  }

  // Extract scores
  const scores = validationItems
    .map((i) => i.meta?.score)
    .filter((s): s is number => typeof s === "number" && !Number.isNaN(s));

  const avgScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : undefined;

  // Count by model version
  const byModel: Record<string, number> = {};
  for (const item of validationItems) {
    const model = String(item.meta?.model || "v0");
    byModel[model] = (byModel[model] || 0) + 1;
  }

  // Count by strategy
  const byStrategy: Record<string, number> = {};
  for (const item of validationItems) {
    const strategy = String(item.meta?.strategy || "default");
    byStrategy[strategy] = (byStrategy[strategy] || 0) + 1;
  }

  // Count passed/failed (assuming threshold of 0.55)
  const threshold = 0.55;
  const passed = scores.filter((s) => s >= threshold).length;
  const failed = scores.filter((s) => s < threshold).length;

  return {
    count: validationItems.length,
    avgScore: avgScore !== undefined ? Number(avgScore.toFixed(3)) : undefined,
    byModel,
    byStrategy,
    passed,
    failed,
  };
}

/**
 * Calculate citation statistics from timeline items
 */
function calculateCitationStats(items: TimelineItem[]): CitationStats {
  // Get citation counts from mesh.final events
  const finalEvents = items.filter((i) => i.type === "mesh.final");
  const citationCounts = finalEvents
    .map((i) => i.meta?.citations_count)
    .filter((c): c is number => typeof c === "number" && !Number.isNaN(c));

  const total = citationCounts.reduce((sum, c) => sum + c, 0);
  const average = citationCounts.length
    ? total / citationCounts.length
    : undefined;

  return {
    total: total || undefined,
    average: average !== undefined ? Number(average.toFixed(1)) : undefined,
  };
}

/**
 * Group timeline items by session ID
 *
 * @param items - Timeline items
 * @returns Map of sessionId to items
 */
export function groupBySession(
  items: TimelineItem[]
): Map<string, TimelineItem[]> {
  const grouped = new Map<string, TimelineItem[]>();

  for (const item of items) {
    const existing = grouped.get(item.sessionId) || [];
    existing.push(item);
    grouped.set(item.sessionId, existing);
  }

  return grouped;
}

/**
 * Filter timeline items by date range
 *
 * @param items - Timeline items
 * @param from - Start timestamp (inclusive)
 * @param to - End timestamp (inclusive)
 * @returns Filtered items
 */
export function filterByDateRange(
  items: TimelineItem[],
  from?: number,
  to?: number
): TimelineItem[] {
  return items.filter((item) => {
    if (from !== undefined && item.ts < from) return false;
    if (to !== undefined && item.ts > to) return false;
    return true;
  });
}

/**
 * Get unique session IDs from timeline items
 *
 * @param items - Timeline items
 * @returns Array of unique session IDs
 */
export function getUniqueSessions(items: TimelineItem[]): string[] {
  const sessions = new Set(items.map((i) => i.sessionId));
  return Array.from(sessions);
}
