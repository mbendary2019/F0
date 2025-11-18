// =============================================================
// Phase 59 — Cognitive Memory Mesh - Memory Graph Engine
// Production TypeScript (Firebase Admin + Cached OpenAI Embeddings)
// =============================================================

import { db } from '@/lib/firebase-admin';
import {
  DEFAULT_GRAPH_OPTS,
  BuildGraphOptions,
  MemoryEdge,
  MemoryEdgeType,
  MemoryNode,
  RelatedNode,
  GraphBuildResult,
  GraphStats,
} from './types';
import { Timestamp } from 'firebase-admin/firestore';
import { getManyOrEmbed } from '@/lib/ai/memory/snippetCache'; // Phase 57.2 (cached embeddings)

// ---------- Math utils ----------
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(a.reduce((s, x) => s + x * x, 0));
}

export function cosineSimilarity(a?: number[], b?: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  return dot(a, b) / (na * nb);
}

// ---------- Collection helpers ----------
const SNIPPETS = 'ops_memory_snippets';
const EDGES = 'ops_memory_edges';
const FEEDBACK = 'ops_memory_snippet_feedback';

// ---------- Node fetchers ----------
export async function listSnippetNodes(workspaceId: string): Promise<MemoryNode[]> {
  const qs = await db
    .collection(SNIPPETS)
    .where('workspaceId', '==', workspaceId)
    .limit(5000)
    .get();

  return qs.docs.map((d) => ({
    id: d.id,
    workspaceId,
    type: 'snippet' as const,
    text: (d.get('text') as string) || '',
    embedding: d.get('embedding') as number[] | undefined,
    createdAt: (d.get('created_at') as string) || new Date().toISOString(),
    updatedAt: (d.get('last_used_at') as string) || new Date().toISOString(),
    useCount: d.get('use_count') as number | undefined,
    lastUsedAt: (d.get('last_used_at') as string) || undefined,
  }));
}

export async function getNodeById(
  workspaceId: string,
  nodeId: string
): Promise<MemoryNode | null> {
  const doc = await db.collection(SNIPPETS).doc(nodeId).get();
  if (!doc.exists || doc.get('workspaceId') !== workspaceId) return null;

  return {
    id: doc.id,
    workspaceId,
    type: 'snippet',
    text: (doc.get('text') as string) || '',
    embedding: doc.get('embedding') as number[] | undefined,
    createdAt: (doc.get('created_at') as string) || new Date().toISOString(),
    updatedAt: (doc.get('last_used_at') as string) || new Date().toISOString(),
    useCount: doc.get('use_count') as number | undefined,
    lastUsedAt: (doc.get('last_used_at') as string) || undefined,
  };
}

// ---------- Edge helpers ----------
function edgeId(from: string, to: string, relation: MemoryEdgeType): string {
  return `${from}_${to}_${relation}`;
}

async function upsertEdge(edge: MemoryEdge): Promise<void> {
  await db.collection(EDGES).doc(edge.id).set(edge, { merge: true });
}

async function batchUpsertEdges(edges: MemoryEdge[]): Promise<void> {
  if (!edges.length) return;

  // Firestore batch limit is 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < edges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = edges.slice(i, i + BATCH_SIZE);
    for (const e of chunk) {
      batch.set(db.collection(EDGES).doc(e.id), e, { merge: true });
    }
    await batch.commit();
  }
}

// ---------- Semantic edges ----------
export async function computeSemanticEdges(
  workspaceId: string,
  nodes: MemoryNode[],
  { threshold, maxNeighbors }: BuildGraphOptions['semantic'],
  ttlDays?: number
): Promise<{ inserted: number }> {
  const nowIso = new Date().toISOString();
  const expire_at = ttlDays
    ? Timestamp.fromDate(new Date(Date.now() + ttlDays * 24 * 3600 * 1000))
    : undefined;

  // Ensure all nodes have embeddings (reuse cache)
  const missing: { idx: number; text: string }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].embedding) missing.push({ idx: i, text: nodes[i].text });
  }
  if (missing.length) {
    const { vectors } = await getManyOrEmbed(missing.map((m) => m.text));
    missing.forEach((m, k) => {
      nodes[m.idx].embedding = vectors[k];
    });
  }

  const edges: MemoryEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    // Find top neighbors by cosine
    const sims: { j: number; sim: number }[] = [];
    for (let j = i + 1; j < nodes.length; j++) {
      const sim = cosineSimilarity(nodes[i].embedding, nodes[j].embedding);
      if (sim >= threshold) sims.push({ j, sim });
    }
    sims.sort((a, b) => b.sim - a.sim);
    const keep = sims.slice(0, maxNeighbors);

    for (const { j, sim } of keep) {
      const a = nodes[i];
      const b = nodes[j];
      const id1 = edgeId(a.id, b.id, 'semantic');
      const id2 = edgeId(b.id, a.id, 'semantic');
      const base: Omit<MemoryEdge, 'id'> = {
        workspaceId,
        from: a.id,
        to: b.id,
        relation: 'semantic',
        weight: Number(sim.toFixed(6)),
        meta: { similarity: sim },
        createdAt: nowIso,
        updatedAt: nowIso,
        expire_at,
      };
      edges.push({ id: id1, ...base });
      edges.push({ id: id2, ...base, from: b.id, to: a.id });
    }
  }

  await batchUpsertEdges(edges);
  return { inserted: edges.length };
}

