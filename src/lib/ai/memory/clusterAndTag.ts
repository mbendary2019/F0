// src/lib/ai/memory/clusterAndTag.ts
// High-level integration: cluster memories + auto-tag with LLM
// Example usage in your application

import OpenAI from "openai";
import MemoryClusterer, { type MemoryItem, type Cluster } from "./clusterMemory";
import AutoTagger, { type AutoTagResult } from "./autoTagMemory";

export type ClusterWithMetadata = {
  cluster: Cluster;
  metadata: AutoTagResult;
};

export type ClusterAndTagParams = {
  /** OpenAI API key (optional, falls back to env) */
  apiKey?: string;
  /** Embedding model for clustering */
  embeddingModel?: string;
  /** Chat model for tagging */
  chatModel?: string;
  /** Similarity threshold for clustering (0-1) */
  similarityThreshold?: number;
  /** Minimum cluster size */
  minClusterSize?: number;
  /** Maximum cluster size */
  maxClusterSize?: number;
  /** Concurrency for embedding requests */
  concurrency?: number;
  /** Locale for auto-tagging (ar/en) */
  locale?: "ar" | "en" | string;
};

/**
 * Main entry point: cluster memories and generate metadata for each cluster.
 *
 * @param memories - Array of memory items to cluster
 * @param params - Configuration options
 * @returns Array of clusters with their auto-generated metadata
 *
 * @example
 * ```typescript
 * const memories = [
 *   { id: '1', userId: 'user123', text: 'Implemented Firebase auth', createdAt: new Date() },
 *   { id: '2', userId: 'user123', text: 'Fixed login bug', createdAt: new Date() },
 *   { id: '3', userId: 'user123', text: 'Added pricing page', createdAt: new Date() },
 * ];
 *
 * const results = await clusterAndTag(memories, {
 *   similarityThreshold: 0.83,
 *   locale: 'en'
 * });
 *
 * // results = [
 * //   {
 * //     cluster: { clusterId: 'cl_abc123', itemIds: ['1', '2'], size: 2, ... },
 * //     metadata: { title: 'Authentication Issues', summary: '...', tags: ['auth', 'firebase'], confidence: 0.89 }
 * //   },
 * //   ...
 * // ]
 * ```
 */
export async function clusterAndTag(
  memories: MemoryItem[],
  params: ClusterAndTagParams = {}
): Promise<ClusterWithMetadata[]> {
  if (!memories?.length) {
    return [];
  }

  // Initialize OpenAI client
  const client = new OpenAI({
    apiKey: params.apiKey ?? process.env.OPENAI_API_KEY
  });

  // Step 1: Cluster memories
  console.log(`[clusterAndTag] Clustering ${memories.length} memories...`);
  const clusterer = new MemoryClusterer(client, {
    embeddingModel: params.embeddingModel ?? "text-embedding-3-large",
    similarityThreshold: params.similarityThreshold ?? 0.82,
    minClusterSize: params.minClusterSize ?? 2,
    maxClusterSize: params.maxClusterSize ?? 100,
    concurrency: params.concurrency ?? 6,
  });

  const { clusters, embeddings } = await clusterer.run(memories);
  console.log(`[clusterAndTag] Created ${clusters.length} clusters`);

  // Step 2: Auto-tag each cluster
  const tagger = new AutoTagger(client, {
    model: params.chatModel ?? "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 600,
  });

  const results: ClusterWithMetadata[] = [];

  for (const cluster of clusters) {
    // Extract sample texts from cluster (up to 8 items, prioritize by recency)
    const clusterMemories = cluster.itemIds
      .map((id) => embeddings.find((e) => e.id === id))
      .filter((e) => e !== undefined)
      .sort((a, b) => {
        const timeA = new Date(a.ref.createdAt ?? 0).getTime();
        const timeB = new Date(b.ref.createdAt ?? 0).getTime();
        return timeB - timeA; // most recent first
      })
      .slice(0, 8)
      .map((e) => e.ref.text);

    console.log(
      `[clusterAndTag] Tagging cluster ${cluster.clusterId} with ${clusterMemories.length} samples...`
    );

    const metadata = await tagger.run({
      clusterId: cluster.clusterId,
      samples: clusterMemories,
      locale: params.locale,
    });

    results.push({ cluster, metadata });
  }

  console.log(`[clusterAndTag] Completed tagging for ${results.length} clusters`);
  return results;
}

/**
 * Helper: Format cluster with metadata for display
 */
export function formatClusterDisplay(item: ClusterWithMetadata): string {
  const { cluster, metadata } = item;
  return [
    `📌 ${metadata.title}`,
    `   Summary: ${metadata.summary}`,
    `   Tags: ${metadata.tags.join(", ")}`,
    `   Size: ${cluster.size} items`,
    `   Confidence: ${(metadata.confidence * 100).toFixed(0)}%`,
    `   Representative ID: ${cluster.representativeId}`,
    `   Similarity: avg=${cluster.similarityStats.avg.toFixed(2)}, min=${cluster.similarityStats.min.toFixed(2)}, max=${cluster.similarityStats.max.toFixed(2)}`,
  ].join("\n");
}

/**
 * Helper: Export clusters to JSON for storage
 */
export function exportClustersToJSON(items: ClusterWithMetadata[]): string {
  return JSON.stringify(
    items.map((item) => ({
      clusterId: item.cluster.clusterId,
      title: item.metadata.title,
      summary: item.metadata.summary,
      tags: item.metadata.tags,
      confidence: item.metadata.confidence,
      itemIds: item.cluster.itemIds,
      size: item.cluster.size,
      representativeId: item.cluster.representativeId,
      similarityStats: item.cluster.similarityStats,
    })),
    null,
    2
  );
}

/**
 * Helper: Filter clusters by minimum confidence threshold
 */
export function filterByConfidence(
  items: ClusterWithMetadata[],
  minConfidence: number
): ClusterWithMetadata[] {
  return items.filter((item) => item.metadata.confidence >= minConfidence);
}

/**
 * Helper: Filter clusters by size
 */
export function filterBySize(
  items: ClusterWithMetadata[],
  minSize?: number,
  maxSize?: number
): ClusterWithMetadata[] {
  return items.filter((item) => {
    if (minSize !== undefined && item.cluster.size < minSize) return false;
    if (maxSize !== undefined && item.cluster.size > maxSize) return false;
    return true;
  });
}

/**
 * Helper: Find clusters containing specific tags
 */
export function findClustersByTag(
  items: ClusterWithMetadata[],
  tags: string[]
): ClusterWithMetadata[] {
  const normalizedTags = tags.map((t) => t.toLowerCase());
  return items.filter((item) =>
    item.metadata.tags.some((tag) =>
      normalizedTags.includes(tag.toLowerCase())
    )
  );
}

export default clusterAndTag;
