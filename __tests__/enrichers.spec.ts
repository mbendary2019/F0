import { describe, it, expect } from "@jest/globals";
import { buildCitations, enrichDocument, enrichDocuments } from "@/orchestrator/rag/enrichers";
import type { RankedDoc } from "@/orchestrator/rag/ranker";

describe("RAG Enrichers", () => {
  const mockDocs: RankedDoc[] = [
    { id: "doc1", text: "Sample text about AI", score: 0.9 },
    { id: "doc2", text: "Another document about machine learning", score: 0.7 },
    { id: "doc3", text: "Third document with meta", score: 0.5, meta: { url: "https://example.com" } },
  ];

  describe("buildCitations", () => {
    it("should build citations from ranked docs", () => {
      const citations = buildCitations(mockDocs);

      expect(citations).toBeDefined();
      expect(Array.isArray(citations)).toBe(true);
      expect(citations.length).toBe(mockDocs.length);
    });

    it("should include required citation fields", () => {
      const citations = buildCitations(mockDocs);

      for (const citation of citations) {
        expect(citation).toHaveProperty("docId");
        expect(citation).toHaveProperty("score");
        expect(citation).toHaveProperty("snippet");
      }
    });

    it("should truncate snippets to 200 chars", () => {
      const longText = "a".repeat(500);
      const docs: RankedDoc[] = [{ id: "doc1", text: longText, score: 1.0 }];
      const citations = buildCitations(docs);

      expect(citations[0].snippet?.length).toBeLessThanOrEqual(200);
    });

    it("should preserve metadata in citations", () => {
      const citations = buildCitations(mockDocs);
      const citationWithUrl = citations.find((c) => c.url);

      expect(citationWithUrl).toBeDefined();
      expect(citationWithUrl?.url).toBe("https://example.com");
    });
  });

  describe("enrichDocument", () => {
    it("should enrich a document with metadata", async () => {
      const doc = mockDocs[0];
      const enriched = await enrichDocument(doc);

      expect(enriched).toBeDefined();
      expect(enriched.meta).toBeDefined();
      expect(enriched.meta?.enriched).toBe(true);
    });

    it("should add word count to metadata", async () => {
      const doc = mockDocs[0];
      const enriched = await enrichDocument(doc);

      expect(enriched.meta?.wordCount).toBeDefined();
      expect(typeof enriched.meta?.wordCount).toBe("number");
      expect(enriched.meta?.wordCount).toBeGreaterThan(0);
    });

    it("should add timestamp to metadata", async () => {
      const doc = mockDocs[0];
      const enriched = await enrichDocument(doc);

      expect(enriched.meta?.timestamp).toBeDefined();
      expect(typeof enriched.meta?.timestamp).toBe("number");
    });
  });

  describe("enrichDocuments", () => {
    it("should enrich multiple documents", async () => {
      const enriched = await enrichDocuments(mockDocs);

      expect(enriched).toBeDefined();
      expect(Array.isArray(enriched)).toBe(true);
      expect(enriched.length).toBe(mockDocs.length);
    });

    it("should enrich all documents in batch", async () => {
      const enriched = await enrichDocuments(mockDocs);

      for (const doc of enriched) {
        expect(doc.meta?.enriched).toBe(true);
        expect(doc.meta?.wordCount).toBeDefined();
        expect(doc.meta?.timestamp).toBeDefined();
      }
    });

    it("should handle empty array", async () => {
      const enriched = await enrichDocuments([]);

      expect(enriched).toBeDefined();
      expect(Array.isArray(enriched)).toBe(true);
      expect(enriched.length).toBe(0);
    });
  });
});
