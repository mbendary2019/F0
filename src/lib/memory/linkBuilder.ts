// =============================================================
// Phase 59 — Cognitive Memory Mesh - Link Builder (High-Level API)
// Production TypeScript (Firebase Admin + Cached OpenAI Embeddings)
// =============================================================

import { db } from '@/lib/firebase-admin';
import { getManyOrEmbed } from '@/lib/ai/memory/snippetCache';
import {
  getRelatedByQueryEmbedding,
  getRelatedNodes,
  rebuildGraphForWorkspace,
  getGraphStats,
  deleteGraphForWorkspace,
} from './memoryGraph';
import type {
  RelatedNode,
  QueryRelatedParams,
  ManualEdgeParams,
  GraphBuildResult,
  GraphStats,
  MemoryEdgeType,
} from './types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * High-level API used by Phase 58 recallEngine or other consumers
 * to fetch graph-aware neighbors for a given query
 */
export async function queryRelatedNodes(params: QueryRelatedParams): Promise<RelatedNode[]> {
  const { workspaceId, queryText, queryEmbedding, threshold = 0.75, topK = 12 } = params;

  let embed: number[] | undefined = queryEmbedding;
  if (!embed && queryText) {
    const { vectors } = await getManyOrEmbed([queryText]);
    embed = vectors[0];
  }
  if (!embed) return [];

  return await getRelatedByQueryEmbedding(workspaceId, embed, threshold, topK);
}

/**
 * Query related nodes starting from a specific node ID
 */
export async function queryRelatedNodesFromNode(
  workspaceId: string,
  nodeId: string,
  topK = 12
): Promise<RelatedNode[]> {
  return await getRelatedNodes(workspaceId, nodeId, topK);
}

/**
 * Convenience: full rebuild for a workspace (semantic + temporal + feedback)
 */
export async function buildEdgesForWorkspace(
  workspaceId: string,
  options?: {
    semantic?: { threshold?: number; maxNeighbors?: number };
    temporal?: { halfLifeDays?: number };
    feedback?: { minWeight?: number };
    ttlDays?: number;
  }
): Promise<GraphBuildResult> {
  return await rebuildGraphForWorkspace(workspaceId, options || {});
}

/**
 * Get graph statistics for a workspace
 */
export async function getWorkspaceGraphStats(workspaceId: string): Promise<GraphStats> {
  return await getGraphStats(workspaceId);
}

/**
 * Delete all graph edges for a workspace (nodes remain in snippets collection)
 */
export async function deleteWorkspaceGraph(workspaceId: string): Promise<{ deleted: number }> {
  return await deleteGraphForWorkspace(workspaceId);
}

/**
 * Utility: ensure a manual edge between two nodes (admin tooling)
 */
