import { describe, it, expect } from "@jest/globals";
import { rank } from "@/orchestrator/rag/ranker";
import type { RawDoc } from "@/orchestrator/rag/retriever";

describe("RAG Ranker", () => {
  const mockDocs: RawDoc[] = [
    { id: "doc1", text: "This is about machine learning and AI" },
    { id: "doc2", text: "This discusses neural networks" },
    { id: "doc3", text: "Random unrelated content" },
  ];

  it("should rank documents by relevance", async () => {
    const query = "machine learning";
    const ranked = await rank(mockDocs, query);

    expect(ranked).toBeDefined();
    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBe(mockDocs.length);
  });

  it("should add score to each document", async () => {
    const query = "machine learning";
    const ranked = await rank(mockDocs, query);

    for (const doc of ranked) {
      expect(doc).toHaveProperty("score");
      expect(typeof doc.score).toBe("number");
      expect(doc.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("should sort documents by score descending", async () => {
    const query = "machine learning";
    const ranked = await rank(mockDocs, query);

    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  it("should handle empty document list", async () => {
    const query = "test";
    const ranked = await rank([], query);

    expect(ranked).toBeDefined();
    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBe(0);
  });

  it("should handle empty query", async () => {
    const query = "";
    const ranked = await rank(mockDocs, query);

    expect(ranked).toBeDefined();
    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBe(mockDocs.length);
  });
});
