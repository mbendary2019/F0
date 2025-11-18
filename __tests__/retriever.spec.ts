import { describe, it, expect } from "@jest/globals";
import { retrieve } from "@/orchestrator/rag/retriever";
import type { ContextHandle } from "@/lib/types/context";

describe("RAG Retriever", () => {
  const mockContext: ContextHandle = {
    userId: "test-user",
    sessionId: "test-session",
    goal: "test goal",
    hints: [],
    clusterIds: [],
    limits: {
      tokens: 4000,
      latencyMs: 30000,
    },
  };

  it("should return documents for a query", async () => {
    const query = "test query";
    const docs = await retrieve(query, mockContext);

    expect(docs).toBeDefined();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBeGreaterThan(0);
  });

  it("should return documents with required fields", async () => {
    const query = "test query";
    const docs = await retrieve(query, mockContext);

    for (const doc of docs) {
      expect(doc).toHaveProperty("id");
      expect(doc).toHaveProperty("text");
      expect(typeof doc.id).toBe("string");
      expect(typeof doc.text).toBe("string");
    }
  });

  it("should handle empty query", async () => {
    const query = "";
    const docs = await retrieve(query, mockContext);

    expect(docs).toBeDefined();
    expect(Array.isArray(docs)).toBe(true);
  });

  it("should respect context cluster filtering", async () => {
    const query = "test query";
    const ctxWithClusters: ContextHandle = {
      ...mockContext,
      clusterIds: ["cluster1", "cluster2"],
    };

    const docs = await retrieve(query, ctxWithClusters);

    expect(docs).toBeDefined();
    expect(Array.isArray(docs)).toBe(true);
  });
});