// ---------- Temporal edges (co-usage decay) ----------
export async function computeTemporalEdges(
  workspaceId: string,
  halfLifeDays: number,
  ttlDays?: number
): Promise<{ inserted: number }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expire_at = ttlDays
    ? Timestamp.fromDate(new Date(now + ttlDays * 24 * 3600 * 1000))
    : undefined;

  // Co-usage approximation: group feedback by turn/session to infer co-occurred snippets
  const fb = await db
    .collection(FEEDBACK)
    .where('workspaceId', '==', workspaceId)
    .orderBy('created_at', 'desc')
    .limit(5000)
    .get();

  type Bucket = { ts: number; snipId: string }[];
  const buckets = new Map<string, Bucket>();

  for (const d of fb.docs) {
    const turn = (d.get('turn_id') as string) || 'na';
    const snip = (d.get('snipId') as string) || (d.get('snippet_id') as string);
    const ts = Date.parse((d.get('created_at') as string) || new Date().toISOString());
    if (!snip) continue;

    const b = buckets.get(turn) || [];
    b.push({ ts, snipId: snip });
    buckets.set(turn, b);
  }

  const edges: MemoryEdge[] = [];
  const seenPairs = new Set<string>(); // Avoid duplicates

  for (const [, bucket] of buckets) {
    // pairwise within a bucket
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        const pairKey = `${a.snipId}_${b.snipId}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const ageDays = Math.max(0, (now - Math.min(a.ts, b.ts)) / (24 * 3600 * 1000));
        const decay = Math.pow(0.5, ageDays / halfLifeDays); // [0..1]
        if (decay < 0.05) continue;

        const id1 = edgeId(a.snipId, b.snipId, 'temporal');
        const id2 = edgeId(b.snipId, a.snipId, 'temporal');
        const base: Omit<MemoryEdge, 'id'> = {
          workspaceId,
          from: a.snipId,
          to: b.snipId,
          relation: 'temporal',
          weight: Number(decay.toFixed(6)),
          meta: { ageDays },
          createdAt: nowIso,
          updatedAt: nowIso,
          expire_at,
        };
        edges.push({ id: id1, ...base });
        edges.push({ id: id2, ...base, from: b.snipId, to: a.snipId });
      }
    }
  }

  await batchUpsertEdges(edges);
  return { inserted: edges.length };
}

// ---------- Feedback edges (aggregate signals) ----------
export async function computeFeedbackEdges(
  workspaceId: string,
  minWeight: number,
  ttlDays?: number
): Promise<{ inserted: number }> {
  const nowIso = new Date().toISOString();
  const expire_at = ttlDays
    ? Timestamp.fromDate(new Date(Date.now() + ttlDays * 24 * 3600 * 1000))
    : undefined;

  // Aggregate per-pair from feedback co-mentions (simple heuristic)
  const fb = await db
    .collection(FEEDBACK)
    .where('workspaceId', '==', workspaceId)
    .limit(10000)
    .get();

  // Map pair -> weight
  const pairWeights = new Map<string, number>();

  for (const d of fb.docs) {
    const snip = (d.get('snipId') as string) || (d.get('snippet_id') as string);
    const clusterId = (d.get('clusterId') as string) || '';
    const reward = Number(d.get('reward') ?? 0);
    if (!snip || !clusterId) continue;

    // link each snippet to its cluster anchor as feedback edge
    const key = `${snip}__${clusterId}`;
    pairWeights.set(key, (pairWeights.get(key) || 0) + reward);
  }

  const edges: MemoryEdge[] = [];
  for (const [key, w] of pairWeights.entries()) {
    const [from, to] = key.split('__');
    const weight = Math.max(0, Math.min(1, 0.5 + w / 10)); // clamp to [0..1], centered
    if (weight < minWeight) continue;

    const id1 = edgeId(from, to, 'feedback');
    const id2 = edgeId(to, from, 'feedback');
    const base: Omit<MemoryEdge, 'id'> = {
      workspaceId,
      from,
      to,
      relation: 'feedback',
      weight: Number(weight.toFixed(6)),
      meta: { sumReward: w },
      createdAt: nowIso,
      updatedAt: nowIso,
      expire_at,
    };
    edges.push({ id: id1, ...base });
    edges.push({ id: id2, ...base, from: to, to: from });
  }

  await batchUpsertEdges(edges);
  return { inserted: edges.length };
}

// ---------- Public orchestrator ----------
export async function rebuildGraphForWorkspace(
  workspaceId: string,
  opts: Partial<BuildGraphOptions> = {}
): Promise<GraphBuildResult> {
  const t0 = Date.now();

  const cfg: BuildGraphOptions = {
    semantic: { ...(opts.semantic || DEFAULT_GRAPH_OPTS.semantic) },
    temporal: { ...(opts.temporal || DEFAULT_GRAPH_OPTS.temporal) },
    feedback: { ...(opts.feedback || DEFAULT_GRAPH_OPTS.feedback) },
    ttlDays: opts.ttlDays ?? DEFAULT_GRAPH_OPTS.ttlDays,
  };

  const nodes = await listSnippetNodes(workspaceId);
  const s = await computeSemanticEdges(workspaceId, nodes, cfg.semantic, cfg.ttlDays);
  const t = await computeTemporalEdges(workspaceId, cfg.temporal.halfLifeDays, cfg.ttlDays);
  const f = await computeFeedbackEdges(workspaceId, cfg.feedback.minWeight, cfg.ttlDays);

  const durationMs = Date.now() - t0;
  const totalEdges = s.inserted + t.inserted + f.inserted;

  return {
    semantic: s.inserted,
    temporal: t.inserted,
    feedback: f.inserted,
    totalNodes: nodes.length,
    totalEdges,
    durationMs,
  };
}

// ---------- Query helpers ----------
export async function getRelatedNodes(
  workspaceId: string,
  baseNodeId: string,
  topK = 12
): Promise<RelatedNode[]> {
  const qs = await db
    .collection(EDGES)
    .where('workspaceId', '==', workspaceId)
    .where('from', '==', baseNodeId)
    .orderBy('weight', 'desc')
    .limit(topK)
    .get();

  return qs.docs.map((d) => ({
    nodeId: d.get('to') as string,
    score: Number(d.get('weight') || 0),
    reason: (d.get('relation') as MemoryEdgeType) || 'semantic',
  }));
}

export async function getRelatedByQueryEmbedding(
  workspaceId: string,
  embedding: number[],
  threshold = 0.75,
  topK = 12
): Promise<RelatedNode[]> {
  // naive: fetch candidate nodes, rank by cosine
  const nodes = await listSnippetNodes(workspaceId);
  const scored = nodes.map((n) => ({
    id: n.id,
    text: n.text,
    sim: cosineSimilarity(embedding, n.embedding),
  }));
  const filtered = scored
    .filter((s) => s.sim >= threshold)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, topK);

  return filtered.map((s) => ({
    nodeId: s.id,
    score: s.sim,
    reason: 'semantic' as const,
    text: s.text,
  }));
}

// ---------- Statistics ----------
export async function getGraphStats(workspaceId: string): Promise<GraphStats> {
  const nodes = await listSnippetNodes(workspaceId);
  const edges = await db
    .collection(EDGES)
    .where('workspaceId', '==', workspaceId)
    .limit(50000)
    .get();

  const edgesByType = {
    semantic: 0,
    temporal: 0,
    feedback: 0,
  };

  for (const d of edges.docs) {
    const rel = d.get('relation') as MemoryEdgeType;
    if (rel in edgesByType) edgesByType[rel]++;
  }

  const avgDegree = nodes.length > 0 ? edges.size / nodes.length : 0;

  return {
    workspaceId,
    nodeCount: nodes.length,
    edgeCount: edges.size,
    edgesByType,
    avgDegree: Number(avgDegree.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

// ---------- Cleanup ----------
export async function deleteGraphForWorkspace(workspaceId: string): Promise<{ deleted: number }> {
  const edges = await db
    .collection(EDGES)
    .where('workspaceId', '==', workspaceId)
    .limit(10000)
    .get();

  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < edges.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = edges.docs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }

  return { deleted };
}
