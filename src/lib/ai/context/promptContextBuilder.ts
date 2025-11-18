// src/lib/ai/context/promptContextBuilder.ts
// Build context blocks from top clusters with token budgeting and salience scoring
// Phase 57: Integrated with feedback-based ranking
// Phase 57.1: MMR-based snippet selection for diversity

import OpenAI from "openai";
import { getContextForQuery } from "../memory/fetchClusterContext";
import { defaultBudget, estimateTokens, fitSnippetsToBudget } from "./tokenBudget";
import { ContextBlock, renderContextBlocks, SYSTEM_BASE, composeMessages } from "./promptPolicies";
import { rankClusters } from "../feedback/rankScore";
import type { WeightingParams } from "../feedback/feedbackSchema";
import { extractSnippets, type MemoryRecord } from "../memory/snippetExtractor";
import { mmr, type SnippetVec } from "../memory/mmr";
import { getManyOrEmbed, getOrEmbedSnippet } from "../memory/snippetCache";
import { recordCacheStats, dayKey } from "../telemetry/snippetMetrics";

export type BuildContextParams = {
  userId: string;
  query: string;
  lang?: "ar" | "en" | string;
  topK?: number; // Clusters to fetch & rank
  perClusterSnippetLimit?: number; // Items per cluster to compress
  ctxBudgetTokens?: number; // Override context budget
  useFeedbackRanking?: boolean; // Enable feedback-based ranking (default: true)
  rankingParams?: Partial<WeightingParams>; // Custom blend coefficients
  useMMRSnippets?: boolean; // Enable MMR snippet selection (default: false)
  mmrLambda?: number; // MMR lambda parameter (default: 0.65)
  snippetBudgetTokens?: number; // Token budget per cluster for snippets (default: 900)
};

export async function buildPromptForTurn({
  userId,
  query,
  lang = "en",
  topK = 3,
  perClusterSnippetLimit = 4,
  ctxBudgetTokens,
  useFeedbackRanking = true,
  rankingParams,
  useMMRSnippets = false,
  mmrLambda = 0.65,
  snippetBudgetTokens = 900,
}: BuildContextParams) {
  const budget = defaultBudget();
  const maxCtx = typeof ctxBudgetTokens === "number" ? ctxBudgetTokens : budget.ctxMaxTokens;

  // 1) Pull top clusters for the query (cosine-retrieval over centroids)
  const scored = await getContextForQuery({ userId, query, topK, candidateLimit: 400 });

  // 2) Apply feedback-based ranking if enabled
  let rankedClusters = scored;

  if (useFeedbackRanking && scored.length > 0) {
    console.log("[buildPromptForTurn] Applying feedback-based ranking...");

    const rankingInputs = scored.map(({ cluster, score }) => ({
      cluster,
      similarity: score,
      queryTimestamp: Date.now(),
    }));

    const ranked = rankClusters(rankingInputs, rankingParams);

    // Replace similarity scores with blended scores
    rankedClusters = ranked.map(({ cluster, blended_score }) => ({
      cluster,
      score: blended_score,
    }));

    console.log(
      `[buildPromptForTurn] Re-ranked ${rankedClusters.length} clusters using feedback weights`
    );
  }

  // 3) Convert to candidate context blocks with MMR snippets if enabled
  const blocks: ContextBlock[] = [];

  for (const { cluster, score } of rankedClusters) {
    const header = cluster.title || `Cluster ${cluster.cluster_id}`;

    let body: string;
    if (useMMRSnippets) {
      // Phase 57.1: Use MMR to select diverse, relevant snippets
      body = await buildClusterBodyWithMMR(cluster, query, {
        lang,
        perClusterSnippetLimit,
        mmrLambda,
        snippetBudgetTokens,
      });
    } else {
      // Original: Simple summary + tags
      body = compactBody(cluster.summary, cluster.tags, perClusterSnippetLimit);
    }

    blocks.push({
      title: header,
      body,
      source: { clusterId: cluster.cluster_id, tags: cluster.tags },
      score,
    });
  }

  // 4) Blocks are already sorted by blended score (no need to re-sort)

  // 4) Apply token budgeting
  const serializations = blocks.map((b) => serializeBlock(b));
  const { included } = fitSnippetsToBudget(serializations, maxCtx);

  // 5) Render context and compose messages
  const context = renderContextBlocks(deserializeBlocks(included), lang);
  const system = SYSTEM_BASE(lang);
  const messages = composeMessages({ system, user: query, context });

  return {
    messages,
    contextTokens: included.reduce((s, x) => s + estimateTokens(x), 0),
    includedBlocks: deserializeBlocks(included),
  };
}

