/**
 * Tests for Timeline Normalizers and ViewModel (Phase 62 Day 1)
 *
 * Tests event transformation, session summarization, and view model builders.
 */

import {
  toTimelineItem,
  summarizeSession,
  groupBySession,
  filterByDateRange,
  getUniqueSessions,
} from "../src/orchestrator/ops/timeline/normalizers";

import {
  buildTimelineVM,
  buildSessionSummaryVM,
  buildMultipleSessionsVM,
  buildPaginatedResponse,
  enrichTimelineItems,
  getSessionStatsOnly,
} from "../src/orchestrator/ops/timeline/viewmodel";

import type {
  AnyEvent,
  TimelineItem,
} from "../src/orchestrator/ops/timeline/types";

describe("Timeline Normalizers", () => {
  describe("toTimelineItem", () => {
    it("should transform mesh.start event", () => {
      const now = Date.now();
      const event: AnyEvent = {
        ts: now,
        type: "mesh.start",
        sessionId: "sess1",
        goal: "Test query",
      } as any;

      const item = toTimelineItem("doc1", event);

      expect(item.id).toBe("doc1");
      expect(item.sessionId).toBe("sess1");
      expect(item.type).toBe("mesh.start");
      expect(item.label).toBe("Mesh started");
      expect(item.meta?.goal).toBe("Test query");
      expect(item.severity).toBe("info");
    });

    it("should transform rag.validate event with severity", () => {
      const now = Date.now();

      // Low score -> error
      const lowScore: AnyEvent = {
        ts: now,
        type: "rag.validate",
        sessionId: "sess1",
        score: 0.42,
        strategy: "critic",
      } as any;

      const itemLow = toTimelineItem("doc1", lowScore);
      expect(itemLow.severity).toBe("error");
      expect(itemLow.label).toContain("critic");

      // Medium score -> warn
      const medScore: AnyEvent = {
        ts: now,
        type: "rag.validate",
        sessionId: "sess1",
        score: 0.52,
        strategy: "default",
      } as any;

      const itemMed = toTimelineItem("doc2", medScore);
      expect(itemMed.severity).toBe("warn");

      // High score -> info
      const highScore: AnyEvent = {
        ts: now,
        type: "rag.validate",
        sessionId: "sess1",
        score: 0.85,
      } as any;

      const itemHigh = toTimelineItem("doc3", highScore);
      expect(itemHigh.severity).toBe("info");
    });

    it("should transform rag.retrieve event", () => {
      const event: AnyEvent = {
        ts: Date.now(),
        type: "rag.retrieve",
        sessionId: "sess1",
        k: 5,
        ms: 120,
        sources: ["kb", "cluster"],
      } as any;

      const item = toTimelineItem("doc1", event);

      expect(item.type).toBe("rag.retrieve");
      expect(item.label).toContain("k=5");
      expect(item.meta?.k).toBe(5);
      expect(item.meta?.ms).toBe(120);
      expect(item.meta?.sources).toEqual(["kb", "cluster"]);
    });

    it("should transform mesh.final event", () => {
      const event: AnyEvent = {
        ts: Date.now(),
        type: "mesh.final",
        sessionId: "sess1",
        ms_total: 5000,
        citations_count: 8,
      } as any;

      const item = toTimelineItem("doc1", event);

      expect(item.type).toBe("mesh.final");
      expect(item.label).toBe("Mesh completed");
      expect(item.meta?.ms_total).toBe(5000);
      expect(item.meta?.citations_count).toBe(8);
    });

    it("should handle generic event types", () => {
      const event: AnyEvent = {
        ts: Date.now(),
        type: "custom.event",
        sessionId: "sess1",
      };

      const item = toTimelineItem("doc1", event);

      expect(item.type).toBe("custom.event");
      expect(item.label).toBe("custom.event");
    });
  });

  describe("summarizeSession", () => {
    it("should return empty summary for no items", () => {
      const summary = summarizeSession([]);

      expect(summary.sessionId).toBe("");
      expect(summary.events).toEqual([]);
      expect(summary.stats.validations.count).toBe(0);
    });

    it("should calculate time range and duration", () => {
      const items: TimelineItem[] = [
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "mesh.start",
          label: "Start",
        },
        {
          id: "2",
          sessionId: "sess1",
          ts: 3000,
          type: "mesh.final",
          label: "Final",
        },
      ];

      const summary = summarizeSession(items);

      expect(summary.startedAt).toBe(1000);
      expect(summary.endedAt).toBe(3000);
      expect(summary.durationMs).toBe(2000);
    });

    it("should sort events by timestamp ascending", () => {
      const items: TimelineItem[] = [
        {
          id: "3",
          sessionId: "sess1",
          ts: 3000,
          type: "mesh.final",
          label: "Final",
        },
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "mesh.start",
          label: "Start",
        },
        {
          id: "2",
          sessionId: "sess1",
          ts: 2000,
          type: "rag.validate",
          label: "Validate",
        },
      ];

      const summary = summarizeSession(items);

      expect(summary.events[0].ts).toBe(1000);
      expect(summary.events[1].ts).toBe(2000);
      expect(summary.events[2].ts).toBe(3000);
    });

    it("should compute validation statistics", () => {
      const items: TimelineItem[] = [
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "rag.validate",
          label: "v1",
          meta: { score: 0.6, model: "v1", strategy: "critic" },
        },
        {
          id: "2",
          sessionId: "sess1",
          ts: 2000,
          type: "rag.validate",
          label: "v2",
          meta: { score: 0.8, model: "v1", strategy: "majority" },
        },
        {
          id: "3",
          sessionId: "sess1",
          ts: 3000,
          type: "rag.validate",
          label: "v3",
          meta: { score: 0.4, model: "v2", strategy: "critic" },
        },
      ];

      const summary = summarizeSession(items);

      expect(summary.stats.validations.count).toBe(3);
      expect(summary.stats.validations.avgScore).toBeCloseTo(0.6, 1);
      expect(summary.stats.validations.byModel?.v1).toBe(2);
      expect(summary.stats.validations.byModel?.v2).toBe(1);
      expect(summary.stats.validations.byStrategy?.critic).toBe(2);
      expect(summary.stats.validations.byStrategy?.majority).toBe(1);
      expect(summary.stats.validations.passed).toBe(2); // >= 0.55
      expect(summary.stats.validations.failed).toBe(1); // < 0.55
    });

    it("should compute citation statistics", () => {
      const items: TimelineItem[] = [
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "mesh.final",
          label: "Final 1",
          meta: { citations_count: 5 },
        },
        {
          id: "2",
          sessionId: "sess1",
          ts: 2000,
          type: "mesh.final",
          label: "Final 2",
          meta: { citations_count: 7 },
        },
      ];

      const summary = summarizeSession(items);

      expect(summary.stats.citations?.total).toBe(12);
      expect(summary.stats.citations?.average).toBeCloseTo(6, 1);
    });

    it("should compute retrieval statistics", () => {
      const items: TimelineItem[] = [
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "rag.retrieve",
          label: "Retrieve 1",
          meta: { ms: 100 },
        },
        {
          id: "2",
          sessionId: "sess1",
          ts: 2000,
          type: "rag.retrieve",
          label: "Retrieve 2",
          meta: { ms: 200 },
        },
      ];

      const summary = summarizeSession(items);

      expect(summary.stats.retrievals?.count).toBe(2);
      expect(summary.stats.retrievals?.avgMs).toBe(150);
    });
  });

  describe("groupBySession", () => {
    it("should group items by session ID", () => {
      const items: TimelineItem[] = [
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "mesh.start",
          label: "S1",
        },
        {
          id: "2",
          sessionId: "sess2",
          ts: 2000,
          type: "mesh.start",
          label: "S2",
        },
        {
          id: "3",
          sessionId: "sess1",
          ts: 3000,
          type: "mesh.final",
          label: "F1",
        },
      ];

      const grouped = groupBySession(items);

      expect(grouped.size).toBe(2);
      expect(grouped.get("sess1")).toHaveLength(2);
      expect(grouped.get("sess2")).toHaveLength(1);
    });
  });

  describe("filterByDateRange", () => {
    it("should filter items by date range", () => {
      const items: TimelineItem[] = [
        { id: "1", sessionId: "s", ts: 1000, type: "a", label: "A" },
        { id: "2", sessionId: "s", ts: 2000, type: "b", label: "B" },
        { id: "3", sessionId: "s", ts: 3000, type: "c", label: "C" },
      ];

      const filtered = filterByDateRange(items, 1500, 2500);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });
  });

  describe("getUniqueSessions", () => {
    it("should return unique session IDs", () => {
      const items: TimelineItem[] = [
        { id: "1", sessionId: "sess1", ts: 1000, type: "a", label: "A" },
        { id: "2", sessionId: "sess2", ts: 2000, type: "b", label: "B" },
        { id: "3", sessionId: "sess1", ts: 3000, type: "c", label: "C" },
      ];

      const sessions = getUniqueSessions(items);

      expect(sessions).toHaveLength(2);
      expect(sessions).toContain("sess1");
      expect(sessions).toContain("sess2");
    });
  });
});

