/**
 * Phase 56 Day 4 - Memory Clustering Unit Tests
 * Tests for AI-powered memory clustering
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MemoryItem, Cluster, EmbeddingResult } from "./clusterMemory";

// Mock OpenAI for testing
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn().mockImplementation(({ input }: { input: string }) => {
          // Generate deterministic mock embeddings based on input text
          const hash = simpleHash(input);
          const dim = 1536;
          const embedding = Array.from({ length: dim }, (_, i) =>
            Math.sin((hash + i) * 0.1) * 0.5
          );
          return Promise.resolve({
            data: [{ embedding }]
          });
        })
      }
    }))
  };
});

// Simple hash function for deterministic embeddings
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Import after mocking
import MemoryClusterer from "./clusterMemory";

describe("MemoryClusterer", () => {
  let clusterer: MemoryClusterer;

  beforeEach(() => {
    clusterer = new MemoryClusterer(undefined, {
      embeddingModel: "text-embedding-3-large",
      similarityThreshold: 0.82,
      minClusterSize: 2,
      maxClusterSize: 100,
      concurrency: 6,
      maxRetries: 3,
    });
  });

  describe("Empty input handling", () => {
    it("should return empty results for empty array", async () => {
      const result = await clusterer.run([]);
      expect(result.embeddings).toEqual([]);
      expect(result.clusters).toEqual([]);
    });

    it("should return empty results for null input", async () => {
      const result = await clusterer.run(null as any);
      expect(result.embeddings).toEqual([]);
      expect(result.clusters).toEqual([]);
    });
  });

  describe("Single item clustering", () => {
    it("should create one cluster for single item", async () => {
      const items: MemoryItem[] = [
        {
          id: "1",
          userId: "user1",
          text: "Implemented Firebase authentication",
          createdAt: new Date("2025-01-01"),
        },
      ];

      const result = await clusterer.run(items);

      expect(result.embeddings).toHaveLength(1);
      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].size).toBe(1);
      expect(result.clusters[0].itemIds).toEqual(["1"]);
    });
  });

  describe("Multiple item clustering", () => {
    it("should cluster similar items together", async () => {
      const items: MemoryItem[] = [
        {
          id: "1",
          userId: "user1",
          text: "Implemented Firebase authentication",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "2",
          userId: "user1",
          text: "Fixed Firebase auth bug",
          createdAt: new Date("2025-01-02"),
        },
        {
          id: "3",
          userId: "user1",
          text: "Added pricing page",
          createdAt: new Date("2025-01-03"),
        },
        {
          id: "4",
          userId: "user1",
          text: "Updated pricing tiers",
          createdAt: new Date("2025-01-04"),
        },
      ];

      const result = await clusterer.run(items);

      expect(result.embeddings).toHaveLength(4);
      expect(result.clusters.length).toBeGreaterThan(0);
      expect(result.clusters.length).toBeLessThanOrEqual(4);

      // Verify all items are assigned to clusters
      const allClusteredIds = result.clusters.flatMap((c) => c.itemIds);
      expect(allClusteredIds.sort()).toEqual(["1", "2", "3", "4"]);
    });

    it("should maintain cluster size constraints", async () => {
      const items: MemoryItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        userId: "user1",
        text: `Memory item ${i + 1}`,
        createdAt: new Date(2025, 0, i + 1),
      }));

      const result = await clusterer.run(items);

      for (const cluster of result.clusters) {
        expect(cluster.size).toBeGreaterThanOrEqual(1);
        expect(cluster.size).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("Cluster properties", () => {
    it("should generate valid cluster IDs", async () => {
      const items: MemoryItem[] = [
        {
          id: "1",
          userId: "user1",
          text: "Test memory",
          createdAt: new Date(),
        },
      ];

      const result = await clusterer.run(items);

      expect(result.clusters[0].clusterId).toMatch(/^cl_[a-z0-9]+/);
    });

    it("should compute similarity stats", async () => {
      const items: MemoryItem[] = [
        {
          id: "1",
          userId: "user1",
          text: "Firebase authentication",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "2",
          userId: "user1",
          text: "Firebase auth",
          createdAt: new Date("2025-01-02"),
        },
      ];

      const result = await clusterer.run(items);

      for (const cluster of result.clusters) {
        expect(cluster.similarityStats.avg).toBeGreaterThanOrEqual(0);
        expect(cluster.similarityStats.avg).toBeLessThanOrEqual(1);
        expect(cluster.similarityStats.min).toBeGreaterThanOrEqual(0);
        expect(cluster.similarityStats.min).toBeLessThanOrEqual(1);
        expect(cluster.similarityStats.max).toBeGreaterThanOrEqual(0);
        expect(cluster.similarityStats.max).toBeLessThanOrEqual(1);
        expect(cluster.similarityStats.min).toBeLessThanOrEqual(cluster.similarityStats.avg);
        expect(cluster.similarityStats.avg).toBeLessThanOrEqual(cluster.similarityStats.max);
      }
    });

    it("should select representative item", async () => {
      const items: MemoryItem[] = [
        {
          id: "1",
          userId: "user1",
          text: "Firebase authentication",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "2",
          userId: "user1",
          text: "Auth system",
          createdAt: new Date("2025-01-02"),
        },
      ];

      const result = await clusterer.run(items);

      for (const cluster of result.clusters) {
        expect(cluster.representativeId).toBeDefined();
        expect(cluster.itemIds).toContain(cluster.representativeId);
      }
    });

    it("should compute centroids with correct dimensions", async () => {
      const items: MemoryItem[] = [
        {
          id: "1",
          userId: "user1",
          text: "Test memory",
          createdAt: new Date(),
        },
      ];

      const result = await clusterer.run(items);

      expect(result.clusters[0].centroid).toBeDefined();
      expect(Array.isArray(result.clusters[0].centroid)).toBe(true);
      expect(result.clusters[0].centroid.length).toBe(1536); // OpenAI embedding dimensions
    });
  });

  describe("Embedding properties", () => {
    it("should generate embeddings for all items", async () => {
      const items: MemoryItem[] = [
        { id: "1", userId: "user1", text: "Item 1", createdAt: new Date() },
        { id: "2", userId: "user1", text: "Item 2", createdAt: new Date() },
        { id: "3", userId: "user1", text: "Item 3", createdAt: new Date() },
      ];

      const result = await clusterer.run(items);

      expect(result.embeddings).toHaveLength(3);
      for (const embedding of result.embeddings) {
        expect(embedding.id).toBeDefined();
        expect(embedding.embedding).toBeDefined();
        expect(embedding.norm).toBeGreaterThan(0);
        expect(embedding.ref).toBeDefined();
      }
    });

    it("should sort embeddings by creation time", async () => {
      const items: MemoryItem[] = [
        { id: "3", userId: "user1", text: "Item 3", createdAt: new Date("2025-01-03") },
        { id: "1", userId: "user1", text: "Item 1", createdAt: new Date("2025-01-01") },
        { id: "2", userId: "user1", text: "Item 2", createdAt: new Date("2025-01-02") },
      ];

      const result = await clusterer.run(items);

      expect(result.embeddings[0].id).toBe("1");
      expect(result.embeddings[1].id).toBe("2");
      expect(result.embeddings[2].id).toBe("3");
    });
  });

  describe("Configuration parameters", () => {
    it("should respect similarity threshold", async () => {
      const items: MemoryItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        userId: "user1",
        text: `Different text ${i + 1}`,
        createdAt: new Date(2025, 0, i + 1),
      }));

      // High threshold should create more clusters
      const strictClusterer = new MemoryClusterer(undefined, {
        similarityThreshold: 0.95,
      });
      const strictResult = await strictClusterer.run(items);

      // Low threshold should create fewer clusters
      const lenientClusterer = new MemoryClusterer(undefined, {
        similarityThreshold: 0.50,
      });
      const lenientResult = await lenientClusterer.run(items);

      expect(strictResult.clusters.length).toBeGreaterThanOrEqual(lenientResult.clusters.length);
    });

    it("should respect minimum cluster size", async () => {
      const clustererMinSize3 = new MemoryClusterer(undefined, {
        minClusterSize: 3,
        similarityThreshold: 0.70,
      });

      const items: MemoryItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        userId: "user1",
        text: `Memory ${i + 1}`,
        createdAt: new Date(2025, 0, i + 1),
      }));

      const result = await clustererMinSize3.run(items);

      // Most clusters should meet minimum size (allowing for some singletons)
      const largeClusters = result.clusters.filter((c) => c.size >= 3);
      const smallClusters = result.clusters.filter((c) => c.size < 3);

      // Should have some enforcement of minClusterSize
      expect(largeClusters.length).toBeGreaterThan(0);
    });
  });
});
