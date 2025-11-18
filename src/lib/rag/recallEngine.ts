// src/lib/rag/recallEngine.ts
// Phase 58: Main recall engine orchestrating all RAG components

import { RecallOpts, RecallResult, ComponentTiming } from './types';
import { chooseStrategy } from './policy';
import { denseRetrieve } from './retrievers/dense';
import { sparseRetrieve } from './retrievers/sparse';
import { hybridRetrieve } from './retrievers/hybrid';
import { rerank } from './rerank';
import { getOrSetQueryCache } from './cache';
import { recordRecallMetrics, checkPerformanceThreshold } from './metrics';

/**
 * Main recall function - orchestrates the entire RAG pipeline
 *
 * Flow:
 * 1. Check cache
 * 2. Choose strategy (auto/dense/sparse/hybrid)
 * 3. Retrieve candidates
 * 4. Apply MMR re-ranking
 * 5. Cache results
 * 6. Record metrics
 *
 * @param query - User query text
 * @param opts - Recall options
 * @returns Recall result with items and diagnostics
 */
export async function recall(query: string, opts: RecallOpts): Promise<RecallResult> {
  const t0 = performance.now();
  const components: ComponentTiming[] = [];

  // 1) Determine strategy
  const strategy =
    opts.strategy && opts.strategy !== 'auto'
      ? opts.strategy
      : chooseStrategy(query, opts);

  const tStrategy = performance.now();
  components.push({ name: 'strategy_selection', tookMs: tStrategy - t0 });

  // 2) Check cache
  const tCacheStart = performance.now();
  const cached = await getOrSetQueryCache(
    opts.workspaceId,
    query,
    strategy,
    null, // Don't set yet, just check
    900 // 15 min TTL
  );

  const tCacheEnd = performance.now();
  components.push({ name: 'cache_check', tookMs: tCacheEnd - tCacheStart });

  if (cached.hit && cached.value) {
    const tookMs = performance.now() - t0;

    // Record metrics for cache hit
    await recordRecallMetrics({
      workspaceId: opts.workspaceId,
      strategy,
      tookMs,
      cacheHit: true,
      topK: cached.value.length,
      itemsRetrieved: cached.value.length,
      queryLength: query.split(/\s+/).length,
      timestamp: new Date(),
    });

    return {
      items: cached.value,
      diagnostics: {
        strategy,
        tookMs,
        cacheHit: true,
        components,
      },
    };
  }

  // 3) Retrieve candidates based on strategy
  const topK = opts.topK ?? 8;
  const tRetrieveStart = performance.now();

  let items;
  if (strategy === 'dense') {
    items = await denseRetrieve(query, opts.workspaceId, topK * 3);
  } else if (strategy === 'sparse') {
    items = await sparseRetrieve(query, opts.workspaceId, topK * 3);
  } else {
    // hybrid
    items = await hybridRetrieve(query, opts.workspaceId, topK * 3);
  }

  const tRetrieveEnd = performance.now();
  components.push({
    name: `retrieve_${strategy}`,
    tookMs: tRetrieveEnd - tRetrieveStart,
  });

  const itemsBeforeMMR = items.length;

  // 4) Apply re-ranking with MMR
  const tRerankStart = performance.now();

  if (opts.useMMR !== false) {
    items = rerank(items, {
      useMMR: true,
      mmrLambda: opts.mmrLambda ?? 0.65,
      topK,
    });
  } else {
    items = items.slice(0, topK);
  }

  const tRerankEnd = performance.now();
  components.push({ name: 'rerank_mmr', tookMs: tRerankEnd - tRerankStart });

  const itemsAfterMMR = items.length;

  // 5) Cache results
  const tCacheSetStart = performance.now();
  await getOrSetQueryCache(opts.workspaceId, query, strategy, items, 900);
  const tCacheSetEnd = performance.now();
  components.push({ name: 'cache_set', tookMs: tCacheSetEnd - tCacheSetStart });

  // 6) Record metrics
  const tookMs = performance.now() - t0;
  checkPerformanceThreshold(tookMs, 400); // Warn if > 400ms

  await recordRecallMetrics({
    workspaceId: opts.workspaceId,
    strategy,
    tookMs,
    cacheHit: false,
    topK,
    itemsRetrieved: items.length,
    queryLength: query.split(/\s+/).length,
    timestamp: new Date(),
  });

  return {
    items,
    diagnostics: {
      strategy,
      tookMs,
      cacheHit: false,
      components,
      itemsBeforeMMR,
      itemsAfterMMR,
    },
  };
}

/**
 * Batch recall for multiple queries
 * Processes queries in parallel with concurrency limit
 */
export async function recallBatch(
  queries: string[],
  opts: RecallOpts,
  concurrency = 3
): Promise<RecallResult[]> {
  const results: RecallResult[] = [];

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((query) => recall(query, opts))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Recall with fallback strategy
 * If primary strategy returns no results, try fallback
 */
export async function recallWithFallback(
  query: string,
  opts: RecallOpts
): Promise<RecallResult> {
  const result = await recall(query, opts);

  // If no results and using dense, try hybrid as fallback
  if (result.items.length === 0 && result.diagnostics.strategy === 'dense') {
    console.log('[RAG] No results from dense, trying hybrid fallback');
    return recall(query, { ...opts, strategy: 'hybrid' });
  }

  // If no results and using sparse, try hybrid as fallback
  if (result.items.length === 0 && result.diagnostics.strategy === 'sparse') {
    console.log('[RAG] No results from sparse, trying hybrid fallback');
    return recall(query, { ...opts, strategy: 'hybrid' });
  }

  return result;
}