function compactBody(summary: string, tags: string[], limit: number): string {
  const t = tags?.length ? `\nTags: ${tags.slice(0, 8).join(", ")}` : "";
  // You can enrich with representative memory excerpts in future iterations
  return `${summary?.trim() || ""}${t}`.trim();
}

/**
 * Build cluster body with MMR-selected snippets
 * Phase 57.1: Extract snippets from cluster memories and select diverse ones via MMR
 */
async function buildClusterBodyWithMMR(
  cluster: any,
  query: string,
  options: {
    lang: string;
    perClusterSnippetLimit: number;
    mmrLambda: number;
    snippetBudgetTokens: number;
  }
): Promise<string> {
  const { lang, perClusterSnippetLimit, mmrLambda, snippetBudgetTokens } = options;

  // Start with summary and tags
  const summarySection = cluster.summary?.trim() || "";
  const tagsSection = cluster.tags?.length ? `Tags: ${cluster.tags.slice(0, 8).join(", ")}` : "";

  // TODO: Wire actual memory texts from cluster.item_ids
  // For now, create placeholder memory records
  // In production, you would fetch these from Firestore using item_ids
  const memoryRecords: MemoryRecord[] = (cluster.item_ids || []).slice(0, 16).map((id: string) => ({
    id: String(id),
    text: `Memory item ${id}`, // Placeholder - should be actual text
    createdAt: Date.now(),
  }));

  if (!memoryRecords.length) {
    // No memories: fall back to summary only
    return [summarySection, tagsSection].filter(Boolean).join("\n").trim();
  }

  try {
    // Extract snippets from memories
    const rawSnippets = extractSnippets(memoryRecords, {
      maxPerItem: 2,
      maxLen: 220,
      dedupe: true,
    });

    if (!rawSnippets.length) {
      return [summarySection, tagsSection].filter(Boolean).join("\n").trim();
    }

    // Embed query and snippets using cache (Phase 57.2)
    const snippetTexts = rawSnippets.map((s) => s.text);
    const allTexts = [query, ...snippetTexts];

    // Get cached embeddings with snip_ids
    const startTime = Date.now();
    const { hits, misses, stats } = await getManyOrEmbed(allTexts);

    // Create embedding map with snip_id tracking
    const embeddingMap = new Map<string, { embedding: number[]; snip_id: string }>();
    [...hits, ...misses].forEach((r) => {
      embeddingMap.set(r.text.toLowerCase().trim(), {
        embedding: r.embedding,
        snip_id: r.snip_id,
      });
    });

    // Extract embeddings in original order
    const embeddings = allTexts.map((text) => {
      const normalized = text.toLowerCase().trim();
      return embeddingMap.get(normalized)?.embedding || [];
    });

    const [queryVec, ...snippetVecs] = embeddings;

    // Record cache metrics
    const latencyMs = Date.now() - startTime;
    recordCacheStats(dayKey(), stats, latencyMs).catch((err) => {
      console.warn("[buildClusterBodyWithMMR] Failed to record metrics:", err);
    });

    // Create SnippetVec pool for MMR with snip_id from cache
    const pool: SnippetVec[] = rawSnippets.map((s, i) => {
      const normalized = s.text.toLowerCase().trim();
      const cached = embeddingMap.get(normalized);

      return {
        id: s.id,
        text: s.text,
        vec: snippetVecs[i],
        metadata: {
          snip_id: cached?.snip_id, // Store for feedback tracking
        },
      };
    });

    // Run MMR to select diverse, relevant snippets
    const selected = mmr(queryVec, pool, {
      lambda: mmrLambda,
      k: Math.min(perClusterSnippetLimit, pool.length),
      minRelevance: 0.3,
    });

    // Build snippets section with token budgeting
    const snippetLines: string[] = [];
    let budget = snippetBudgetTokens;

    for (const snippet of selected) {
      const line = `• ${snippet.text}`;
      const tokens = estimateTokens(line);

      if (budget - tokens <= 0) break;

      budget -= tokens;
      snippetLines.push(line);
    }

    const snippetsSection =
      snippetLines.length > 0
        ? `\nSnippets (${snippetLines.length}):\n${snippetLines.join("\n")}`
        : "";

    return [summarySection, tagsSection, snippetsSection].filter(Boolean).join("\n").trim();
  } catch (error) {
    console.error("[buildClusterBodyWithMMR] Error:", error);
    // Fall back to summary on error
    return [summarySection, tagsSection].filter(Boolean).join("\n").trim();
  }
}