export async function ensureManualEdge(params: ManualEdgeParams): Promise<{ id: string }> {
  const { workspaceId, from, to, relation, weight = 0.9, meta } = params;
  const now = new Date().toISOString();
  const id = `${from}_${to}_${relation}`;

  await db
    .collection('ops_memory_edges')
    .doc(id)
    .set(
      {
        id,
        workspaceId,
        from,
        to,
        relation,
        weight,
        meta: meta || {},
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

  return { id };
}

/**
 * Utility: delete a specific edge
 */
export async function deleteEdge(edgeId: string): Promise<void> {
  await db.collection('ops_memory_edges').doc(edgeId).delete();
}

/**
 * Utility: update edge weight
 */
export async function updateEdgeWeight(
  edgeId: string,
  newWeight: number,
  meta?: Record<string, any>
): Promise<void> {
  const updates: any = {
    weight: newWeight,
    updatedAt: new Date().toISOString(),
  };
  if (meta) updates.meta = meta;

  await db.collection('ops_memory_edges').doc(edgeId).update(updates);
}

/**
 * Incremental edge builder: add edges for newly added snippets
 * (useful for real-time updates without full rebuild)
 */
export async function buildEdgesForNewSnippets(
  workspaceId: string,
  snippetIds: string[],
  options?: {
    semanticThreshold?: number;
    maxNeighbors?: number;
    ttlDays?: number;
  }
): Promise<{ inserted: number }> {
  const { semanticThreshold = 0.85, maxNeighbors = 12, ttlDays = 90 } = options || {};
  const nowIso = new Date().toISOString();
  const expire_at = ttlDays
    ? Timestamp.fromDate(new Date(Date.now() + ttlDays * 24 * 3600 * 1000))
    : undefined;

  // Fetch new snippets
  const newSnippets = await Promise.all(
    snippetIds.map(async (id) => {
      const doc = await db.collection('ops_memory_snippets').doc(id).get();
      if (!doc.exists) return null;
      return {
        id: doc.id,
        text: (doc.get('text') as string) || '',
        embedding: doc.get('embedding') as number[] | undefined,
      };
    })
  );
  const validSnippets = newSnippets.filter((s) => s !== null) as Array<{
    id: string;
    text: string;
    embedding?: number[];
  }>;

  if (!validSnippets.length) return { inserted: 0 };

  // Ensure embeddings
  const missing: { idx: number; text: string }[] = [];
  for (let i = 0; i < validSnippets.length; i++) {
    if (!validSnippets[i].embedding) {
      missing.push({ idx: i, text: validSnippets[i].text });
    }
  }
  if (missing.length) {
    const { vectors } = await getManyOrEmbed(missing.map((m) => m.text));
    missing.forEach((m, k) => {
      validSnippets[m.idx].embedding = vectors[k];
    });
  }

  // Fetch existing snippets in workspace
  const existingDocs = await db
    .collection('ops_memory_snippets')
    .where('workspaceId', '==', workspaceId)
    .limit(5000)
    .get();
  const existingSnippets = existingDocs.docs.map((d) => ({
    id: d.id,
    text: (d.get('text') as string) || '',
    embedding: d.get('embedding') as number[] | undefined,
  }));

  // Build edges between new and existing
  const edges: any[] = [];
  const { cosineSimilarity } = await import('./memoryGraph');

  for (const newSnip of validSnippets) {
    const sims: { id: string; sim: number }[] = [];
    for (const existingSnip of existingSnippets) {
      if (newSnip.id === existingSnip.id) continue;
      const sim = cosineSimilarity(newSnip.embedding, existingSnip.embedding);
      if (sim >= semanticThreshold) {
        sims.push({ id: existingSnip.id, sim });
      }
    }
    sims.sort((a, b) => b.sim - a.sim);
    const keep = sims.slice(0, maxNeighbors);

    for (const { id: targetId, sim } of keep) {
      const id1 = `${newSnip.id}_${targetId}_semantic`;
      const id2 = `${targetId}_${newSnip.id}_semantic`;
      const base = {
        workspaceId,
        relation: 'semantic' as const,
        weight: Number(sim.toFixed(6)),
        meta: { similarity: sim },
        createdAt: nowIso,
        updatedAt: nowIso,
        expire_at,
      };
      edges.push({ id: id1, from: newSnip.id, to: targetId, ...base });
      edges.push({ id: id2, from: targetId, to: newSnip.id, ...base });
    }
  }

  // Batch insert
  const BATCH_SIZE = 500;
  for (let i = 0; i < edges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = edges.slice(i, i + BATCH_SIZE);
    for (const e of chunk) {
      batch.set(db.collection('ops_memory_edges').doc(e.id), e, { merge: true });
    }
    await batch.commit();
  }

  return { inserted: edges.length };
}

/**
 * Get edge count by type for a workspace
 */
export async function getEdgeCountByType(
  workspaceId: string
): Promise<{ semantic: number; temporal: number; feedback: number }> {
  const edges = await db
    .collection('ops_memory_edges')
    .where('workspaceId', '==', workspaceId)
    .limit(50000)
    .get();

  const counts = {
    semantic: 0,
    temporal: 0,
    feedback: 0,
  };

  for (const doc of edges.docs) {
    const rel = doc.get('relation') as MemoryEdgeType;
    if (rel in counts) counts[rel]++;
  }

  return counts;
}

/**
 * Find the shortest path between two nodes (BFS)
 */
export async function findShortestPath(
  workspaceId: string,
  fromNodeId: string,
  toNodeId: string,
  maxDepth = 5
): Promise<{ path: string[]; length: number } | null> {
  if (fromNodeId === toNodeId) return { path: [fromNodeId], length: 0 };

  const visited = new Set<string>();
  const queue: { nodeId: string; path: string[] }[] = [{ nodeId: fromNodeId, path: [fromNodeId] }];
  visited.add(fromNodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.path.length > maxDepth) continue;

    // Get neighbors
    const neighbors = await getRelatedNodes(workspaceId, current.nodeId, 50);

    for (const neighbor of neighbors) {
      if (neighbor.nodeId === toNodeId) {
        const path = [...current.path, toNodeId];
        return { path, length: path.length - 1 };
      }

      if (!visited.has(neighbor.nodeId)) {
        visited.add(neighbor.nodeId);
        queue.push({
          nodeId: neighbor.nodeId,
          path: [...current.path, neighbor.nodeId],
        });
      }
    }
  }

  return null; // No path found
}
