#!/usr/bin/env tsx
// scripts/benchmark-rag.ts
// Phase 58: RAG system benchmark suite

import { recall } from '../src/lib/rag/recallEngine';
import { calculatePerformanceSummary } from '../src/lib/rag/metrics';

/**
 * Benchmark queries for testing
 */
const BENCHMARK_QUERIES = [
  // Natural language queries (should use dense)
  'How do I deploy my application to production?',
  'What are the best practices for error handling in TypeScript?',
  'Explain the difference between server and client components',

  // Keyword queries (should use sparse)
  '"firebase deploy" command',
  'file:package.json dependencies',
  'function handleSubmit',

  // Code queries (should use hybrid)
  'async function getData() { const res = await fetch }',
  'interface User { id: string; name: string }',
  'import { useState } from "react"',

  // Short queries (should use hybrid)
  'login error',
  'api routes',
  'environment variables',

  // Long queries (should use dense)
  'I need to implement a new authentication flow that supports both email and social login providers while maintaining security best practices',
  'Can you help me understand how to structure my Next.js application with server-side rendering and client-side interactivity?',
];

/**
 * NDCG calculation (simplified for demo)
 */
function calculateNDCG(relevanceScores: number[], k: number): number {
  const dcg = relevanceScores
    .slice(0, k)
    .reduce((sum, rel, i) => sum + (Math.pow(2, rel) - 1) / Math.log2(i + 2), 0);

  const idealRel = [...relevanceScores].sort((a, b) => b - a);
  const idcg = idealRel
    .slice(0, k)
    .reduce((sum, rel, i) => sum + (Math.pow(2, rel) - 1) / Math.log2(i + 2), 0);

  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Run benchmark
 */
async function runBenchmark() {
  console.log('🚀 Phase 58 RAG Benchmark\n');
  console.log('=' .repeat(60));

  const workspaceId = process.env.TEST_WORKSPACE_ID || 'test_workspace';
  const latencies: number[] = [];
  const strategies: Record<string, number> = {};
  const cacheHits = { hits: 0, misses: 0 };

  console.log(`\nRunning ${BENCHMARK_QUERIES.length} queries...\n`);

  for (let i = 0; i < BENCHMARK_QUERIES.length; i++) {
    const query = BENCHMARK_QUERIES[i];
    console.log(`[${i + 1}/${BENCHMARK_QUERIES.length}] ${query.substring(0, 50)}...`);

    try {
      const result = await recall(query, {
        workspaceId,
        topK: 10,
        strategy: 'auto',
        useMMR: true,
      });

      // Track metrics
      latencies.push(result.diagnostics.tookMs);
      strategies[result.diagnostics.strategy] =
        (strategies[result.diagnostics.strategy] || 0) + 1;

      if (result.diagnostics.cacheHit) {
        cacheHits.hits++;
      } else {
        cacheHits.misses++;
      }

      console.log(`  ✓ ${result.diagnostics.strategy} | ${result.diagnostics.tookMs.toFixed(0)}ms | ${result.items.length} items`);
    } catch (error) {
      console.error(`  ✗ Error: ${error}`);
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Results:\n');

  const perf = calculatePerformanceSummary(latencies);
  console.log('Latency:');
  console.log(`  P50: ${perf.p50.toFixed(0)}ms`);
  console.log(`  P95: ${perf.p95.toFixed(0)}ms`);
  console.log(`  P99: ${perf.p99.toFixed(0)}ms`);
  console.log(`  Mean: ${perf.mean.toFixed(0)}ms`);
  console.log(`  Min: ${perf.min.toFixed(0)}ms`);
  console.log(`  Max: ${perf.max.toFixed(0)}ms`);

  console.log('\nStrategy Usage:');
  for (const [strategy, count] of Object.entries(strategies)) {
    const percentage = ((count / BENCHMARK_QUERIES.length) * 100).toFixed(1);
    console.log(`  ${strategy}: ${count} (${percentage}%)`);
  }

  console.log('\nCache Performance:');
  const hitRate = (cacheHits.hits / (cacheHits.hits + cacheHits.misses)) * 100;
  console.log(`  Hits: ${cacheHits.hits}`);
  console.log(`  Misses: ${cacheHits.misses}`);
  console.log(`  Hit Rate: ${hitRate.toFixed(1)}%`);

  // Check acceptance criteria
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Acceptance Criteria:\n');

  const p95Pass = perf.p95 <= 400;
  console.log(`  P95 ≤ 400ms: ${p95Pass ? '✓ PASS' : '✗ FAIL'} (${perf.p95.toFixed(0)}ms)`);

  console.log('\n  Note: NDCG@10 requires manual relevance judgments');
  console.log('  Target: NDCG@10 ≥ 0.85');

  console.log('\n' + '='.repeat(60));

  // Exit with appropriate code
  process.exit(p95Pass ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  runBenchmark().catch(console.error);
}

export { runBenchmark };