/**
 * Embed texts using cached snippet embeddings (Phase 57.2)
 * Automatically uses Firestore cache for cost/latency optimization
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const startTime = Date.now();

  if (!texts.length) return [];

  // Use batch cache for multiple texts
  const { hits, misses, stats } = await getManyOrEmbed(texts);

  // Combine hits and misses, maintaining order
  const embeddingMap = new Map<string, number[]>();
  [...hits, ...misses].forEach((r) => {
    embeddingMap.set(r.text.toLowerCase().trim(), r.embedding);
  });

  // Map back to original order
  const results = texts.map((text) => {
    const normalized = text.toLowerCase().trim();
    return embeddingMap.get(normalized) || [];
  });

  // Record metrics
  const latencyMs = Date.now() - startTime;
  recordCacheStats(dayKey(), stats, latencyMs).catch((err) => {
    console.warn("[embedTexts] Failed to record metrics:", err);
  });

  console.log(
    `[embedTexts] Embedded ${texts.length} texts (${stats.cacheHits} hits, ${stats.cacheMisses} misses) in ${latencyMs}ms`
  );

  return results;
}

function serializeBlock(b: ContextBlock): string {
  const parts = [
    `## ${b.title}`,
    b.source.clusterId ? `cluster: ${b.source.clusterId}` : "",
    b.source.tags?.length ? `tags: ${b.source.tags.join(", ")}` : "",
    typeof b.score === "number" ? `score: ${b.score.toFixed(3)}` : "",
    b.body,
  ].filter(Boolean);
  return parts.join("\n");
}

function deserializeBlocks(arr: string[]): ContextBlock[] {
  return arr.map((s) => {
    // Minimal parser: split by lines
    const lines = s.split(/\n+/);
    const titleLine = lines.find((l) => l.startsWith("## ")) || "## Untitled";
    const title = titleLine.replace(/^##\s+/, "").trim();
    const clusterLine = lines.find((l) => l.startsWith("cluster:"));
    const tagsLine = lines.find((l) => l.startsWith("tags:"));
    const scoreLine = lines.find((l) => l.startsWith("score:"));
    const bodyStart = lines.findIndex((l) => l === titleLine);
    const metaEnd = Math.max(
      lines.indexOf(clusterLine || ""),
      lines.indexOf(tagsLine || ""),
      lines.indexOf(scoreLine || "")
    );
    const body = lines.slice((metaEnd > 0 ? metaEnd : bodyStart) + 1).join("\n").trim();
    return {
      title,
      body,
      source: {
        clusterId: clusterLine?.split(":")[1]?.trim(),
        tags: tagsLine?.split(":")[1]?.split(",").map((s) => s.trim()).filter(Boolean),
      },
      score: scoreLine ? Number(scoreLine.split(":")[1]) : undefined,
    } as ContextBlock;
  });
}