describe("Timeline ViewModel", () => {
  describe("buildTimelineVM", () => {
    it("should build timeline and sort by timestamp descending", () => {
      const docs = [
        {
          id: "1",
          data: { ts: 1000, type: "mesh.start", sessionId: "s" } as AnyEvent,
        },
        {
          id: "2",
          data: { ts: 3000, type: "mesh.final", sessionId: "s" } as AnyEvent,
        },
        {
          id: "3",
          data: {
            ts: 2000,
            type: "rag.validate",
            sessionId: "s",
          } as AnyEvent,
        },
      ];

      const items = buildTimelineVM(docs);

      expect(items).toHaveLength(3);
      expect(items[0].ts).toBe(3000); // Newest first
      expect(items[1].ts).toBe(2000);
      expect(items[2].ts).toBe(1000);
    });
  });

  describe("buildSessionSummaryVM", () => {
    it("should build session summary from docs", () => {
      const docs = [
        {
          id: "1",
          data: {
            ts: 1000,
            type: "rag.validate",
            sessionId: "sess1",
            score: 0.7,
          } as AnyEvent,
        },
        {
          id: "2",
          data: {
            ts: 2000,
            type: "rag.validate",
            sessionId: "sess1",
            score: 0.9,
          } as AnyEvent,
        },
      ];

      const summary = buildSessionSummaryVM(docs);

      expect(summary.sessionId).toBe("sess1");
      expect(summary.events).toHaveLength(2);
      expect(summary.stats.validations.count).toBe(2);
      expect(summary.stats.validations.avgScore).toBeCloseTo(0.8, 1);
    });
  });

  describe("buildMultipleSessionsVM", () => {
    it("should build summaries for multiple sessions", () => {
      const items: TimelineItem[] = [
        {
          id: "1",
          sessionId: "sess1",
          ts: 1000,
          type: "mesh.start",
          label: "S1",
        },
        {
          id: "2",
          sessionId: "sess2",
          ts: 2000,
          type: "mesh.start",
          label: "S2",
        },
        {
          id: "3",
          sessionId: "sess1",
          ts: 3000,
          type: "mesh.final",
          label: "F1",
        },
      ];

      const summaries = buildMultipleSessionsVM(items);

      expect(summaries).toHaveLength(2);
      expect(summaries[0].startedAt).toBeGreaterThan(
        summaries[1].startedAt || 0
      ); // Sorted newest first
    });
  });

  describe("buildPaginatedResponse", () => {
    it("should build paginated response", () => {
      const items: TimelineItem[] = [
        { id: "1", sessionId: "s", ts: 1000, type: "a", label: "A" },
      ];

      const response = buildPaginatedResponse(items, "cursor123");

      expect(response.items).toEqual(items);
      expect(response.nextCursor).toBe("cursor123");
      expect(response.count).toBe(1);
    });
  });

  describe("enrichTimelineItems", () => {
    it("should add sequence numbers", () => {
      const items: TimelineItem[] = [
        { id: "1", sessionId: "s", ts: 1000, type: "a", label: "A" },
        { id: "2", sessionId: "s", ts: 2000, type: "b", label: "B" },
      ];

      const enriched = enrichTimelineItems(items);

      expect(enriched[0].meta?.sequence).toBe(1);
      expect(enriched[0].meta?.totalInSession).toBe(2);
      expect(enriched[1].meta?.sequence).toBe(2);
    });
  });

  describe("getSessionStatsOnly", () => {
    it("should return stats only without full events", () => {
      const docs = [
        {
          id: "1",
          data: {
            ts: 1000,
            type: "rag.validate",
            sessionId: "sess1",
            score: 0.7,
          } as AnyEvent,
        },
        {
          id: "2",
          data: {
            ts: 3000,
            type: "mesh.final",
            sessionId: "sess1",
          } as AnyEvent,
        },
      ];

      const stats = getSessionStatsOnly(docs);

      expect(stats.sessionId).toBe("sess1");
      expect(stats.durationMs).toBe(2000);
      expect(stats.eventCount).toBe(2);
      expect(stats.validationCount).toBe(1);
      expect(stats.avgScore).toBeCloseTo(0.7, 1);
    });
  });
});
