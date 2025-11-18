#!/usr/bin/env tsx
// =============================================================
// Phase 59 — Cognitive Memory Mesh - Benchmark Script
// =============================================================

import { performance } from 'perf_hooks';
import {
  buildEdgesForWorkspace,
  queryRelatedNodes,
  getWorkspaceGraphStats,
} from '../src/lib/memory/linkBuilder';

const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || 'test_workspace';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function runBenchmark() {
  log('blue', '\n=== Phase 59: Memory Graph Benchmark ===\n');

  // Step 1: Build graph
  log('yellow', '📊 Step 1: Building memory graph...');
  const t0 = performance.now();

  try {
    const buildResult = await buildEdgesForWorkspace(WORKSPACE_ID, {
      semantic: { threshold: 0.85, maxNeighbors: 12 },
      temporal: { halfLifeDays: 21 },
      feedback: { minWeight: 0.2 },
      ttlDays: 90,
    });

    const buildTime = performance.now() - t0;
    log('green', `✅ Graph built in ${buildTime.toFixed(0)}ms`);
    console.log('   Build result:', buildResult);
  } catch (error: any) {
    log('red', `❌ Build failed: ${error.message}`);
    return;
  }

  // Step 2: Get stats
  log('yellow', '\n📈 Step 2: Fetching graph statistics...');
  try {
    const stats = await getWorkspaceGraphStats(WORKSPACE_ID);
    log('green', '✅ Stats fetched');
    console.log('   Stats:', JSON.stringify(stats, null, 2));
  } catch (error: any) {
    log('red', `❌ Stats failed: ${error.message}`);
  }

  // Step 3: Query benchmark
  log('yellow', '\n🔍 Step 3: Benchmarking queries...');

  const queries = [
    'how to deploy functions to firebase',
    'authentication and security setup',
    'configure firestore indexes',
    'semantic search with embeddings',
    'memory graph implementation',
  ];

  const latencies: number[] = [];

  for (const q of queries) {
    const t1 = performance.now();
    try {
      const results = await queryRelatedNodes({
        workspaceId: WORKSPACE_ID,
        queryText: q,
        threshold: 0.75,
        topK: 12,
      });
      const latency = performance.now() - t1;
      latencies.push(latency);

      console.log(`   Query: "${q}"`);
      console.log(`   Latency: ${latency.toFixed(0)}ms | Results: ${results.length}`);
    } catch (error: any) {
      log('red', `   ❌ Query failed: ${error.message}`);
    }
  }

  // Calculate metrics
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const mean = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;

    log('yellow', '\n📊 Performance Summary:');
    console.log(`   Mean latency:   ${mean.toFixed(0)}ms`);
    console.log(`   P50 latency:    ${p50.toFixed(0)}ms`);
    console.log(`   P95 latency:    ${p95.toFixed(0)}ms`);
    console.log(`   P99 latency:    ${p99.toFixed(0)}ms`);
    console.log(`   Min latency:    ${sorted[0].toFixed(0)}ms`);
    console.log(`   Max latency:    ${sorted[sorted.length - 1].toFixed(0)}ms`);

    // Target checks
    log('yellow', '\n🎯 Target Validation:');
    const p95Target = 500; // 500ms target
    if (p95 <= p95Target) {
      log('green', `   ✅ P95 latency (${p95.toFixed(0)}ms) ≤ ${p95Target}ms`);
    } else {
      log('red', `   ❌ P95 latency (${p95.toFixed(0)}ms) > ${p95Target}ms`);
    }
  }

  log('blue', '\n=== Benchmark Complete ===\n');
}

// Run benchmark
runBenchmark().catch((error) => {
  log('red', `\n❌ Benchmark failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
