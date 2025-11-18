/**
 * Phase 38 - Graph Builder
 * Incrementally builds knowledge graph from Firestore sources
 */

import * as admin from 'firebase-admin';
import { GraphNode, GraphEdge } from '../types/graph';

const db = admin.firestore();

/**
 * Sanitize string for use in graph IDs
 */
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9:@._-]/g, '-');
}

/**
 * Upsert a graph node (idempotent)
 */
export async function upsertNode(node: GraphNode): Promise<void> {
  const id = node.id;
  await db
    .collection('ops_graph_nodes')
    .doc(id)
    .set({ ...node, ts: Date.now() }, { merge: true });
}

/**
 * Upsert a graph edge (idempotent)
 */
export async function upsertEdge(edge: GraphEdge): Promise<void> {
  const id = edge.id || `${edge.src}->${edge.kind}->${edge.dst}`;

  // Clamp weight to [0, 1]
  const weight = edge.weight !== undefined
    ? Math.max(0, Math.min(1, edge.weight))
    : undefined;

  await db
    .collection('ops_graph_edges')
    .doc(id)
    .set(
      {
        ...edge,
        id,
        weight,
        ts: Date.now(),
      },
      { merge: true }
    );
}

/**
 * Sync graph from all Firestore sources (Phases 35-37)
 * Runs incrementally - safe to call repeatedly
 */
export async function syncFromSources(): Promise<void> {
  console.log('[graphBuilder] Starting sync from sources...');
  let nodeCount = 0;
  let edgeCount = 0;

  try {
    // 1) Components & windows from ops_stats
    console.log('[graphBuilder] Syncing ops_stats...');
    const stats = await db.collection('ops_stats').get();

    for (const doc of stats.docs) {
      const s: any = doc.data();
      const comp = String(s.component || 'unknown');
      const win = String(s.window || '24h');

      const compNode: GraphNode = {
        id: `component:${sanitize(comp)}`,
        kind: 'component',
        label: comp,
        props: {},
        ts: Date.now(),
      };

      const winNode: GraphNode = {
        id: `metric_window:${sanitize(comp)}:${win}`,
        kind: 'metric_window',
        label: `${comp}:${win}`,
        props: {
          successRate: s.successRate,
          p50Latency: s.p50Latency,
          p95Latency: s.p95Latency,
          avgCostUsd: s.avgCostUsd,
          avgReward: s.avgReward,
          n: s.n,
        },
        ts: Date.now(),
      };

      await upsertNode(compNode);
      await upsertNode(winNode);
      nodeCount += 2;

      await upsertEdge({
        kind: 'DERIVED_FROM',
        src: winNode.id,
        dst: compNode.id,
        weight: 0.9,
        ts: Date.now(),
        id: '',
      });
      edgeCount++;
    }

    // 2) Policies & versions
    console.log('[graphBuilder] Syncing ops_policies...');
    const pols = await db.collection('ops_policies').get();

    for (const doc of pols.docs) {
      const pol: any = doc.data();
      const baseId = String(pol.id || 'unknown');
      const ver = String(pol.version || '1.0.0');

      const pNode: GraphNode = {
        id: `policy:${sanitize(baseId)}`,
        kind: 'policy',
        label: baseId,
        props: {},
        ts: Date.now(),
      };

      const pvNode: GraphNode = {
        id: `policy_version:${sanitize(baseId)}@${ver}`,
        kind: 'policy_version',
        label: `${baseId}@${ver}`,
        props: {
          status: pol.status,
          params: pol.params,
          createdBy: pol.createdBy,
        },
        ts: Date.now(),
      };

      await upsertNode(pNode);
      await upsertNode(pvNode);
      nodeCount += 2;

      await upsertEdge({
        kind: 'DERIVED_FROM',
        src: pvNode.id,
        dst: pNode.id,
        weight: 1.0,
        ts: Date.now(),
        id: '',
      });
      edgeCount++;
    }

    // 3) Decisions
    console.log('[graphBuilder] Syncing ops_decisions...');
    const decs = await db.collection('ops_decisions').get();

    for (const doc of decs.docs) {
      const r: any = doc.data();
      const decId = `decision:${doc.id}`;

      const decNode: GraphNode = {
        id: decId,
        kind: 'decision',
        label: `${r.actor}:${r.component}`,
        props: {
          confidence: r.confidence,
          reasons: r.reasons,
          guardrail: r.guardrail,
          abBucket: r.abBucket,
        },
        ts: Date.now(),
      };

      await upsertNode(decNode);
      nodeCount++;

      // Link decision to component
      if (r.component) {
        await upsertEdge({
          kind: 'AFFECTS',
          src: decId,
          dst: `component:${sanitize(r.component)}`,
          weight: r.confidence || 0.5,
          ts: Date.now(),
          id: '',
        });
        edgeCount++;
      }

      // Link to policy versions if available
      if (r.before && typeof r.before === 'object') {
        const beforeVer = extractVersion(r.before);
        if (beforeVer) {
          await upsertEdge({
            kind: 'DERIVED_FROM',
            src: decId,
            dst: beforeVer,
            weight: 0.8,
            ts: Date.now(),
            id: '',
          });
          edgeCount++;
        }
      }

      if (r.after && typeof r.after === 'object') {
        const afterVer = extractVersion(r.after);
        if (afterVer) {
          await upsertEdge({
            kind: 'TRIGGERS',
            src: decId,
            dst: afterVer,
            weight: 0.8,
            ts: Date.now(),
            id: '',
          });
          edgeCount++;
        }
      }
    }

    // 4) Confidence snapshots
    console.log('[graphBuilder] Syncing ops_confidence...');
    const confs = await db.collection('ops_confidence').get();

    for (const doc of confs.docs) {
      const v: any = doc.data();
      const comp = sanitize(v.component || 'unknown');
      const win = v.window || '24h';

      const confNode: GraphNode = {
        id: `confidence:${comp}:${win}`,
        kind: 'confidence',
        label: `conf:${v.component}:${win}`,
        props: {
          score: v.score,
          reasons: v.reasons,
          sampleSize: v.sampleSize,
          metrics: v.metrics,
        },
        ts: Date.now(),
      };

      await upsertNode(confNode);
      nodeCount++;

      // Link confidence to metric window
      await upsertEdge({
        kind: 'SEES',
        src: confNode.id,
        dst: `metric_window:${comp}:${win}`,
        weight: v.score || 0.5,
        ts: Date.now(),
        id: '',
      });
      edgeCount++;
    }

    console.log(`[graphBuilder] Sync complete: ${nodeCount} nodes, ${edgeCount} edges`);
  } catch (error) {
    console.error('[graphBuilder] Sync error:', error);
    throw error;
  }
}

/**
 * Helper: Extract policy version from decision before/after
 */
function extractVersion(obj: any): string | null {
  // Try to extract version from various structures
  if (obj.version) {
    return `policy_version:router-core@${obj.version}`;
  }
  if (obj.modelWeights) {
    // Heuristic: if it has modelWeights, assume it's a router policy
    return null; // Can't determine version from weights alone
  }
  return null;
}
